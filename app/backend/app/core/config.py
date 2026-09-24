"""Configuracion tecnica transversal del backend MVP.

Parametrizable por variables de entorno con prefijo ``RMA_`` (por
ejemplo ``RMA_CORS_ALLOW_ORIGINS``). No contiene reglas de negocio.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Ajustes de la aplicacion, con valores por defecto de desarrollo."""

    model_config = SettingsConfigDict(
        env_prefix="RMA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Rosario Tecno RMA API"
    app_version: str = "0.1.0"

    # Origenes permitidos para el frontend Vite en desarrollo local.
    cors_allow_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    """Devuelve los ajustes cacheados para toda la vida del proceso."""
    return Settings()
