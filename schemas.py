from pydantic import BaseModel, ConfigDict


class TransactionCreate(BaseModel):
    amount: float
    country_code: str
    device_code: str
    velocity_1h: float
    vpn: int

class TransactionResponse(TransactionCreate):
    id: int
    is_fraud: bool

    model_config = ConfigDict(from_attributes=True)