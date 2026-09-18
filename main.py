from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import transactions, analytics

Base.metadata.create_all(engine)
app = FastAPI(title="FraudSeeker", version="1.0")

app.include_router(transactions.router)
app.include_router(analytics.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

