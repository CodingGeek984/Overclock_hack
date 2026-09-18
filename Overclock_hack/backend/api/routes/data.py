"""
data.py
-------
Модуль B: API эндпоинты для загрузки и предиктивной обработки данных.

Эндпоинты:
  POST /api/v1/data/upload  — загрузка CSV/Parquet, запуск Feature Engineering Pipeline
  POST /api/v1/data/stream  — симуляция потоковой обработки транзакций
  GET  /api/v1/data/status  — статус последнего задания обработки

Pydantic v2 схемы + полная обработка ошибок.
"""

from __future__ import annotations

import io
import time
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from services.feature_engineering import FeatureEngineeringPipeline

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory job store (замена Redis для MVP демонстрации)
# ---------------------------------------------------------------------------
_last_job: dict[str, Any] = {
    "status": "idle",
    "records_processed": 0,
    "features_computed": [],
    "pipeline_duration_ms": 0.0,
    "stats": {},
    "error": None,
    "started_at": None,
    "finished_at": None,
}

# ---------------------------------------------------------------------------
# Pydantic v2 schemas
# ---------------------------------------------------------------------------


class UploadResponse(BaseModel):
    """Результат загрузки и обработки файла датасета."""

    model_config = {"populate_by_name": True}

    status: Literal["success", "partial", "error"] = Field(
        ..., description="Статус обработки"
    )
    filename: str = Field(..., description="Имя загруженного файла")
    file_format: Literal["csv", "parquet", "unknown"] = Field(
        ..., description="Определённый формат файла"
    )
    records_total: int = Field(..., description="Всего строк в файле")
    records_processed: int = Field(..., description="Успешно обработано")
    features_computed: list[str] = Field(..., description="Список рассчитанных признаков")
    pipeline_duration_ms: float = Field(..., description="Время выполнения пайплайна, мс")
    stats: dict[str, Any] = Field(default_factory=dict, description="Статистика признаков")
    warnings: list[str] = Field(default_factory=list, description="Предупреждения при обработке")
    message: str = Field(..., description="Читаемое сообщение о результате")


class StreamSimulationRequest(BaseModel):
    """Запрос на запуск симуляции потоковой обработки."""

    model_config = {"populate_by_name": True}

    rate_per_second: int = Field(
        default=100,
        ge=1,
        le=10_000,
        description="Скорость обработки транзакций (записей/сек)",
    )
    duration_seconds: int = Field(
        default=60,
        ge=1,
        le=3_600,
        description="Длительность симуляции (секунды)",
    )


class StreamResponse(BaseModel):
    """Ответ на запрос симуляции потока."""

    model_config = {"populate_by_name": True}

    status: Literal["started", "already_running"] = Field(..., description="Статус запуска")
    rate_per_second: int = Field(..., description="Скорость обработки")
    estimated_total: int = Field(..., description="Расчётный объём транзакций")
    message: str = Field(..., description="Описание")


class JobStatusResponse(BaseModel):
    """Статус последнего задания обработки."""

    model_config = {"populate_by_name": True}

    status: str = Field(..., description="idle | running | done | error")
    records_processed: int = Field(...)
    features_computed: list[str] = Field(...)
    pipeline_duration_ms: float = Field(...)
    stats: dict[str, Any] = Field(default_factory=dict)
    error: str | None = Field(default=None)
    started_at: float | None = Field(default=None)
    finished_at: float | None = Field(default=None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_format(filename: str, content: bytes) -> Literal["csv", "parquet", "unknown"]:
    """Определяет формат файла по имени и magic bytes."""
    name_lower = filename.lower()
    if name_lower.endswith(".parquet"):
        return "parquet"
    if name_lower.endswith((".csv", ".tsv", ".txt")):
        return "csv"
    # Parquet magic bytes: PAR1
    if content[:4] == b"PAR1":
        return "parquet"
    # Проверяем, похоже ли на CSV (первые байты — ASCII)
    try:
        content[:256].decode("utf-8")
        return "csv"
    except UnicodeDecodeError:
        return "unknown"


def _load_dataframe(content: bytes, file_format: str) -> "pd.DataFrame":
    """Загружает DataFrame из байтов в зависимости от формата."""
    import pandas as pd

    if file_format == "parquet":
        try:
            import pyarrow  # noqa: F401
            return pd.read_parquet(io.BytesIO(content))
        except ImportError:
            raise HTTPException(
                status_code=422,
                detail="Для работы с Parquet установите pyarrow: pip install pyarrow",
            )
    elif file_format == "csv":
        # Пробуем несколько разделителей
        for sep in (",", ";", "\t", "|"):
            try:
                df = pd.read_csv(io.BytesIO(content), sep=sep, low_memory=False)
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
        # Последняя попытка с дефолтным разделителем
        return pd.read_csv(io.BytesIO(content), low_memory=False)
    else:
        raise HTTPException(
            status_code=422,
            detail="Неподдерживаемый формат файла. Загрузите CSV или Parquet.",
        )


def _normalise_columns(df: "pd.DataFrame", warnings: list[str]) -> "pd.DataFrame":
    """
    Приводит колонки DataFrame к стандартному набору FeatureEngineeringPipeline.
    Добавляет отсутствующие колонки с дефолтными значениями.
    """
    import numpy as np
    import pandas as pd

    # Маппинг альтернативных имён колонок
    COLUMN_ALIASES: dict[str, list[str]] = {
        "user_id":        ["userid", "user", "client_id", "customer_id", "account_id"],
        "transaction_id": ["txn_id", "tx_id", "id", "transaction_id", "txid"],
        "timestamp":      ["date", "datetime", "time", "created_at", "ts", "transaction_date"],
        "amount":         ["amt", "sum", "value", "transaction_amount", "price"],
        "lat":            ["latitude", "geo_lat", "lat_deg"],
        "lon":            ["longitude", "geo_lon", "lon_deg", "lng"],
        "is_fraud":       ["fraud", "label", "target", "isFraud", "is_fraud_flag"],
    }

    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    for target_col, aliases in COLUMN_ALIASES.items():
        if target_col not in df.columns:
            for alias in aliases:
                if alias in df.columns:
                    df.rename(columns={alias: target_col}, inplace=True)
                    break

    # Дефолты для отсутствующих обязательных колонок
    defaults: dict[str, Any] = {
        "user_id":        [f"USR-{i:06d}" for i in range(len(df))],
        "transaction_id": [f"TXN-{i:08d}" for i in range(len(df))],
        "timestamp":      pd.Timestamp.now(tz="UTC"),
        "amount":         0.0,
        "lat":            43.25,  # Алматы
        "lon":            76.89,
        "is_fraud":       0,
    }

    for col, default in defaults.items():
        if col not in df.columns:
            warnings.append(f"Колонка '{col}' не найдена — используется значение по умолчанию")
            df[col] = default

    return df


def _process_upload_background(content: bytes, filename: str, file_format: str) -> None:
    """Фоновая обработка загруженного файла."""
    global _last_job
    _last_job["status"] = "running"
    _last_job["started_at"] = time.time()
    _last_job["error"] = None

    try:
        warnings: list[str] = []
        df = _load_dataframe(content, file_format)
        df = _normalise_columns(df, warnings)

        pipeline = FeatureEngineeringPipeline()
        result = pipeline.run_pipeline(df)

        _last_job.update({
            "status": "done",
            "records_processed": result.records_processed,
            "features_computed": result.features_computed,
            "pipeline_duration_ms": result.pipeline_duration_ms,
            "stats": result.stats,
            "finished_at": time.time(),
        })
    except Exception as exc:
        _last_job.update({
            "status": "error",
            "error": str(exc),
            "finished_at": time.time(),
        })


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Загрузка датасета транзакций",
    description=(
        "Принимает CSV или Parquet файл (до 500 MB). "
        "Запускает Feature Engineering Pipeline: Z-score, Impossible Travel Speed, Velocity Features. "
        "Возвращает статистику обработки."
    ),
)
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(description="CSV или Parquet файл с транзакциями")],
    async_processing: Annotated[
        bool, Query(description="true — запустить в фоне; false — обработать синхронно")
    ] = False,
) -> UploadResponse:
    """
    Модуль B: Ingestion API — загрузка и предиктивная обработка датасета.

    Синхронный режим (async_processing=false, дефолт):
        - Читает файл, запускает пайплайн, возвращает статистику.
        - Рекомендуется для файлов до ~10K строк.

    Асинхронный режим (async_processing=true):
        - Мгновенно возвращает ответ, обработка идёт в фоне.
        - Статус проверяется через GET /api/v1/data/status.
        - Рекомендуется для 100K+ строк.
    """
    import pandas as pd

    if not file.filename:
        raise HTTPException(status_code=422, detail="Имя файла не определено")

    # Читаем содержимое файла
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Файл пуст")

    if len(content) > 500 * 1024 * 1024:  # 500 MB
        raise HTTPException(
            status_code=413,
            detail="Файл слишком большой. Максимальный размер — 500 MB.",
        )

    filename = file.filename
    file_format = _detect_format(filename, content)
    warnings: list[str] = []

    if async_processing:
        # Фоновая обработка
        background_tasks.add_task(_process_upload_background, content, filename, file_format)
        return UploadResponse(
            status="success",
            filename=filename,
            file_format=file_format,
            records_total=0,
            records_processed=0,
            features_computed=[],
            pipeline_duration_ms=0.0,
            stats={},
            warnings=["Обработка запущена в фоне. Проверяйте статус через GET /api/v1/data/status"],
            message=f"Файл {filename} принят. Фоновая обработка запущена.",
        )

    # Синхронная обработка
    try:
        df = _load_dataframe(content, file_format)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Не удалось прочитать файл: {exc}",
        ) from exc

    records_total = len(df)
    df = _normalise_columns(df, warnings)

    try:
        pipeline = FeatureEngineeringPipeline()
        result = pipeline.run_pipeline(df)

        status: Literal["success", "partial", "error"] = (
            "success" if result.records_processed == records_total else "partial"
        )

        return UploadResponse(
            status=status,
            filename=filename,
            file_format=file_format,
            records_total=records_total,
            records_processed=result.records_processed,
            features_computed=result.features_computed,
            pipeline_duration_ms=round(result.pipeline_duration_ms, 2),
            stats=result.stats,
            warnings=warnings,
            message=(
                f"✓ Файл {filename} обработан: {result.records_processed:,} записей, "
                f"{len(result.features_computed)} признаков за {result.pipeline_duration_ms:.0f} мс."
            ),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка Feature Engineering Pipeline: {exc}",
        ) from exc


@router.post(
    "/stream",
    response_model=StreamResponse,
    summary="Симуляция потоковой обработки транзакций",
    description=(
        "Запускает фоновую симуляцию потоковой обработки транзакций "
        "с заданной скоростью. Имитирует подключение к Kafka / WebSocket stream."
    ),
)
async def simulate_stream(
    req: StreamSimulationRequest,
    background_tasks: BackgroundTasks,
) -> StreamResponse:
    """
    Модуль B: Симуляция Live-потока транзакций.

    В production-версии здесь был бы Kafka consumer или WebSocket reader.
    """
    if _last_job.get("status") == "running":
        return StreamResponse(
            status="already_running",
            rate_per_second=req.rate_per_second,
            estimated_total=req.rate_per_second * req.duration_seconds,
            message="Поток уже активен. Дождитесь завершения текущего задания.",
        )

    def _run_stream_simulation(rate: int, duration: int) -> None:
        """Симуляция: генерируем синтетические транзакции и прогоняем через пайплайн."""
        from services.feature_engineering import generate_synthetic_dataset

        global _last_job
        _last_job["status"] = "running"
        _last_job["started_at"] = time.time()

        total_to_process = min(rate * duration, 100_000)  # cap at 100K

        try:
            df = generate_synthetic_dataset(n_rows=total_to_process)
            pipeline = FeatureEngineeringPipeline()
            result = pipeline.run_pipeline(df)

            _last_job.update({
                "status": "done",
                "records_processed": result.records_processed,
                "features_computed": result.features_computed,
                "pipeline_duration_ms": result.pipeline_duration_ms,
                "stats": result.stats,
                "finished_at": time.time(),
            })
        except Exception as exc:
            _last_job.update({
                "status": "error",
                "error": str(exc),
                "finished_at": time.time(),
            })

    background_tasks.add_task(_run_stream_simulation, req.rate_per_second, req.duration_seconds)

    estimated_total = min(req.rate_per_second * req.duration_seconds, 100_000)

    return StreamResponse(
        status="started",
        rate_per_second=req.rate_per_second,
        estimated_total=estimated_total,
        message=(
            f"Потоковая симуляция запущена: {req.rate_per_second} тр/сек × "
            f"{req.duration_seconds} сек = ~{estimated_total:,} транзакций."
        ),
    )


@router.get(
    "/status",
    response_model=JobStatusResponse,
    summary="Статус последнего задания обработки",
    description="Возвращает статус и результаты последнего запущенного задания (upload или stream).",
)
def get_job_status() -> JobStatusResponse:
    """Проверка статуса фоновой обработки."""
    return JobStatusResponse(**_last_job)
