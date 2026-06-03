"""
VoyageIQ AI — Maritime Intelligence Platform
Copyright (c) 2024 Kartik Chaudhary. All Rights Reserved.
Unauthorized copying or use of this file is strictly prohibited.
Contact: 2512520007@geu.ac.in
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'voyageiq-secret-key-2024-maritime')
    # Use SQLite locally (no install needed), PostgreSQL in production via DATABASE_URL
    _db_url = os.environ.get('DATABASE_URL', '')
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = _db_url if _db_url else \
        f"sqlite:///{os.path.join(os.path.dirname(__file__), 'voyageiq_local.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
    }

    
    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'voyageiq-jwt-secret-2024')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # File uploads
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {'pdf', 'xlsx', 'xls', 'csv'}
    
    # OpenAI
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
    
    # Weather API (Open-Meteo - free, no key required)
    WEATHER_API_BASE = 'https://api.open-meteo.com/v1'
    MARINE_API_BASE = 'https://marine-api.open-meteo.com/v1'
    
    # CORS — allow localhost dev + any Vercel deployment
    _cors_env = os.environ.get('CORS_ORIGINS', '')
    CORS_ORIGINS = _cors_env.split(',') if _cors_env else [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://voyageiq.vercel.app',
        'https://voyageiq-frontend.vercel.app',
        'https://voyageiq-eaif.vercel.app',
    ]
    CORS_SUPPORTS_CREDENTIALS = True


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_ECHO = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
