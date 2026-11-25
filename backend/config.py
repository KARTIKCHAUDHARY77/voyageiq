"""
VoyageIQ configuration.

Secrets are read from the environment (or a local, git-ignored .env file).
In production the app refuses to start without real secrets instead of
silently falling back to a value that is public in the repository.
"""

import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

_INSECURE_VALUES = {
    "",
    "change-me",
    "voyageiq-secret-key-2024-maritime",
    "voyageiq-jwt-secret-2024",
    "voyageiq-super-secret-key-2024",
    "voyageiq-super-secret-key-change-in-production",
    "voyageiq-jwt-secret-key-change-in-production",
}


def _secret(name, production):
    value = os.environ.get(name, "")
    if value in _INSECURE_VALUES or len(value) < 32:
        if production:
            raise RuntimeError(
                f"{name} must be set to a random string of at least 32 characters "
                f"(generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
            )
        # Development only: an ephemeral key. Tokens stop working on restart.
        return secrets.token_urlsafe(48)
    return value


def _database_uri():
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url:
        return url
    return f"sqlite:///{os.path.join(os.path.dirname(__file__), 'voyageiq_local.db')}"


class Config:
    PRODUCTION = False

    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Short-lived access token; the client renews it with the refresh token.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=60)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS = {"pdf", "xlsx", "xls", "csv"}

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

    WEATHER_API_BASE = "https://api.open-meteo.com/v1"
    MARINE_API_BASE = "https://marine-api.open-meteo.com/v1"

    # Exact origins only. Set CORS_ORIGINS to a comma-separated list.
    CORS_ORIGINS = [
        o.strip() for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",") if o.strip()
    ]

    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Demo users with published passwords. Never enabled in production
    # unless you explicitly opt in.
    SEED_DEMO_DATA = os.environ.get("SEED_DEMO_DATA", "").lower() == "true"


class DevelopmentConfig(Config):
    DEBUG = False  # flip on with FLASK_DEBUG=1; the Werkzeug debugger allows code execution
    SEED_DEMO_DATA = os.environ.get("SEED_DEMO_DATA", "true").lower() == "true"


class ProductionConfig(Config):
    PRODUCTION = True
    DEBUG = False


def resolve_secrets(app_config, production):
    """Load signing secrets lazily so importing this module never fails in dev."""
    app_config["SECRET_KEY"] = _secret("SECRET_KEY", production)
    app_config["JWT_SECRET_KEY"] = _secret("JWT_SECRET_KEY", production)


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
