from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas, services
from database import get_db

router = APIRouter(prefix="/api/v1/transactions", tags=["Transactions"])

@router.post("/check")
def check_and_save_transaction(dto: schemas.TransactionCreate, db: Session = Depends(get_db)):
    result = services.process_and_check_transaction(db, dto)
    return result

@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return crud.get_fraud_stats(db)

@router.get("/")
def get_all_transactions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    db_transactions = crud.get_transactions(db, skip=skip, limit=limit)

    response = []
    for transaction in db_transactions:

        item = transaction[0] if hasattr(transaction, "_mapping") else transaction

        response.append({
            "id": item.id,
            "amount": item.amount,
            "country_code": item.country_code,
            "device_code": item.device_code,
            "velocity_1h": item.velocity_1h,
            "vpn": item.vpn,
            "is_fraud": item.is_fraud
        })
    return response


