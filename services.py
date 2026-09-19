import joblib
import pandas as pd
from numba.cuda.cudadrv.devicearray import lru_cache
from sklearn.metrics import precision_score, recall_score
from sqlalchemy.orm import Session
import crud, schemas
from database import engine

pipeline = joblib.load('fraud_model.joblib')
features = joblib.load('model_features.joblib')

def process_and_check_transaction(db: Session, dto: schemas.TransactionCreate):
    tx_data = dto.model_dump()
    df = pd.DataFrame([tx_data])[features]

    prediction = pipeline.predict(df)[0]
    probability = pipeline.predict_proba(df)[0][1]

    is_fraud_pred = bool(prediction)
    explanation = generate_explanation(dto, probability)

    saved_record = crud.create_transaction(db, dto, is_fraud=is_fraud_pred)

    return {
        "id": saved_record.id,
        "is_fraud": is_fraud_pred,
        "risk_score": round(float(probability), 3),
        "message": "Транзакция заблокирована" if is_fraud_pred else "Транзакция прошла успешно",
        "explanation": explanation
    }

def generate_explanation(dto: schemas.TransactionCreate, probability: float) -> str:
    reasons = []

    if dto.amount > 50000:
        reasons.append(f"высокая сумма транзакции ({dto.amount} тенге)")
    if dto.country_code != 1:
        reasons.append(f"код другой страны ({dto.country_code})")
    if dto.vpn == 1:
        headers = "активный VPN/proxy"
        reasons.append(headers)
    if dto.velocity_1h > 10:
        reasons.append(f"высокая частота операций за час ({dto.velocity_1h})")
    if dto.device_code == 3:
        reasons.append("неизвестное устройство")

    if not reasons:
        return "Транзакция стабильна, отклонений от нормы не обнаружено."

    reasons_str = ", ".join(reasons)
    return f"Риск: {(probability * 100)}%. Обнаружены факторы - {reasons_str}"

def calculate_metrics():
    query = "SELECT amount, country_code, device_code, velocity_1h, vpn, is_fraud FROM transaction ORDER BY id DESC LIMIT 5000"
    df = pd.read_sql(query, engine)

    if df.empty or len(df['is_fraud'].unique()) < 2:
        return {"precision": 0.0, "recall": 0.0, "optimal_threshold": 60}

    X = df.drop(columns=['is_fraud'])
    y_true = df['is_fraud'].astype(int)

    y_proba = pipeline.predict_proba(X)[:, 1]

    threshold_value = 0.60
    y_pred = (y_proba >= threshold_value).astype(int)

    precision = precision_score(y_true, y_pred, zero_division=0) * 100
    recall = recall_score(y_true, y_pred, zero_division=0) * 100

    return {
        "precision": round(precision, 1),
        "recall": round(recall, 1),
        "optimal_threshold": int(threshold_value * 100)
    }
