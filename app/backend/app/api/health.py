"""Endpoint de health.

Solo confirma que el proceso FastAPI esta levantado. No consulta
dependencias externas ni estado de negocio.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    """Devuelve el estado basico del servicio."""
    return {"status": "ok"}
