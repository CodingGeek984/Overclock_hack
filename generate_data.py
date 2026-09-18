import pandas as pd
import numpy as np
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://postgres:12345@localhost:5432/fraudseeker_db"


def generate_and_seed():
    n = 100000

    is_fraud = np.random.choice([False, True], size=n, p=[0.95, 0.05])

    amounts = np.where(is_fraud, np.random.randint(200000, 1500000, n), np.random.randint(1000, 75000, n))
    country_codes = np.where(is_fraud, np.random.choice(['2', '3', '4'], n), np.random.choice(['1', '1', '2'], n))
    device_codes = np.random.choice(['1', '2', '3'], n)
    velocities = np.where(is_fraud, np.random.randint(5, 25, n), np.random.randint(1, 5, n))
    vpns = np.where(is_fraud, np.random.choice([0, 1], n, p=[0.1, 0.9]), np.random.choice([0, 1], n, p=[0.95, 0.05]))

    df = pd.DataFrame({
        "amount": amounts,
        "country_code": country_codes,
        "device_code": device_codes,
        "velocity_1h": velocities,
        "vpn": vpns,
        "is_fraud": is_fraud
    })

    engine = create_engine(DATABASE_URL)
    df.to_sql('transaction', engine, if_exists='append', index=False, chunksize=10000)

if __name__ == "__main__":
    generate_and_seed()