from sqlalchemy import Column, Float, Integer, String, Boolean

from database import Base


class TransactionItem(Base):
    __tablename__ = "transaction"

    id = Column(Integer, primary_key=True, index=True)

    amount = Column(Float, nullable=False)
    country_code = Column(String, nullable=False)
    device_code = Column(String, nullable=False)
    velocity_1h = Column(Float, nullable=False)
    vpn = Column(Integer, nullable=False, default=0)

    is_fraud=Column (Boolean, nullable=False)