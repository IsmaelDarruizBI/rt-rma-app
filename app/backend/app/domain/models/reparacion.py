"""Trabajo tecnico de la Orden: Detalle, toma de Orden y Ejecucion.

Relacion conceptual:

    OrdenReparacion -> TomaOrden -> EjecucionReparacion -> ReparacionDetail
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from .enums import (
    EstadoControl,
    EstadoEjecucion,
    EstadoReparacionDetail,
    EstadoTomaOrden,
)


class ReparacionDetail(BaseModel):
    """Trabajo tecnico requerido dentro de una Orden.

    ``precio``, ``puntaje`` y ``garantia_dias`` son snapshots tomados del
    TipoReparacion al crear el Detalle: no se releen del catalogo, para
    que un cambio de precio futuro no altere ordenes ya registradas. Por
    eso solo se guarda ``tipo_reparacion_id``, nunca el objeto.
    """

    id: str
    tipo_reparacion_id: str

    precio: Decimal = Field(ge=0)
    puntaje: int = Field(ge=0)
    garantia_dias: int = Field(ge=0)

    estado: EstadoReparacionDetail = EstadoReparacionDetail.DEFINIDO

    control_estado: EstadoControl = EstadoControl.PENDIENTE
    control_usuario_id: str | None = None
    control_fecha: datetime | None = None
    control_observaciones: str | None = None

    observaciones: str | None = None


class TomaOrden(BaseModel):
    """Participacion activa de un tecnico sobre la Orden completa.

    Distinta de la Ejecucion de un Detalle: una toma puede abarcar varias
    Ejecuciones. Al cerrarse se registra ``fin`` y el estado pasa a
    CERRADA, de modo que una Orden entregada no conserva tomas activas.
    """

    id: str
    usuario_id: str
    estacion_id: str
    estado: EstadoTomaOrden = EstadoTomaOrden.ACTIVA
    inicio: datetime
    fin: datetime | None = None


class EjecucionReparacion(BaseModel):
    """Ejecucion concreta de un Detalle dentro de una toma de Orden."""

    id: str
    reparacion_detail_id: str
    toma_orden_id: str
    usuario_id: str
    estado: EstadoEjecucion = EstadoEjecucion.EN_PROGRESO
    inicio: datetime
    fin: datetime | None = None
    observaciones: str | None = None
