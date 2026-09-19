"""
ml_engine.py
------------
Модуль C: Реальная ML-модель для антифрод-классификации.

Дизайн:
  - Вход модели — матрица признаков FeatureEngineeringPipeline (Загрузка: /api/v1/data/upload).
  - Обучается XGBoost (gradient boosting) на размеченном датасете (колонка is_fraud).
  - Для live-транзакций (/check, /analyze, /batch) признаки реконструируются из
    доступных в запросе полей (сумма, частота); недоступные — нулевые дефолты.
  - Хранит eval-метрики и прогнозы для построения бизнес-кривой компромисса.

При недоступности модели (до старта обучения) используется эвристический
риск-скоринг как fallback.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import numpy as np
import pandas as pd
from xgboost import XGBClassifier

from services.feature_engineering import FeatureEngineeringPipeline

# ---------------------------------------------------------------------------
# Схема признаков модели (совпадает с выходом FeatureEngineeringPipeline)
# ---------------------------------------------------------------------------

FEATURE_COLUMNS = [
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
    "vpn_flag",
]

MODEL_NAME = "xgboost.v3.2k"
_LIVE_DEFAULTS = {
    "amount_z_score": 0.0,
    "travel_distance_km": 0.0,
    "travel_speed_kmh": 0.0,
    "impossible_travel_flag": 0,
}


def live_feature_vector(
    amount: float,
    velocity_1h: int,
    vpn_flag: int = 0,
) -> dict[str, float]:
    """
    Реконструирует вектор признаков модели для live-транзакции.

    Для одиночной проверки у нас нет истории клиента/гео, поэтому:
      amount_z_score, travel_* = 0 (не измерены)
      velocity_count_5m = 1 (текущая операция)
      velocity_1h/24h берём из запроса (минимум 1)
      velocity_sum = amount * velocity
      vpn_flag берётся из детекции IP/устройства
    """
    v = max(1, int(velocity_1h or 1))
    amount = float(amount or 0)
    vec = {
        "amount": amount,
        **_LIVE_DEFAULTS,
        "velocity_count_5m": 1.0,
        "velocity_count_1h": float(v),
        "velocity_count_24h": float(v),
        "velocity_sum_1h": amount * v,
        "velocity_sum_24h": amount * v,
        "vpn_flag": 1.0 if int(vpn_flag or 0) else 0.0,
    }
    return {name: vec[name] for name in FEATURE_COLUMNS}


class FraudMLEngine:
    """XGBoost-классификатор риска с бизнес-метриками."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.model: XGBClassifier | None = None
        self.feature_columns = list(FEATURE_COLUMNS)
        self.metrics: dict[str, Any] = {}
        self.trained_at: float | None = None
        self.train_samples: int = 0

        # Eval-данные для построения real-кривой компромисса (analytics)
        self.eval_y_true: np.ndarray | None = None
        self.eval_proba: np.ndarray | None = None
        self.eval_amounts: np.ndarray | None = None

    # ------------------------------------------------------------------
    # Обучение
    # ------------------------------------------------------------------

    def fit_from_features(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        amounts: pd.Series | None = None,
    ) -> dict[str, Any]:
        """Обучает XGBoost на готовой матрице признаков."""
        X = X[self.feature_columns].fillna(0.0)
        y = y.astype(int)

        n_pos = int(y.sum())
        n_neg = len(y) - n_pos
        scale_pos_weight = (n_neg / n_pos) if n_pos > 0 else 1.0

        # Стратифицированный train/valid split — гарантирует наличие обоих
        # классов в валидации, иначе AUC на degenerate-выборке бессмыслен.
        from sklearn.model_selection import train_test_split

        if n_pos >= 2 and len(y) > 10:
            tr_idx, va_idx = train_test_split(
                np.arange(len(X)), test_size=0.3, stratify=y, random_state=42
            )
        else:
            # Слишком мало позитивов — учимся на всех данных, AUC не считаем
            tr_idx = np.arange(len(X))
            va_idx = np.arange(len(X))

        model = XGBClassifier(
            n_estimators=250,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.85,
            colsample_bytree=0.85,
            scale_pos_weight=scale_pos_weight,
            eval_metric="auc",
            tree_method="hist",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X.iloc[tr_idx], y.iloc[tr_idx])

        y_va = y.iloc[va_idx].to_numpy()
        amounts_va = amounts.iloc[va_idx].to_numpy() if amounts is not None else None

        if len(tr_idx) == len(X) and n_pos < 2:
            # Нет настоящей валидации → AUC неизвестен
            proba = np.zeros(len(va_idx))
            auc = None
        else:
            proba = model.predict_proba(X.iloc[va_idx])[:, 1]
            from sklearn.metrics import roc_auc_score

            if len(np.unique(y_va)) > 1:
                auc = float(roc_auc_score(y_va, proba))
            else:
                auc = None

        with self._lock:
            self.model = model
            self.trained_at = time.time()
            self.train_samples = len(X)
            self.eval_y_true = y_va
            self.eval_proba = proba
            self.eval_amounts = amounts_va
            self.metrics = {
                "model": MODEL_NAME,
                "trained_at": self.trained_at,
                "train_samples": len(X),
                "fraud_samples": int(n_pos),
                "eval_size": len(y_va),
                "auc": round(auc, 4) if auc is not None else None,
                "model_name": MODEL_NAME,
            }

        return dict(self.metrics)

    def fit_pipeline(self, df: pd.DataFrame) -> dict[str, Any]:
        """Прогоняет Feature Engineering и обучает модель на готовых признаках."""
        from services.risk_scorer import detect_vpn

        df = df.copy()
        # VPN-сигнал — единственный «живой» контекст, доступный и в датасетах, и в live-запросах
        df["vpn_flag"] = np.array(
            [int(detect_vpn(str(ip), None, "")) for ip in df.get("ip", pd.Series(index=df.index))]
        ).astype(np.float64)

        pipeline = FeatureEngineeringPipeline()
        result = pipeline.run_pipeline(df)
        enriched = result.feature_matrix

        y = enriched.get("is_fraud", pd.Series(0, index=enriched.index))
        amounts = enriched.get("amount", pd.Series(0.0, index=enriched.index))

        return self.fit_from_features(enriched, y, amounts)

    # ------------------------------------------------------------------
    # Инференс
    # ------------------------------------------------------------------

    def predict_proba(self, feature_row: dict[str, float] | pd.DataFrame) -> float:
        """Возвращает вероятность фрода (0.0–1.0) для одной строки признаков."""
        with self._lock:
            model = self.model
        if model is None:
            return np.nan

        if isinstance(feature_row, dict):
            df = pd.DataFrame([{name: feature_row.get(name, 0.0) for name in self.feature_columns}])
        else:
            df = feature_row[self.feature_columns].fillna(0.0)

        proba = model.predict_proba(df)[0][1]
        return float(np.clip(proba, 0.0, 1.0))

    def risk_score(self, amount: float, velocity_1h: int, vpn_flag: int = 0) -> float:
        """
        Риск 0–100 для live-транзакции.
        Если модель не обучена — возвращает NaN (вызывающий берёт fallback).
        """
        proba = self.predict_proba(live_feature_vector(amount, velocity_1h, vpn_flag))
        if np.isnan(proba):
            return np.nan
        return round(float(proba) * 100.0, 1)


# ---------------------------------------------------------------------------
# Синглтон движка + стартовое обучение на синтетике
# ---------------------------------------------------------------------------

ENGINE = FraudMLEngine()


def _bootstrap_model() -> dict[str, Any] | None:
    """Обучает модель на синтетическом датасете сразу при старте сервера."""
    from services.feature_engineering import generate_synthetic_dataset

    df = generate_synthetic_dataset(n_rows=30_000, seed=42)
    return ENGINE.fit_pipeline(df)


_bootstrap_result = _bootstrap_model()


# ---------------------------------------------------------------------------
# Гибридный скоринг (ML + правила)
# ---------------------------------------------------------------------------

# Вес ML-вероятности в финальном риске (остальное — эвристические сигналы)
ML_WEIGHT = 0.65
RULES_WEIGHT = 0.35


def hybrid_risk(
    amount: float,
    velocity_1h: int,
    country_code: str = "1",
    device_code: str = "1",
    vpn: int = 0,
    merchant: str = "",
) -> dict:
    """
    Финальный риск транзакции:
        blend = ML_WEIGHT * model_risk + RULES_WEIGHT * rules_score
        risk  = max(blend, rules_score)   # правила — страховочный флор

    ML-модель (XGBoost из ENGINE) поднимает риск выше правил, если она видит
    аномалию; правила гарантируют, что явно помеченный паттерн (VPN/страна/
    устройство/мерчант) никогда не опустится ниже своей оценки.

    Возвращает тот же контракт, что и score_features (+ model_score/rule_score).
    """
    from services.risk_scorer import score_features

    rules = score_features(
        amount=amount,
        country_code=country_code,
        device_code=device_code,
        velocity_1h=velocity_1h,
        vpn=vpn,
        merchant=merchant,
    )
    rules_score = rules["score"]

    model_score = ENGINE.risk_score(amount, velocity_1h, vpn)
    if np.isnan(model_score):
        model_score = rules_score

    blend = ML_WEIGHT * model_score + RULES_WEIGHT * rules_score
    score = max(blend, rules_score, 2.0)
    score = int(round(min(score, 100.0)))

    status = "BLOCK" if score >= 80 else "CHALLENGE" if score >= 50 else "APPROVE"

    return {
        "score": score,
        "status": status,
        "is_fraud": score >= 80,
        "model_score": round(float(model_score), 1),
        "rule_score": int(rules_score),
        "factors": rules["factors"],
    }