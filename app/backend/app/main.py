"""Punto de entrada de la aplicacion FastAPI del MVP.

Se limita a construir la app, configurar CORS para el frontend Vite y
registrar los routers disponibles.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health
from app.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye y configura la instancia de FastAPI."""
    settings = settings or get_settings()

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health.router)

    return application


app = create_app()
