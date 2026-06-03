"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""
# analytics package
from .fuel_model import FuelPredictionModel, ETAPredictionModel, get_fuel_model

__all__ = ['FuelPredictionModel', 'ETAPredictionModel', 'get_fuel_model']
