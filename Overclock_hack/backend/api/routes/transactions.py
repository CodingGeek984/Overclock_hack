"""
transactions.py
---------------
API эндпоинты транзакций для Fraud Hunter Dashboard.

Эндпоинты:
  POST /api/v1/transactions/check — проверка одиночной транзакции
  POST /api/v1/transactions/      — создание транзакции (с оценкой риска)
  GET  /api/v1/transactions/      — лента последних транзакций
  GET  /api/v1/transactions/stats — агрегированная статистика
  POST /api/v1/transactions/batch — пакетная симуляция транзакций

Хранилище — SQLite (файл fraud_hunter.db рядом с backend) + in-memory кэш последних 500.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
import threading
import time
from typing import Annotated, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.ml_engine import MODEL_NAME, ENGINE, hybrid_risk
from services.risk_scorer import top_factor_explanation

router = APIRouter()

# ---------------------------------------------------------------------------
# SQLite persistence + in-memory store
# ---------------------------------------------------------------------------

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(_BACKEND_DIR, "fraud_hunter.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY,
    amount       REAL,
    country_code TEXT,
    device_code  TEXT,
    velocity_1h  INTEGER,
    vpn          INTEGER,
    score        INTEGER,
    status       TEXT,
    is_fraud     INTEGER,
    model_score  REAL,
    rule_score   REAL,
    factors      TEXT,
    reasons      TEXT,
    message      TEXT,
    explanation  TEXT,
    created_at   REAL
);
"""

_lock = threading.Lock()
_id_counter = [0]
_store: list[dict[str, Any]] = []


def _next_id() -> int:
    with _lock:
        _id_counter[0] += 1
        return _id_counter[0]


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _db()
    try:
        with conn:
            conn.execute(_SCHEMA)
    finally:
        conn.close()


def _insert_db(row: dict[str, Any]) -> None:
    """Пишет транзакцию в SQLite (игнорируя конфликт по id)."""
    conn = _db()
    try:
        with conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO transactions (
                    id, amount, country_code, device_code, velocity_1h, vpn,
                    score, status, is_fraud, model_score, rule_score,
                    factors, reasons, message, explanation, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    row["amount"],
                    row["country_code"],
                    row["device_code"],
                    row["velocity_1h"],
                    row["vpn"],
                    row["score"],
                    row["status"],
                    1 if row["is_fraud"] else 0,
                    row.get("model_score"),
                    row.get("rule_score"),
                    json.dumps(row.get("factors") or [], ensure_ascii=False),
                    json.dumps(row.get("reasons") or [], ensure_ascii=False),
                    row.get("message") or "",
                    row.get("explanation") or "",
                    row.get("created_at", time.time()),
                ),
            )
    finally:
        conn.close()


def _load_from_db() -> list[dict[str, Any]]:
    """Читает все транзакции из SQLite, новые первыми."""
    conn = _db()
    try:
        rows = conn.execute(
            "SELECT * FROM transactions ORDER BY created_at DESC, id DESC"
        ).fetchall()
    finally:
        conn.close()
    return [
        {
            "id": r["id"],
            "amount": r["amount"],
            "country_code": r["country_code"],
            "device_code": r["device_code"],
            "velocity_1h": r["velocity_1h"],
            "vpn": r["vpn"],
            "score": r["score"],
            "status": r["status"],
            "is_fraud": bool(r["is_fraud"]),
            "model_score": r["model_score"],
            "rule_score": r["rule_score"],
            "factors": json.loads(r["factors"]) if r["factors"] else [],
            "reasons": json.loads(r["reasons"]) if r["reasons"] else [],
            "message": r["message"] or "",
            "explanation": r["explanation"] or "",
            "created_at": r["created_at"],
        }
        for r in rows
    ]


_init_db()

_store = _load_from_db()
if _store:
    _id_counter[0] = max(r["id"] for r in _store)


def _append(row: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        _store.insert(0, row)
        del _store[500:]  # в памяти держим последние 500 транзакций
    _insert_db(row)
    return row


def _seed() -> None:
    """Наполняет SQLite синтетическими транзакциями при первом старте."""
    if _store:
        return
    rng = random.Random(42)
    country_pool = ["1", "1", "1", "2", "11", "3", "5", "12"]
    device_pool = ["1", "1", "3", "2", "4", "5"]
    for i in range(64):
        amount = 1_000 + rng.choice([1, 1, 2, 5, 10, 30, 90]) * rng.randint(1500, 90000)
        country_code = rng.choice(country_pool)
        device_code = rng.choice(device_pool)
        velocity = rng.randint(1, 20)
        vpn = 1 if rng.random() < 0.14 else 0
        result = hybrid_risk(
            amount=amount,
            velocity_1h=velocity,
            country_code=country_code,
            device_code=device_code,
            vpn=vpn,
            merchant="Online Payment",
        )
        _append({
            "id": i + 1,
            "amount": amount,
            "country_code": country_code,
            "device_code": device_code,
            "velocity_1h": velocity,
            "vpn": vpn,
            "model_score": result["model_score"],
            "rule_score": result["rule_score"],
            **result,
            "reasons": [f["name"] for f in result["factors"] if f["effect"] > 0][:3],
            "message": f"Транзакция проверена: риск {result['score']}%, статус {result['status']}.",
            "explanation": top_factor_explanation(result),
            "created_at": time.time() - (63 - i) * 37,
        })
    with _lock:
        _id_counter[0] = 64


_seed()


# ---------------------------------------------------------------------------
# Pydantic схемы
# ---------------------------------------------------------------------------


class CheckRequest(BaseModel):
    """Входные признаки транзакции (в том же виде, что шлёт фронтенд)."""

    amount: float = 0.0
    country_code: str = "1"
    device_code: str = "1"
    velocity_1h: int = Field(default=1, ge=0, le=1000)
    vpn: int = Field(default=0, ge=0, le=1)


class BatchRequest(BaseModel):
    """Запрос пакетной симуляции."""

    count: int = Field(default=1000, ge=1, le=200_000)
    total: int | None = Field(default=None, description="Алиас для count")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_response(row: dict[str, Any]) -> dict[str, Any]:
    """Формирует ответ, совместимый со всеми потребителями фронтенда."""
    score = int(row["score"])
    return {
        "id": row["id"],
        "amount": row["amount"],
        "country_code": row["country_code"],
        "device_code": row["device_code"],
        "velocity_1h": row["velocity_1h"],
        "vpn": row["vpn"],
        "score": score,
        "risk_score": round(score / 100.0, 4),
        "status": row["status"],
        "is_fraud": bool(row["is_fraud"]),
        "model_score": row.get("model_score"),
        "rule_score": row.get("rule_score"),
        "reasons": row.get("reasons", []),
        "message": row.get("message", ""),
        "explanation": row.get("explanation", ""),
    }


def _assess_and_store(payload: dict[str, Any], message_prefix: str = "Транзакция проверена") -> dict[str, Any]:
    """Скорит транзакцию (гибрид: ML-модель + правила), сохраняет в store и возвращает строку."""
    result = hybrid_risk(
        amount=payload.get("amount", 0),
        velocity_1h=payload.get("velocity_1h", 1),
        country_code=payload.get("country_code", "1"),
        device_code=payload.get("device_code", "1"),
        vpn=int(payload.get("vpn", 0)),
        merchant=payload.get("merchant", ""),
    )
    reasons = [f["name"] for f in result["factors"] if f["effect"] > 0][:3]
    row = {
        "id": _next_id(),
        "amount": float(payload.get("amount", 0)),
        "country_code": payload.get("country_code", "1"),
        "device_code": payload.get("device_code", "1"),
        "velocity_1h": int(payload.get("velocity_1h", 1)),
        "vpn": int(payload.get("vpn", 0)),
        "score": result["score"],
        "status": result["status"],
        "is_fraud": result["is_fraud"],
        "model_score": result["model_score"],
        "rule_score": result["rule_score"],
        "factors": result["factors"],
        "reasons": reasons,
        "message": f"{message_prefix}: риск {result['score']}%, статус {result['status']}.",
        "explanation": top_factor_explanation(result),
        "created_at": time.time(),
    }
    return _append(row)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/check",
    summary="Проверка одиночной транзакции",
    description=(
        "Принимает признаки транзакции и возвращает риск (score 0–100 и "
        "risk_score 0–1), статус решения и объяснимые факторы."
    ),
)
def check_transaction(payload: CheckRequest) -> dict[str, Any]:
    return _check_response(_assess_and_store(payload.model_dump()))


@router.post("/", summary="Создание транзакции")
@router.post("", summary="Создание транзакции")
def create_transaction(payload: CheckRequest) -> dict[str, Any]:
    """Создаёт транзакцию с оценкой риска (алиас для /check, но добавляет её в ленту)."""
    return _check_response(_assess_and_store(payload.model_dump(), message_prefix="Транзакция создана"))


@router.get("/", summary="Лента транзакций")
@router.get("", summary="Лента транзакций")
def list_transactions(limit: Annotated[int, Query(ge=1, le=500)] = 100) -> list[dict[str, Any]]:
    with _lock:
        rows = list(_store[:limit])
    return [
        {
            "id": r["id"],
            "amount": r["amount"],
            "country_code": r["country_code"],
            "device_code": r["device_code"],
            "velocity_1h": r["velocity_1h"],
            "vpn": r["vpn"],
            "score": r["score"],
            "status": r["status"],
            "is_fraud": r["is_fraud"],
            "model_score": r.get("model_score"),
            "rule_score": r.get("rule_score"),
            "reasons": r.get("reasons", []),
        }
        for r in rows
    ]


@router.get(
    "/stats",
    summary="Агрегированная статистика",
    description="Возвращает KPI обработки: объём, заблокированные, спасённый бюджет, FPR.",
)
def transactions_stats() -> dict[str, Any]:
    with _lock:
        rows = list(_store)

    total = len(rows)
    blocked = sum(1 for r in rows if r["is_fraud"])
    safe = total - blocked
    fraud_loss_saved = sum(r["amount"] for r in rows if r["is_fraud"])
    fpr = round((blocked / total) * 100, 2) if total else 0.0

    return {
        "total_transactions": total,
        "blocked_frauds": blocked,
        "safe_transactions": safe,
        "fraud_loss_saved_tg": round(fraud_loss_saved, 2),
        "false_positive_rate_pct": fpr,
        "model": MODEL_NAME,
    }


@router.post(
    "/batch",
    summary="Пакетная симуляция транзакций",
    description="Генерирует N синтетических транзакций, прогоняет через scorer и возвращает сводку.",
)
def run_batch(payload: BatchRequest) -> dict[str, Any]:
    count = payload.total if payload.total else payload.count
    rng = random.Random(time.time_ns())
    country_pool = ["1", "1", "1", "2", "11", "3", "5", "12", "14", "15"]
    device_pool = ["1", "1", "3", "2", "4", "5"]

    blocked = 0
    blocked_value = 0.0
    score_sum = 0.0

    for _ in range(count):
        amount = 500 + rng.choice([1, 1, 2, 5, 10, 30, 90]) * rng.randint(1200, 90000)
        is_big_fraud = rng.random() < 0.02
        if is_big_fraud:
            amount += rng.randint(8, 20) * 800_000

        country_code = rng.choice(country_pool)
        device_code = rng.choice(device_pool)
        velocity_1h = rng.randint(1, 20)
        vpn = 1 if rng.random() < 0.10 else 0
        merchant = rng.choice(["Online Payment", "Online Payment", "crypto exchange", "bet casino"])

        result = hybrid_risk(
            amount=amount,
            velocity_1h=velocity_1h,
            country_code=country_code,
            device_code=device_code,
            vpn=vpn,
            merchant=merchant,
        )
        score_sum += result["score"]
        if result["is_fraud"]:
            blocked += 1
            blocked_value += amount
        _append({
            "id": _next_id(),
            "amount": amount,
            "country_code": country_code,
            "device_code": device_code,
            "velocity_1h": velocity_1h,
            "vpn": vpn,
            **result,
            "reasons": [f["name"] for f in result["factors"] if f["effect"] > 0][:3],
            "message": "Сгенерировано пакетной симуляцией.",
            "explanation": top_factor_explanation(result),
            "created_at": time.time(),
        })

    avg_score = round(score_sum / count, 1) if count else 0.0
    return {
        "added": count,
        "blocked_frauds": blocked,
        "fraud_loss_saved_tg": round(blocked_value, 2),
        "avg_score": avg_score,
        "model": MODEL_NAME,
    }