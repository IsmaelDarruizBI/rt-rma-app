"""Equipo recibido para reparacion."""

from pydantic import BaseModel


class Equipo(BaseModel):
    """Equipo fisico asociado a una Orden de Reparacion."""

    id: str
    marca: str
    modelo: str
    falla_reportada: str
    imei: str | None = None
    numero_serie: str | None = None
