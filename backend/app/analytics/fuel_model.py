"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

"""
VoyageIQ AI - Fuel Prediction ML Model
Random Forest Regressor for fuel consumption prediction
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os


class FuelPredictionModel:
    """
    Fuel consumption prediction using Random Forest Regressor.
    
    Features:
        - speed_knots: Vessel speed in knots
        - rpm: Main engine RPM
        - wind_speed: Wind speed in knots
        - wave_height: Wave height in meters
        - current_speed: Ocean current speed in knots
        - distance_nm: Distance in nautical miles
        - displacement_ratio: Cargo loading factor (0-1)
        - trim: Fore/aft trim in meters
    
    Target:
        - fuel_mt: Fuel consumption in metric tons per day
    """
    
    MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'fuel_model.pkl')
    SCALER_PATH = os.path.join(os.path.dirname(__file__), 'models', 'scaler.pkl')
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self._load_or_train()
    
    def _generate_training_data(self, n_samples=5000):
        """Generate synthetic but realistic training data."""
        np.random.seed(42)
        
        speed = np.random.uniform(8, 22, n_samples)
        rpm = speed * 6.5 + np.random.normal(0, 3, n_samples)
        wind = np.random.exponential(8, n_samples).clip(0, 40)
        wave = (wind / 10 + np.random.exponential(0.3, n_samples)).clip(0, 8)
        current = np.random.normal(0, 0.8, n_samples)
        distance = np.random.uniform(100, 400, n_samples)
        displacement_ratio = np.random.uniform(0.4, 1.0, n_samples)
        trim = np.random.normal(0.3, 0.8, n_samples)
        
        # Fuel consumption model (admiralty formula-based)
        # Base: k * speed^3, adjusted for weather and loading
        k = 0.0008 + displacement_ratio * 0.0004
        weather_penalty = 1 + (wind / 100) ** 2 + wave * 0.015 - current * 0.005
        trim_factor = 1 - np.abs(trim) * 0.01
        
        fuel_base = k * speed ** 3 * weather_penalty * trim_factor
        fuel_mt_day = fuel_base * 24 + np.random.normal(0, 1.5, n_samples)
        fuel_mt_day = np.clip(fuel_mt_day, 5, 250)
        
        X = pd.DataFrame({
            'speed_knots': speed,
            'rpm': rpm,
            'wind_speed': wind,
            'wave_height': wave,
            'current_speed': current,
            'distance_nm': distance,
            'displacement_ratio': displacement_ratio,
            'trim': trim
        })
        
        return X, fuel_mt_day
    
    def _load_or_train(self):
        """Load existing model or train a new one."""
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        
        if os.path.exists(self.MODEL_PATH) and os.path.exists(self.SCALER_PATH):
            try:
                self.model = joblib.load(self.MODEL_PATH)
                self.scaler = joblib.load(self.SCALER_PATH)
                return
            except Exception:
                pass
        
        # Train new model
        X, y = self._generate_training_data()
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=12,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        print(f"Fuel model trained: MAE={mae:.2f} MT/day, R²={r2:.4f}")
        
        # Save
        joblib.dump(self.model, self.MODEL_PATH)
        joblib.dump(self.scaler, self.SCALER_PATH)
    
    def predict(self, speed_knots: float, rpm: float = None, wind_speed: float = 0,
                wave_height: float = 0.5, current_speed: float = 0,
                distance_nm: float = 300, displacement_ratio: float = 0.8,
                trim: float = 0.3) -> dict:
        """
        Predict fuel consumption.
        
        Returns:
            dict with predicted_fuel_mt_day, confidence_interval, feature_importance
        """
        if rpm is None:
            rpm = speed_knots * 6.5
        
        X = pd.DataFrame([{
            'speed_knots': speed_knots,
            'rpm': rpm,
            'wind_speed': wind_speed,
            'wave_height': wave_height,
            'current_speed': current_speed,
            'distance_nm': distance_nm,
            'displacement_ratio': displacement_ratio,
            'trim': trim
        }])
        
        X_scaled = self.scaler.transform(X)
        
        # Get predictions from all trees for confidence interval
        tree_predictions = [tree.predict(X_scaled)[0] for tree in self.model.estimators_]
        predicted = float(np.mean(tree_predictions))
        std = float(np.std(tree_predictions))
        
        # Feature importance
        feature_names = X.columns.tolist()
        importance = dict(zip(feature_names, self.model.feature_importances_))
        
        return {
            'predicted_fuel_mt_day': round(predicted, 3),
            'confidence_interval': {
                'lower': round(max(0, predicted - 2 * std), 3),
                'upper': round(predicted + 2 * std, 3)
            },
            'confidence_score': round(1 - (std / predicted) if predicted > 0 else 0, 3),
            'weather_impact_pct': round((wind_speed * 0.3 + wave_height * 2), 2),
            'feature_importance': {k: round(float(v), 4) for k, v in importance.items()},
            'model_version': '1.0.0-rf'
        }
    
    def predict_for_speed_range(self, speeds: list, **kwargs) -> list:
        """Predict fuel consumption for a range of speeds (for simulator)."""
        return [self.predict(speed, **kwargs) for speed in speeds]


# Global model instance
_fuel_model = None

def get_fuel_model() -> FuelPredictionModel:
    global _fuel_model
    if _fuel_model is None:
        _fuel_model = FuelPredictionModel()
    return _fuel_model


class ETAPredictionModel:
    """Simple ETA prediction based on weather-adjusted speed."""
    
    def predict_eta(self, distance_nm: float, base_speed: float,
                    wind_speed: float = 0, wave_height: float = 0.5,
                    current_speed: float = 0, current_favorable: bool = True) -> dict:
        """
        Predict ETA with weather adjustments.
        
        Args:
            distance_nm: Distance in nautical miles
            base_speed: Design/warranted speed in knots
            wind_speed: Wind speed in knots
            wave_height: Wave height in meters
            current_speed: Ocean current in knots
            current_favorable: Is current favorable or adverse?
        
        Returns:
            dict with adjusted_speed, duration_hours, eta_hours_from_now
        """
        # Speed penalties from weather
        wind_penalty = min(0.15, (wind_speed / 40) ** 2 * 0.15)
        wave_penalty = min(0.12, wave_height * 0.025)
        
        # Current effect
        current_effect = current_speed * 0.8 if current_favorable else -current_speed * 0.8
        
        adjusted_speed = max(4, base_speed * (1 - wind_penalty - wave_penalty) + current_effect)
        duration_hours = distance_nm / adjusted_speed
        
        # Uncertainty (95% confidence)
        uncertainty_hrs = duration_hours * 0.05 + (wind_speed / 30) * 2
        
        return {
            'adjusted_speed': round(adjusted_speed, 2),
            'duration_hours': round(duration_hours, 2),
            'duration_days': round(duration_hours / 24, 2),
            'uncertainty_hours': round(uncertainty_hrs, 2),
            'wind_penalty_pct': round(wind_penalty * 100, 2),
            'wave_penalty_pct': round(wave_penalty * 100, 2),
            'current_effect_knots': round(current_effect, 2)
        }
