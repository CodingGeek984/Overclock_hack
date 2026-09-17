import asyncio
import json
import random
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

def generate_mock_transaction():
    """Generates a single synthetic transaction with Explainable AI features."""
    tx_id = str(uuid.uuid4())[:8]
    user_id = f"U{random.randint(1000, 9999)}"
    amount = round(random.uniform(10.0, 5000.0), 2)
    
    # 80% chance of being normal, 20% chance of being an anomaly (fraud-like)
    is_anomaly = random.random() < 0.2
    
    if is_anomaly:
        amount_z_score = round(random.uniform(3.0, 8.0), 2)  # High deviation
        travel_speed = round(random.uniform(900.0, 3000.0), 2)  # Impossible speed (km/h)
        velocity_1h = random.randint(15, 50)  # Too many tx in 1h
        risk_score = round(random.uniform(70.0, 99.9), 1)
    else:
        amount_z_score = round(random.uniform(-1.0, 1.5), 2)  # Normal deviation
        travel_speed = round(random.uniform(0.0, 150.0), 2)  # Normal speed
        velocity_1h = random.randint(1, 5)  # Normal tx frequency
        risk_score = round(random.uniform(1.0, 30.0), 1)
        
    return {
        "id": tx_id,
        "user_id": user_id,
        "amount": amount,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": random.choice(["New York, US", "London, UK", "Tokyo, JP", "Berlin, DE", "Sydney, AU", "Lagos, NG"]),
        "risk_score": risk_score,
        "features": {
            "amount_z_score": amount_z_score,
            "travel_speed": travel_speed,
            "velocity_1h": velocity_1h
        }
    }

@router.websocket("/transactions")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Generate 1 to 3 transactions per batch
            batch_size = random.randint(1, 3)
            for _ in range(batch_size):
                tx = generate_mock_transaction()
                await websocket.send_text(json.dumps(tx))
            
            # Wait 2-5 seconds before next batch
            await asyncio.sleep(random.uniform(2.0, 5.0))
            
    except WebSocketDisconnect:
        print("Client disconnected from transaction stream")
