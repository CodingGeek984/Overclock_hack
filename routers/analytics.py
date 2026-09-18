from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
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

    return {
        "total_transactions": stats["total_transactions"],
        "blocked_frauds": stats["blocked_frauds"],
        "safe_transactions": stats["safe_transactions"]
    }

@router.get("/model/config")
def model_config():
    return {
        "model_type": "Random Forest",
        "version": "1.0",
        "threshold": 0.6
    }