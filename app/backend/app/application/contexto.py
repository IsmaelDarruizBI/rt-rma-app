"""Contexto de aplicacion: dependencias que todo caso de uso necesita.

Los casos de uso de ``app.application`` no construyen repositories ni
leen configuracion: reciben este contexto. Asi la API puede armarlo una
vez al arrancar y un test puede armar otro apuntando a ``tmp_path``.

No contiene reglas de negocio: solo los dos repositories y el reloj.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.core.config import Settings
from app.repositories import CatalogosRepository, OrdenReparacionRepository
from app.storage import JsonCatalogosRepository, JsonOrdenReparacionRepository


def _ahora_utc() -> datetime:
    """Momento actual en UTC, con timezone explicita."""
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class ApplicationContext:
    """Dependencias de infraestructura de los casos de uso."""

    ordenes: OrdenReparacionRepository
    catalogos: CatalogosRepository
    ahora: Callable[[], datetime] = field(default=_ahora_utc)


def construir_contexto(settings: Settings) -> ApplicationContext:
    """Arma el contexto con el almacenamiento JSON configurado.

    Los directorios salen de ``RMA_DATA_DIR``; los repositories los
    crean si faltan.
    """
    return ApplicationContext(
        ordenes=JsonOrdenReparacionRepository(settings.ordenes_dir),
        catalogos=JsonCatalogosRepository(settings.catalogos_dir),
    )
