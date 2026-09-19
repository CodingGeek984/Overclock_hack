"""
analytics.py
------------
API эндпоинты аналитики для Fraud Hunter Dashboard.

Эндпоинты:
  GET  /api/v1/analytics/kpis             — ключевые KPI дашборда
  GET  /api/v1/analytics/tradeoff         — кривая компромисса для Trade-off Visualizer
  GET  /api/v1/analytics/optimal-threshold — результат оптимизации порога
  POST /api/v1/analytics/compute-tradeoff  — пересчёт кривой с кастомными параметрами

Все схемы используют Pydantic v2 (model_config вместо class Config).
При недоступности ML-данных возвращаются реалистичные mock-значения.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.cost_engine import CostEngine, CostEngineConfig, TradeoffPoint

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic v2 response schemas
# ---------------------------------------------------------------------------


class KPIData(BaseModel):
    """Ключевые показатели эффективности антифрод-системы."""

    model_config = {"populate_by_name": True}

    total_transactions: int = Field(..., description="Общий объём обработанных транзакций")
    fraud_loss_saved: float = Field(..., description="Спасённый бюджет (₸)")
    fraud_loss_saved_formatted: str = Field(..., description="Спасённый бюджет в читаемом формате")
    false_positive_rate: float = Field(..., description="False Positive Rate (%)")
    precision: float = Field(..., description="Precision модели (%)")
    recall: float = Field(..., description="Recall модели (%)")
    f1_score: float = Field(..., description="F1-score модели")
    blocked_transactions: int = Field(..., description="Заблокировано транзакций")
    safe_transactions: int = Field(..., description="Одобрено транзакций")
    optimal_threshold: float = Field(..., description="Оптимальный порог чувствительности (%)")
    min_total_cost: float = Field(..., description="Минимальные суммарные потери при оптимальном пороге (₸)")
    avg_fraud_amount: float = Field(..., description="Средняя сумма мошеннической транзакции (₸)")
    model_name: str = Field(default="xgboost.v3.2k", description="Имя развёрнутой модели")


class TradeoffDataPoint(BaseModel):
    """Одна точка кривой компромисса ML-метрики vs финансовые потери."""

    model_config = {"populate_by_name": True}

    threshold: float = Field(..., description="Порог чувствительности (%)")
    precision: float = Field(..., description="Precision (0.0 – 1.0)")
    recall: float = Field(..., description="Recall (0.0 – 1.0)")
    f1: float = Field(..., description="F1-score")
    fraud_loss: float = Field(..., description="Потери от пропущенного фрода (₸)")
    customer_inconvenience: float = Field(..., description="Штраф за FP — неудобства клиентов (₸)")
    total_cost: float = Field(..., description="Суммарные потери (₸)")
    fraud_loss_saved: float = Field(..., description="Сохранённые средства (₸)")
    fpr: float = Field(..., description="False Positive Rate (%)")


class OptimalThresholdResponse(BaseModel):
    """Результат поиска оптимального порога."""

    model_config = {"populate_by_name": True}

    optimal_threshold: float = Field(..., description="Оптимальный порог (%)")
    optimal_threshold_normalized: float = Field(..., description="Оптимальный порог [0.0 – 1.0]")
    min_total_cost: float = Field(..., description="Суммарные потери при оптимальном пороге (₸)")
    fn_cost_at_optimal: float = Field(..., description="FN-потери при оптимальном пороге (₸)")
    fp_cost_at_optimal: float = Field(..., description="FP-штрафы при оптимальном пороге (₸)")
    precision_at_optimal: float = Field(..., description="Precision при оптимальном пороге")
    recall_at_optimal: float = Field(..., description="Recall при оптимальном пороге")
    f1_at_optimal: float = Field(..., description="F1 при оптимальном пороге")
    improvement_over_default_pct: float = Field(
        ..., description="Снижение потерь vs порог 0.5 (%)"
    )
    fraud_loss_saved_at_optimal: float = Field(..., description="Спасённые средства (₸)")
    config_used: dict[str, Any] = Field(..., description="Конфигурация движка")


class ComputeTradeoffRequest(BaseModel):
    """Запрос для пересчёта кривой с кастомными параметрами."""

    model_config = {"populate_by_name": True}

    avg_fraud_amount: float = Field(
        default=250_000.0,
        ge=1_000.0,
        description="Средняя сумма фрода (₸)",
    )
    customer_friction_penalty: float = Field(
        default=5_000.0,
        ge=0.0,
        description="Штраф за ложную блокировку (₸)",
    )
    n_points: int = Field(
        default=101,
        ge=11,
        le=1001,
        description="Кол-во точек на кривой",
    )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _format_currency(amount: float) -> str:
    """Форматирует сумму в читаемый вид (M / K / ₸)."""
    if amount >= 1_000_000_000:
        return f"{amount / 1_000_000_000:.1f}B ₸"
    if amount >= 1_000_000:
        return f"{amount / 1_000_000:.1f}M ₸"
    if amount >= 1_000:
        return f"{amount / 1_000:.0f}K ₸"
    return f"{amount:.0f} ₸"


def _get_default_cost_engine() -> CostEngine:
    """Возвращает CostEngine с продуктовыми дефолтами."""
    return CostEngine(
        CostEngineConfig(
            avg_fraud_amount=250_000.0,
            customer_friction_penalty=5_000.0,
            threshold_resolution=100,
        )
    )


def _real_prediction_data() -> tuple:
    """Возвращает (y_true, y_prob, fraud_amounts) реальной модели или None."""
    from services.ml_engine import ENGINE

    if ENGINE.model is None or ENGINE.eval_y_true is None:
        return None
    if ENGINE.eval_proba is None or ENGINE.eval_amounts is None:
        return None
    return ENGINE.eval_y_true, ENGINE.eval_proba, ENGINE.eval_amounts


def _build_kpi_mock() -> KPIData:
    """
    Генерирует реалистичные KPI на основе синтетической кривой компромисса.
    Используется когда реальные ML-данные недоступны.
    """
    engine = _get_default_cost_engine()
    curve = engine.build_tradeoff_curve(n_points=101)

    # Находим оптимальную точку
    optimal_pt = min(curve, key=lambda p: p.total_cost)

    total_tx = 100_000
    fraud_rate = 0.02
    n_fraud = int(total_tx * fraud_rate)
    n_legit = total_tx - n_fraud

    # При оптимальном пороге
    recall_at_opt = optimal_pt.recall
    precision_at_opt = optimal_pt.precision

    tp = int(n_fraud * recall_at_opt)
    fp = int(tp / (precision_at_opt + 1e-9) - tp) if precision_at_opt > 0 else 0
    fp = max(0, min(fp, n_legit))

    blocked = tp + fp
    safe = total_tx - blocked

    f1 = (
        2 * precision_at_opt * recall_at_opt / (precision_at_opt + recall_at_opt + 1e-9)
        if (precision_at_opt + recall_at_opt) > 0 else 0.0
    )
    fpr = optimal_pt.fpr

    return KPIData(
        total_transactions=total_tx,
        fraud_loss_saved=round(optimal_pt.fraud_loss_saved, 2),
        fraud_loss_saved_formatted=_format_currency(optimal_pt.fraud_loss_saved),
        false_positive_rate=round(fpr, 2),
        precision=round(precision_at_opt * 100, 2),
        recall=round(recall_at_opt * 100, 2),
        f1_score=round(f1, 4),
        blocked_transactions=blocked,
        safe_transactions=safe,
        optimal_threshold=round(optimal_pt.threshold, 2),
        min_total_cost=round(optimal_pt.total_cost, 2),
        avg_fraud_amount=engine.config.avg_fraud_amount,
        model_name="xgboost.v3.2k",
    )


def _build_kpi_from_model() -> KPIData:
    """
    Строит KPI из реальных прогнозов XGBoost (eval-выборка ENGINE):
    поиск оптимального порога через CostEngine по фактической кривой.
    """
    data = _real_prediction_data()
    engine = _get_default_cost_engine()
    if data is None:
        return _build_kpi_mock()

    y_true, y_prob, fraud_amounts = data

    # Для расчёта балансированной кривой используем неискажённый объём:
    # eval-выборка несбалансирована (немного фрода) — считаем бизнес-метрики
    # на масштабе 100k транзакций с сохранением базовой частоты фрода.
    base_fraud_rate = float(y_true.mean())
    report = engine.find_optimal_threshold(y_true, y_prob, fraud_amounts)
    opt = report.optimal

    total_tx = 100_000
    n_fraud = int(total_tx * base_fraud_rate)
    n_legit = total_tx - n_fraud

    precision_at_opt = opt.precision
    recall_at_opt = opt.recall

    tp = int(n_fraud * opt.recall)
    fp = int(tp / (precision_at_opt + 1e-9) - tp) if precision_at_opt > 0 else 0
    fp = max(0, min(fp, n_legit))
    blocked = tp + fp
    safe = total_tx - blocked

    f1 = (
        2 * precision_at_opt * recall_at_opt / (precision_at_opt + recall_at_opt + 1e-9)
        if (precision_at_opt + recall_at_opt) > 0 else 0.0
    )

    avg_fraud_amount = engine.config.avg_fraud_amount
    saved = float(opt.fraud_loss_saved)
    # fraud_loss_saved на eval-выборке — реальная сумма; масштабируем до 100k
    scale = (n_fraud / max(1, int(y_true.sum()))) if int(y_true.sum()) > 0 else 1.0
    saved_scaled = saved * scale

    return KPIData(
        total_transactions=total_tx,
        fraud_loss_saved=round(saved_scaled, 2),
        fraud_loss_saved_formatted=_format_currency(saved_scaled),
        false_positive_rate=round(opt.fpr * 100, 2),
        precision=round(precision_at_opt * 100, 2),
        recall=round(recall_at_opt * 100, 2),
        f1_score=round(f1, 4),
        blocked_transactions=blocked,
        safe_transactions=safe,
        optimal_threshold=round(opt.threshold * 100, 2),
        min_total_cost=round(opt.total_cost, 2),
        avg_fraud_amount=avg_fraud_amount,
        model_name="xgboost.v3.2k",
    )


def _build_curve_from_model(n_points: int) -> list[TradeoffDataPoint] | None:
    """Строит кривую компромисса по реальным прогнозам модели (или None)."""
    data = _real_prediction_data()
    if data is None:
        return None
    y_true, y_prob, fraud_amounts = data
    engine = _get_default_cost_engine()
    try:
        curve = engine.build_tradeoff_curve(y_true, y_prob, fraud_amounts, n_points=n_points)
    except Exception:
        return None
    return [
        TradeoffDataPoint(
            threshold=pt.threshold,
            precision=pt.precision,
            recall=pt.recall,
            f1=pt.f1,
            fraud_loss=pt.fraud_loss,
            customer_inconvenience=pt.customer_inconvenience,
            total_cost=pt.total_cost,
            fraud_loss_saved=pt.fraud_loss_saved,
            fpr=pt.fpr,
        )
        for pt in curve
    ]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/kpis",
    response_model=KPIData,
    summary="Ключевые KPI дашборда",
    description=(
        "Возвращает агрегированные KPI антифрод-системы: общий объём транзакций, "
        "спасённый бюджет, FPR, Precision/Recall, оптимальный порог и суммарные потери."
    ),
)
def get_kpis() -> KPIData:
    """
    Модуль A: KPI Cards для главной страницы дашборда.

    При наличии обученной ML-модели считает метрики по РЕАЛЬНЫМ прогнозам
    (eval-выборка XGBoost + CostEngine). Иначе — реалистичные mock-данные.
    """
    try:
        return _build_kpi_from_model()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка расчёта KPI: {exc}") from exc


@router.get(
    "/tradeoff",
    response_model=list[TradeoffDataPoint],
    summary="Кривая компромисса Precision/Recall vs Financial Loss",
    description=(
        "Возвращает список точек кривой компромисса от 0% до 100% для "
        "Trade-off Visualizer. Каждая точка содержит ML-метрики и финансовые потери."
    ),
)
def get_tradeoff_data(
    n_points: Annotated[int, Query(ge=11, le=1001, description="Кол-во точек кривой")] = 101,
    avg_fraud_amount: Annotated[
        float, Query(ge=1_000, description="Средняя сумма фрода (₸)")
    ] = 250_000.0,
    customer_friction_penalty: Annotated[
        float, Query(ge=0, description="Штраф за FP (₸)")
    ] = 5_000.0,
) -> list[TradeoffDataPoint]:
    """
    Модуль A: Trade-off Visualizer данные.

    Поддерживает query-параметры для динамического пересчёта при изменении
    бизнес-параметров пользователем.
    """
    try:
        real_curve = _build_curve_from_model(n_points=n_points)
        if real_curve is not None:
            return real_curve

        engine = CostEngine(
            CostEngineConfig(
                avg_fraud_amount=avg_fraud_amount,
                customer_friction_penalty=customer_friction_penalty,
            )
        )
        curve: list[TradeoffPoint] = engine.build_tradeoff_curve(n_points=n_points)

        return [
            TradeoffDataPoint(
                threshold=pt.threshold,
                precision=pt.precision,
                recall=pt.recall,
                f1=pt.f1,
                fraud_loss=pt.fraud_loss,
                customer_inconvenience=pt.customer_inconvenience,
                total_cost=pt.total_cost,
                fraud_loss_saved=pt.fraud_loss_saved,
                fpr=pt.fpr,
            )
            for pt in curve
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Ошибка построения кривой компромисса: {exc}"
        ) from exc


@router.get(
    "/optimal-threshold",
    response_model=OptimalThresholdResponse,
    summary="Оптимальный порог классификации",
    description=(
        "Вычисляет порог, минимизирующий суммарные бизнес-потери: "
        "Total Loss = FN*Avg_Fraud + FP*Customer_Friction_Penalty. "
        "Использует Grid Search + Golden-Section Refinement."
    ),
)
def get_optimal_threshold(
    avg_fraud_amount: Annotated[
        float, Query(ge=1_000, description="Средняя сумма фрода (₸)")
    ] = 250_000.0,
    customer_friction_penalty: Annotated[
        float, Query(ge=0, description="Штраф за FP (₸)")
    ] = 5_000.0,
) -> OptimalThresholdResponse:
    """
    Модуль C: Автоматический поиск оптимального порога.

    Возвращает оптимальный порог и сравнение с дефолтным (0.5).
    """
    try:
        import numpy as np

        engine = CostEngine(
            CostEngineConfig(
                avg_fraud_amount=avg_fraud_amount,
                customer_friction_penalty=customer_friction_penalty,
                threshold_resolution=200,
            )
        )

        # Реальные прогнозы обученной XGBoost-модели (если есть)
        data = _real_prediction_data()
        if data is not None:
            y_true, y_prob, fraud_amounts = data
        else:
            # Fallback: синтетические правдоподобные вероятности
            rng = np.random.default_rng(42)
            n = 10_000
            n_fraud = 200
            y_true = np.zeros(n, dtype=np.int8)
            y_true[:n_fraud] = 1
            y_prob = np.concatenate([
                rng.beta(5, 2, n_fraud),
                rng.beta(1.5, 8, n - n_fraud),
            ])
            fraud_amounts = np.concatenate([
                rng.uniform(100_000, 500_000, n_fraud),
                np.zeros(n - n_fraud),
            ])

        report = engine.find_optimal_threshold(y_true, y_prob, fraud_amounts)
        opt = report.optimal

        return OptimalThresholdResponse(
            optimal_threshold=round(opt.threshold * 100, 2),
            optimal_threshold_normalized=round(opt.threshold, 6),
            min_total_cost=round(opt.total_cost, 2),
            fn_cost_at_optimal=round(opt.fn_cost, 2),
            fp_cost_at_optimal=round(opt.fp_cost, 2),
            precision_at_optimal=round(opt.precision, 4),
            recall_at_optimal=round(opt.recall, 4),
            f1_at_optimal=round(opt.f1, 4),
            improvement_over_default_pct=report.improvement_over_default,
            fraud_loss_saved_at_optimal=round(opt.fraud_loss_saved, 2),
            config_used=report.config.model_dump(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Ошибка оптимизации порога: {exc}"
        ) from exc


@router.post(
    "/compute-tradeoff",
    response_model=list[TradeoffDataPoint],
    summary="Пересчёт кривой компромисса с кастомными параметрами",
    description=(
        "POST-версия эндпоинта tradeoff для передачи параметров в теле запроса. "
        "Используется фронтендом при интерактивном изменении avg_fraud_amount."
    ),
)
def compute_tradeoff(body: ComputeTradeoffRequest) -> list[TradeoffDataPoint]:
    """Пересчитывает кривую компромисса с параметрами из тела запроса."""
    try:
        engine = CostEngine(
            CostEngineConfig(
                avg_fraud_amount=body.avg_fraud_amount,
                customer_friction_penalty=body.customer_friction_penalty,
            )
        )
        curve = engine.build_tradeoff_curve(n_points=body.n_points)

        return [
            TradeoffDataPoint(
                threshold=pt.threshold,
                precision=pt.precision,
                recall=pt.recall,
                f1=pt.f1,
                fraud_loss=pt.fraud_loss,
                customer_inconvenience=pt.customer_inconvenience,
                total_cost=pt.total_cost,
                fraud_loss_saved=pt.fraud_loss_saved,
                fpr=pt.fpr,
            )
            for pt in curve
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Ошибка пересчёта: {exc}"
        ) from exc
