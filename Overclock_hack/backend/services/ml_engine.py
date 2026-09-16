import numpy as np

class FraudMLEngine:
    def __init__(self):
        # In a real scenario, load pretrained LightGBM / XGBoost / Isolation Forest model here
        self.model = None

    def predict_risk_score(self, features: np.ndarray) -> np.ndarray:
        # Mock prediction returning a risk score between 0 and 100%
        # features shape: (n_samples, n_features)
        n_samples = features.shape[0]
        # Simulate risk scores skewed towards 0 (most transactions are legit)
        # Using a beta distribution
        risk_scores = np.random.beta(a=0.5, b=5, size=n_samples) * 100
        return risk_scores

    def calculate_cost(self, y_true: np.ndarray, y_pred_prob: np.ndarray, threshold: float, fraud_amounts: np.ndarray, friction_penalty: float) -> float:
        """
        Calculate total cost for a given threshold.
        Cost = (FN * Fraud_Amount) + (FP * Friction_Penalty)
        """
        y_pred = (y_pred_prob >= threshold).astype(int)
        
        # False Negatives: True fraud (1) predicted as legit (0)
        fn_mask = (y_true == 1) & (y_pred == 0)
        fn_cost = np.sum(fraud_amounts[fn_mask])
        
        # False Positives: True legit (0) predicted as fraud (1)
        fp_mask = (y_true == 0) & (y_pred == 1)
        fp_cost = np.sum(fp_mask) * friction_penalty
        
        return fn_cost + fp_cost

    def find_optimal_threshold(self, y_true: np.ndarray, y_pred_prob: np.ndarray, fraud_amounts: np.ndarray, friction_penalty: float = 200.0) -> dict:
        """
        Search for the threshold that minimizes the custom cost function.
        Returns the optimal threshold and minimal cost.
        """
        thresholds = np.linspace(0, 100, 101) # 0 to 100%
        best_threshold = 0.0
        min_cost = float('inf')
        
        for t in thresholds:
            cost = self.calculate_cost(y_true, y_pred_prob, t, fraud_amounts, friction_penalty)
            if cost < min_cost:
                min_cost = cost
                best_threshold = t
                
        return {
            "optimal_threshold": best_threshold,
            "min_cost": min_cost
        }
