import pandas as pd
import numpy as np
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
import joblib


smote = SMOTE(random_state=42)
np.random.seed(42)
n_samples = 10000
df = pd.DataFrame({
    'amount': np.random.exponential(scale=15000, size=n_samples),
    'country_code': np.random.randint(1, 10, size=n_samples),
    'device_code': np.random.randint(1, 4, size=n_samples),
    'velocity_1h': np.random.randint(1, 15, size=n_samples),
    'vpn': np.random.randint(0, 2, size=n_samples)
})

rule_one = df['is_fraud'] = np.where((df['amount'] > 50000) & (df['country_code'] != 1) & (df['vpn'] == 1), 1, 0)
rule_two = (df['velocity_1h'] > 10) & (df['country_code'] == 3)

noise = np.random.choice([0, 1], size=n_samples, p=[0.95, 0.05])
df['is_fraud'] = np.where(noise == 1, 1 - df['is_fraud'], df['is_fraud'])
df['is_fraud'] = np.where(rule_one | rule_two, 1, 0)

fraud_pipeline = Pipeline([
    ('balancer', SMOTE(random_state=42)),
    ('classifier', RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)),
])


feature_columns = ['amount', 'country_code', 'device_code', 'velocity_1h', 'vpn']
X = df[feature_columns]

y = df['is_fraud']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)


fraud_pipeline.fit(X_train, y_train)
y_pred = fraud_pipeline.predict(X_test)

print(classification_report(y_test, y_pred))

joblib.dump(fraud_pipeline, 'fraud_model.joblib')
joblib.dump(feature_columns, 'model_features.joblib')

