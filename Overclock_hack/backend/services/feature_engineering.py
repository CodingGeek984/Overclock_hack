"""
feature_engineering.py
-----------------------
Модуль A & B: Feature Engineering Pipeline для антифрод-системы Fraud Hunter.

Реализует три ключевые группы признаков:
  1. Z-score суммы транзакции относительно 30-дневного среднего пользователя
  2. Скорость невозможного перемещения (Impossible Travel Speed) по формуле Haversine
  3. Velocity-признаки: частота транзакций за 5м, 1ч, 24ч

Pydantic v2 схемы используются для валидации входных и выходных данных.
"""

from __future__ import annotations

import math
import time
from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Pydantic v2 schemas
# ---------------------------------------------------------------------------

class TransactionRecord(BaseModel):
    """Одна транзакция во входном датасете."""

    model_config = {"populate_by_name": True}

    user_id: str = Field(..., description="Идентификатор пользователя")
    transaction_id: str = Field(..., description="Идентификатор транзакции")
    timestamp: str = Field(..., description="ISO-8601 метка времени")
    amount: float = Field(..., ge=0, description="Сумма транзакции в валюте")
    lat: float = Field(default=0.0, description="Широта геолокации")
    lon: float = Field(default=0.0, description="Долгота геолокации")
    ip: str = Field(default="0.0.0.0", description="IP-адрес")
    is_fraud: int = Field(default=0, ge=0, le=1, description="Метка фрода (0/1)")

    @model_validator(mode="before")
    @classmethod
    def coerce_types(cls, values: dict[str, Any]) -> dict[str, Any]:
        """Приводим числовые поля из CSV-строк."""
        for field in ("amount", "lat", "lon"):
            if field in values and values[field] is not None:
                try:
                    values[field] = float(values[field])
                except (ValueError, TypeError):
                    values[field] = 0.0
        if "is_fraud" in values and values["is_fraud"] is not None:
            try:
                values["is_fraud"] = int(values["is_fraud"])
            except (ValueError, TypeError):
                values["is_fraud"] = 0
        return values


class EngineeringResult(BaseModel):
    """Результат работы пайплайна: статистика и матрица признаков."""

    model_config = {"arbitrary_types_allowed": True}

    records_total: int = Field(..., description="Всего записей на входе")
    records_processed: int = Field(..., description="Успешно обработано")
    features_computed: list[str] = Field(..., description="Список рассчитанных фичей")
    pipeline_duration_ms: float = Field(..., description="Время выполнения пайплайна, мс")
    feature_matrix: Any = Field(default=None, description="pd.DataFrame с фичами (не сериализуется в JSON)")
    stats: dict[str, Any] = Field(default_factory=dict, description="Дескриптивная статистика по фичам")

    def summary_dict(self) -> dict[str, Any]:
        """Версия без feature_matrix для сериализации в API-ответ."""
        return {
            "records_total": self.records_total,
            "records_processed": self.records_processed,
            "features_computed": self.features_computed,
            "pipeline_duration_ms": round(self.pipeline_duration_ms, 2),
            "stats": self.stats,
        }


# ---------------------------------------------------------------------------
# Helper: Haversine distance
# ---------------------------------------------------------------------------

_EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Вычисляет расстояние в километрах между двумя точками на сфере
    по формуле Haversine.

    Аргументы задаются в градусах.
    """
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _haversine_vectorised(
    lat1: pd.Series,
    lon1: pd.Series,
    lat2: pd.Series,
    lon2: pd.Series,
) -> pd.Series:
    """Векторизованный Haversine для pandas Series (градусы → км)."""
    rlat1 = np.radians(lat1.to_numpy(dtype=float, na_value=0.0))
    rlon1 = np.radians(lon1.to_numpy(dtype=float, na_value=0.0))
    rlat2 = np.radians(lat2.to_numpy(dtype=float, na_value=0.0))
    rlon2 = np.radians(lon2.to_numpy(dtype=float, na_value=0.0))

    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = np.sin(dlat / 2) ** 2 + np.cos(rlat1) * np.cos(rlat2) * np.sin(dlon / 2) ** 2
    dist_km = 2 * _EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    return pd.Series(dist_km, index=lat1.index)


# ---------------------------------------------------------------------------
# FeatureEngineeringPipeline
# ---------------------------------------------------------------------------

class FeatureEngineeringPipeline:
    """
    Пайплайн признаковой инженерии для детектирования мошеннических транзакций.

    Ожидает pandas DataFrame со столбцами, соответствующими TransactionRecord.
    Все методы возвращают изменённую копию DataFrame (без side-effects).
    """

    # Максимальная реалистичная скорость коммерческого авиарейса, км/ч
    _IMPOSSIBLE_TRAVEL_SPEED_KMH: float = 900.0

    def calculate_amount_z_score(
        self,
        df: pd.DataFrame,
        user_col: str = "user_id",
        amount_col: str = "amount",
        time_col: str = "timestamp",
        window_days: int = 30,
    ) -> pd.DataFrame:
        """
        Рассчитывает Z-score суммы транзакции относительно скользящего среднего
        пользователя за последние `window_days` дней.

        Формула: z = (amount - rolling_mean) / rolling_std
        При нулевом std (пользователь с одной транзакцией) → z = 0.
        """
        df = df.copy()

        # Убеждаемся, что timestamp — datetime
        if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
            df[time_col] = pd.to_datetime(df[time_col], utc=True, errors="coerce")

        df = df.sort_values([user_col, time_col]).reset_index(drop=True)

        window_str = f"{window_days}D"

        # Скользящие среднее и std с временным окном
        def _rolling_stats(group: pd.DataFrame) -> pd.DataFrame:
            ts_index = group.set_index(time_col)[amount_col]
            rolling = ts_index.rolling(window=window_str, min_periods=1)
            group = group.copy()
            group["_roll_mean"] = rolling.mean().values
            group["_roll_std"] = rolling.std(ddof=1).fillna(0).values
            return group

        df = df.groupby(user_col, group_keys=False).apply(_rolling_stats)

        df["amount_z_score"] = np.where(
            df["_roll_std"] > 0,
            (df[amount_col] - df["_roll_mean"]) / df["_roll_std"],
            0.0,
        )

        # Клипируем выбросы до ±10 — стандартная практика
        df["amount_z_score"] = df["amount_z_score"].clip(-10.0, 10.0)

        df.drop(columns=["_roll_mean", "_roll_std"], inplace=True)
        return df

    def calculate_impossible_travel(
        self,
        df: pd.DataFrame,
        user_col: str = "user_id",
        lat_col: str = "lat",
        lon_col: str = "lon",
        time_col: str = "timestamp",
    ) -> pd.DataFrame:
        """
        Рассчитывает скорость перемещения между последовательными транзакциями
        пользователя по формуле Haversine (км/ч).

        Флаг `impossible_travel_flag = 1` если скорость > скорости коммерческого авиарейса.

        Признаки:
            travel_distance_km   — расстояние от предыдущей транзакции
            time_diff_hours      — интервал времени в часах
            travel_speed_kmh     — скорость (км/ч)
            impossible_travel_flag — 0/1
        """
        df = df.copy()

        if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
            df[time_col] = pd.to_datetime(df[time_col], utc=True, errors="coerce")

        df = df.sort_values([user_col, time_col]).reset_index(drop=True)

        # Предыдущая запись по каждому пользователю
        grp = df.groupby(user_col, sort=False)
        df["_prev_lat"] = grp[lat_col].shift(1)
        df["_prev_lon"] = grp[lon_col].shift(1)
        df["_prev_time"] = grp[time_col].shift(1)

        # Маска строк с предыдущей записью
        has_prev = df["_prev_lat"].notna()

        # Расстояние Haversine (только там, где есть предыдущая точка)
        dist = _haversine_vectorised(
            df.loc[has_prev, lat_col],
            df.loc[has_prev, lon_col],
            df.loc[has_prev, "_prev_lat"],
            df.loc[has_prev, "_prev_lon"],
        )
        df["travel_distance_km"] = 0.0
        df.loc[has_prev, "travel_distance_km"] = dist.values

        # Временной интервал в часах
        df["time_diff_hours"] = np.where(
            has_prev,
            (df[time_col] - df["_prev_time"]).dt.total_seconds() / 3600.0,
            0.0,
        )

        # Скорость (км/ч), защита от деления на 0
        df["travel_speed_kmh"] = np.where(
            (has_prev) & (df["time_diff_hours"] > 1e-6),
            df["travel_distance_km"] / df["time_diff_hours"],
            0.0,
        )

        df["impossible_travel_flag"] = (
            df["travel_speed_kmh"] > self._IMPOSSIBLE_TRAVEL_SPEED_KMH
        ).astype(np.int8)

        df.drop(columns=["_prev_lat", "_prev_lon", "_prev_time"], inplace=True)
        return df

    def calculate_velocity_features(
        self,
        df: pd.DataFrame,
        user_col: str = "user_id",
        time_col: str = "timestamp",
        amount_col: str = "amount",
    ) -> pd.DataFrame:
        """
        Рассчитывает частотные агрегаты транзакций пользователя в скользящих окнах:
            velocity_count_5m  — кол-во транзакций за последние 5 минут
            velocity_count_1h  — кол-во транзакций за последний час
            velocity_count_24h — кол-во транзакций за последние 24 часа
            velocity_sum_1h    — сумма транзакций за последний час
            velocity_sum_24h   — сумма транзакций за последние 24 часа
        """
        df = df.copy()

        if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
            df[time_col] = pd.to_datetime(df[time_col], utc=True, errors="coerce")

        df = df.sort_values([user_col, time_col]).reset_index(drop=True)

        windows = [
            ("5min", "velocity_count_5m", "count"),
            ("1h",   "velocity_count_1h", "count"),
            ("24h",  "velocity_count_24h", "count"),
            ("1h",   "velocity_sum_1h",   "sum"),
            ("24h",  "velocity_sum_24h",  "sum"),
        ]

        # Используем временной индекс для rolling
        df_indexed = df.set_index(time_col)

        for window_str, col_name, agg_func in windows:
            results = []
            for _, group in df_indexed.groupby(user_col, sort=False):
                if agg_func == "count":
                    # rolling count по индикаторной колонке
                    rolled = (
                        group[amount_col]
                        .rolling(window=window_str, min_periods=1)
                        .count()
                    )
                else:
                    rolled = (
                        group[amount_col]
                        .rolling(window=window_str, min_periods=1)
                        .sum()
                    )
                results.append(rolled)

            if results:
                combined = pd.concat(results)
                combined = combined.reindex(df_indexed.index)
                df[col_name] = combined.values
            else:
                df[col_name] = 0.0

        # Восстанавливаем исходный порядок (sort_values мог изменить)
        return df

    def build_feature_matrix(self, df: pd.DataFrame) -> np.ndarray:
        """
        Собирает матрицу признаков X из обогащённого DataFrame.
        Используется ML-движком для получения risk score.

        Возвращает np.ndarray shape (n_samples, n_features).
        """
        feature_cols = [
            "amount",
            "amount_z_score",
            "travel_distance_km",
            "travel_speed_kmh",
            "impossible_travel_flag",
            "velocity_count_5m",
            "velocity_count_1h",
            "velocity_count_24h",
            "velocity_sum_1h",
            "velocity_sum_24h",
        ]
        available = [c for c in feature_cols if c in df.columns]
        X = df[available].fillna(0.0).to_numpy(dtype=np.float64)
        return X

    def run_pipeline(self, df: pd.DataFrame) -> EngineeringResult:
        """
        Запускает полный пайплайн признаковой инженерии.

        Шаги:
            1. Нормализация timestamp
            2. Z-score суммы транзакции
            3. Impossible Travel Speed (Haversine)
            4. Velocity Features (5m / 1h / 24h)

        Возвращает EngineeringResult с обогащённым DataFrame и статистикой.
        """
        t_start = time.perf_counter()
        records_total = len(df)

        # Шаг 0: нормализация timestamp
        if "timestamp" in df.columns and not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")

        # Удаляем строки с некорректным timestamp
        df = df.dropna(subset=["timestamp"])

        # Добавляем недостающие колонки с дефолтами
        for col, default in [("lat", 0.0), ("lon", 0.0), ("is_fraud", 0)]:
            if col not in df.columns:
                df[col] = default

        # Шаги пайплайна
        df = self.calculate_amount_z_score(df)
        df = self.calculate_impossible_travel(df)
        df = self.calculate_velocity_features(df)

        records_processed = len(df)
        duration_ms = (time.perf_counter() - t_start) * 1000

        computed_features = [
            "amount_z_score",
            "travel_distance_km",
            "travel_speed_kmh",
            "impossible_travel_flag",
            "velocity_count_5m",
            "velocity_count_1h",
            "velocity_count_24h",
            "velocity_sum_1h",
            "velocity_sum_24h",
        ]

        # Дескриптивная статистика по ключевым признакам
        stat_cols = [c for c in computed_features if c in df.columns]
        stats_df = df[stat_cols].describe().round(4)
        stats: dict = {}
        for col in stat_cols:
            if col in stats_df:
                stats[col] = {
                    "mean": float(stats_df[col].get("mean", 0)),
                    "std":  float(stats_df[col].get("std", 0)),
                    "min":  float(stats_df[col].get("min", 0)),
                    "max":  float(stats_df[col].get("max", 0)),
                }

        return EngineeringResult(
            records_total=records_total,
            records_processed=records_processed,
            features_computed=computed_features,
            pipeline_duration_ms=duration_ms,
            feature_matrix=df,
            stats=stats,
        )


# ---------------------------------------------------------------------------
# Synthetic dataset generator (для тестирования без реального CSV)
# ---------------------------------------------------------------------------

def generate_synthetic_dataset(n_rows: int = 1000, seed: int = 42) -> pd.DataFrame:
    """
    Генерирует синтетический датасет транзакций для демонстрации и тестирования.

    Примерно 2% записей помечены как мошеннические.
    """
    rng = np.random.default_rng(seed)

    n_users = max(1, n_rows // 50)
    user_ids = [f"USR-{i:05d}" for i in range(n_users)]

    base_ts = pd.Timestamp("2026-01-01", tz="UTC")
    timestamps = pd.to_datetime(
        [base_ts + pd.Timedelta(seconds=int(s)) for s in rng.integers(0, 60 * 24 * 3600, size=n_rows)]
    )

    is_fraud = (rng.random(n_rows) < 0.02).astype(int)

    # Легитимные транзакции: небольшие суммы, Казахстан
    amounts = np.where(
        is_fraud,
        rng.uniform(500_000, 2_000_000, n_rows),   # крупные суммы у фродеров
        rng.exponential(50_000, n_rows),            # exponential для легитимных
    )

    # Геолокация
    lat = np.where(
        is_fraud,
        rng.uniform(-90, 90, n_rows),              # случайные координаты у фродеров
        rng.normal(43.25, 2.5, n_rows),             # Казахстан
    )
    lon = np.where(
        is_fraud,
        rng.uniform(-180, 180, n_rows),
        rng.normal(76.89, 5.0, n_rows),
    )

    return pd.DataFrame(
        {
            "user_id":        rng.choice(user_ids, n_rows),
            "transaction_id": [f"TXN-{i:08d}" for i in range(n_rows)],
            "timestamp":      timestamps,
            "amount":         amounts.round(2),
            "lat":            lat.round(6),
            "lon":            lon.round(6),
            "ip":             [f"192.168.{rng.integers(0,255)}.{rng.integers(1,255)}" for _ in range(n_rows)],
            "is_fraud":       is_fraud,
        }
    )
