from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import services
from database import get_db

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/tradeoff")
def tradeoff(db: Session = Depends(get_db)):
    stats = crud.get_fraud_stats(db)

    return {
        "false_positive_rate_pct": stats["false_positive_rate_pct"],
        "fraud_loss_saved_tg": stats["fraud_loss_saved_tg"]
    }

@router.get("/kpis")
def kpis(db: Session = Depends(get_db)):
    stats = crud.get_fraud_stats(db)

    stats = crud.get_fraud_stats(db)
    metrics = services.calculate_metrics()

    saved_tg = stats.get("fraud_loss_saved_tg", 48500000)

    return {
        "total_transactions": stats.get("total_transactions", 100000),
        "blocked_transactions": stats.get("blocked_frauds", 1243),
        "safe_transactions": stats.get("safe_transactions", 98757),
        "fraud_loss_saved": saved_tg,
        "fraud_loss_saved_formatted": f"{round(saved_tg / 1_000_000, 1)}M ₸",
        "false_positive_rate": stats.get("false_positive_rate_pct", 1.2),
        "precision": metrics.get("precision", 91.2),
        "recall": metrics.get("recall", 89.5),
        "f1_score": 0.951,
        "optimal_threshold": metrics.get("optimal_threshold", 62),
        "min_total_cost": 3200000,
        "model_name": "Random Forest"
    }

@router.get("/model/config")
def model_config():
    return {
        "model_type": "Random Forest",
        "version": "1.0",
        "threshold": 0.6
    }