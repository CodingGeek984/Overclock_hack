import pandas as pd
import numpy as np

class FeatureEngineeringPipeline:
    def __init__(self):
        pass

    def calculate_amount_z_score(self, df: pd.DataFrame, user_col: str = 'user_id', amount_col: str = 'amount', date_col: str = 'timestamp') -> pd.DataFrame:
        # Calculates deviation of current transaction amount from average of last 30 days
        # For simplicity in this mock, we use a simple grouped z-score
        
        # Calculate mean and std per user
        user_stats = df.groupby(user_col)[amount_col].agg(['mean', 'std']).reset_index()
        user_stats = user_stats.rename(columns={'mean': 'user_mean_amount', 'std': 'user_std_amount'})
        
        # Merge back
        df = df.merge(user_stats, on=user_col, how='left')
        
        # Calculate Z-score, handle division by zero
        df['amount_z_score'] = np.where(
            df['user_std_amount'] > 0, 
            (df[amount_col] - df['user_mean_amount']) / df['user_std_amount'], 
            0
        )
        return df

    def calculate_impossible_travel(self, df: pd.DataFrame, user_col: str = 'user_id', lat_col: str = 'lat', lon_col: str = 'lon', time_col: str = 'timestamp') -> pd.DataFrame:
        # Simplistic calculation of distance / time between consecutive transactions
        # Requires sorted dataframe by user and time
        df = df.sort_values(by=[user_col, time_col])
        
        # Calculate distance (simplified Euclidean for demo, should use Haversine)
        df['prev_lat'] = df.groupby(user_col)[lat_col].shift(1)
        df['prev_lon'] = df.groupby(user_col)[lon_col].shift(1)
        df['prev_time'] = df.groupby(user_col)[time_col].shift(1)
        
        # Distance (mock)
        df['distance'] = np.sqrt((df[lat_col] - df['prev_lat'])**2 + (df[lon_col] - df['prev_lon'])**2)
        
        # Time diff in hours
        df['time_diff_hours'] = (df[time_col] - df['prev_time']).dt.total_seconds() / 3600.0
        
        # Speed = distance / time
        df['travel_speed'] = np.where(
            df['time_diff_hours'] > 0,
            df['distance'] / df['time_diff_hours'],
            0
        )
        
        # Flag if speed > reasonable threshold (e.g., speed of sound/commercial flight)
        df['impossible_travel_flag'] = (df['travel_speed'] > 1000).astype(int)
        
        return df

    def calculate_velocity_features(self, df: pd.DataFrame, user_col: str = 'user_id', time_col: str = 'timestamp') -> pd.DataFrame:
        # Calculate transaction counts in 5m, 1h, 24h windows
        df = df.sort_values(by=[user_col, time_col]).set_index(time_col)
        
        for window_name, window_time in [('5m', '5min'), ('1h', '1h'), ('24h', '24h')]:
            # Rolling count
            counts = df.groupby(user_col).rolling(window_time).count().reset_index(level=0, drop=True)
            # Take just one column to represent count
            col_name = counts.columns[0]
            df[f'velocity_count_{window_name}'] = counts[col_name]
            
        return df.reset_index()

    def run_pipeline(self, df: pd.DataFrame) -> pd.DataFrame:
        # Example runner
        df = self.calculate_amount_z_score(df)
        df = self.calculate_impossible_travel(df)
        df = self.calculate_velocity_features(df)
        return df
