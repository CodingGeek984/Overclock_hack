from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import analytics
from api.routes import data
from api.routes import stream

app = FastAPI(title="Fraud Hunter API", version="1.0.0")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Usually we'd restrict this, but for dev it's fine
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(data.router, prefix="/api/v1/data", tags=["Data Processing"])
app.include_router(stream.router, prefix="/api/v1/ws", tags=["WebSocket Stream"])

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Fraud Hunter API is running"}
