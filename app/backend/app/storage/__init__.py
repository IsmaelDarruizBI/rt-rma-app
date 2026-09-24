"""Capa de storage: implementaciones concretas de persistencia.

En el MVP la implementacion es file-based (JSON bajo ``data/``), en
``app.storage.json``. Cumple los contratos de ``app.repositories`` y
puede reemplazarse -por Cloud Storage, una base de datos u otro backend-
sin tocar ``domain`` ni ``services``.
"""

from .json import JsonCatalogosRepository, JsonOrdenReparacionRepository

__all__ = [
    "JsonCatalogosRepository",
    "JsonOrdenReparacionRepository",
]
