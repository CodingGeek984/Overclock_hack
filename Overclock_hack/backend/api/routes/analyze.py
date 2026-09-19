"""
analyze.py
----------
Эндпоинт XAI-анализа:
  POST /analyze — анонимная оценка риска транзакции по "сырым" параметрам формы.

Используется симулятором (services/fraudApi.js) как замена локального движка.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.ml_engine import ENGINE, hybrid_risk
from services.risk_scorer import (
    COUNTRY_TO_CODE,
    detect_vpn,
    device_code_to_code,
)

router = APIRouter()


class AnalyzeRequest(BaseModel):
    """Параметры транзакции в виде, в котором их шлёт форма симулятора."""

    amount: float = Field(default=0, ge=0)
    country: str = Field(default="KZ", description="ISO-код страны (KZ, NG, RU, ...)")
    ip: str = Field(default="")
    device: str = Field(default="")
    merchant: str = Field(default="")
    frequency: int = Field(default=1, ge=1, le=1000)


@router.post(
    "/analyze",
    summary="XAI-анализ транзакции",
    description=(
        "Принимает параметры формы симулятора и возвращает риск (0–100) "
        "и объяснимые SHAP-факторы."
    ),
)
def analyze_transaction(payload: AnalyzeRequest) -> dict[str, Any]:
    country_code = COUNTRY_TO_CODE.get(str(payload.country).strip().upper(), "1")
    device_code = device_code_to_code(payload.device)
    vpn = detect_vpn(payload.ip, payload.device, payload.merchant)

    result = hybrid_risk(
        amount=payload.amount,
        velocity_1h=payload.frequency,
        country_code=country_code,
        device_code=device_code,
        vpn=vpn,
        merchant=payload.merchant,
    )

    factors = [
        {
            "name": f["name"],
            "effect": f["effect"],
            "detail": f["detail"],
            "strength": f["strength"],
        }
        for f in result["factors"]
    ]

    return {
        "risk": result["score"],
        "status": result["status"],
        "is_fraud": result["is_fraud"],
        "model_score": result["model_score"],
        "rule_score": result["rule_score"],
        "model": ENGINE.metrics.get("model", "xgboost.v3.2k"),
        "factors": factors,
    }