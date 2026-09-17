from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class KPIData(BaseModel):
    total_transactions: int
    fraud_loss_saved: float
    false_positive_rate: float

class TradeoffDataPoint(BaseModel):
    threshold: float
    precision: float
    recall: float
    fraud_loss: float
    customer_inconvenience: float

@router.get("/kpis", response_model=KPIData)
def get_kpis():
    # Return mock data as requested
    return KPIData(
        total_transactions=100000,
        fraud_loss_saved=1250000.0,
        false_positive_rate=1.2
    )

@router.get("/tradeoff", response_model=List[TradeoffDataPoint])
def get_tradeoff_data():
    # Generate mock tradeoff data demonstrating ML metrics vs Financial losses
    data = []
    # threshold from 0.0 to 1.0
    for i in range(11):
        threshold = i / 10.0
        # as threshold increases: 
        # precision increases (more sure it's fraud)
        # recall decreases (we catch less fraud)
        precision = 0.5 + (threshold * 0.45) # 0.5 to 0.95
        recall = 0.95 - (threshold * 0.45) # 0.95 to 0.5
        
        # Fraud loss (FN * Fraud_Amount) -> inversely proportional to recall
        fraud_loss = (1.0 - recall) * 500000 
        
        # Customer inconvenience (FP * Friction_Penalty) -> inversely proportional to precision
        # (more false positives = more inconvenience)
        customer_inconvenience = (1.0 - precision) * 200000
        
        data.append(TradeoffDataPoint(
            threshold=threshold,
            precision=round(precision, 3),
            recall=round(recall, 3),
            fraud_loss=round(fraud_loss, 2),
            customer_inconvenience=round(customer_inconvenience, 2)
        ))
        
    return data
