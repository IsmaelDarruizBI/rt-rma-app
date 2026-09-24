"""Traza del recorrido de la Orden por el Business Process."""

from datetime import datetime

from pydantic import BaseModel


class HistorialWorkflow(BaseModel):
    """Paso registrado del recorrido de la Orden.

    ``process_id`` conserva el ID funcional tal como esta definido en
    ``business/`` (por ejemplo ``PROC-REP-185``), sin enum ni
    renombramiento, para no duplicar esa fuente de verdad y mantener la
    trazabilidad con el modelo funcional.
    """

    process_id: str
    accion: str
    fecha: datetime

    usuario_id: str | None = None
    reparacion_detail_id: str | None = None
    ejecucion_id: str | None = None
    observacion: str | None = None
