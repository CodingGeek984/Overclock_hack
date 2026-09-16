from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
import time

router = APIRouter()

class StreamSimulationRequest(BaseModel):
    rate_per_second: int

class UploadResponse(BaseModel):
    status: str
    message: str
    records_processed: int

def process_stream_background(rate: int):
    # Simulate processing stream at a given rate
    # In a real scenario, this would push to Kafka/RabbitMQ or a processing queue
    pass

@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    # Simulate saving/processing the dataset
    # E.g., read CSV/Parquet into pandas and trigger feature engineering
    # For now, return a successful mock response for 100,000 records
    return UploadResponse(
        status="success",
        message=f"File {file.filename} uploaded successfully.",
        records_processed=100000
    )

@router.post("/stream")
async def simulate_stream(req: StreamSimulationRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_stream_background, req.rate_per_second)
    return {"status": "success", "message": f"Started stream simulation at {req.rate_per_second} req/s"}
