"""
model.py
--------
API эндпоинты управления конфигурацией ML-модели.

Эндпоинты:
  GET /api/v1/model/config — получить имя модели и веса признаков
  PUT /api/v1/model/config — обновить веса признаков (в памяти)
"""

from __future__ import annotations

import threading
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory config
# ---------------------------------------------------------------------------

_lock = threading.Lock()

_config: dict[str, Any] = {
    "model": "xgboost.v3.2k",
    "weights": {
        "amount": 19,
        "geo": 15,
        "vpn": 17,
        "device": 11,
        "velocity": 14,
    },
}

ALLOWED_KEYS = {"amount", "geo", "vpn", "device", "velocity"}


# ---------------------------------------------------------------------------
# Pydantic схемы
# ---------------------------------------------------------------------------


class ModelConfigPatch(BaseModel):
    """Частичное обновление конфигурации модели."""

    model: str | None = None
    weights: dict[str, int] | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/config",
    summary="Конфигурация ML-модели",
    description="Возвращает имя развёрнутой модели, веса признаков и runtime-метрики обучения.",
)
def get_model_config() -> dict[str, Any]:
    with _lock:
        from services.ml_engine import ENGINE

        return {
            "model": _config["model"],
            "weights": dict(_config["weights"]),
            "runtime": {
                "trained_at": ENGINE.metrics.get("trained_at"),
                "train_samples": ENGINE.metrics.get("train_samples", 0),
                "fraud_samples": ENGINE.metrics.get("fraud_samples", 0),
                "auc": ENGINE.metrics.get("auc", 0.0),
                "eval_size": ENGINE.metrics.get("eval_size", 0),
                "algorithm": "XGBoost",
                "features": ENGINE.feature_columns,
            },
        }


@router.put(
    "/config",
    summary="Обновление конфигурации ML-модели",
    description="Обновляет веса признаков: amount, geo, vpn, device, velocity.",
)
def update_model_config(patch: ModelConfigPatch) -> dict[str, Any]:
    with _lock:
        if patch.model is not None:
            _config["model"] = patch.model
        if patch.weights is not None:
            for key, value in patch.weights.items():
                if key in ALLOWED_KEYS:
                    _config["weights"][key] = max(0, min(30, int(value)))
        return {
            "model": _config["model"],
            "weights": dict(_config["weights"]),
        }