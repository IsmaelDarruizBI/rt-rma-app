"""
TRACEABILITY DEMO
TASK-REP-001
TR-REP-001
FR-REP-001
ACC-REP-001
US-REP-001
FEAT-REP-001
PROC-REP-040

Proof of concept de trazabilidad end-to-end (rama `test`). Demuestra como
un nodo del proceso de negocio puede decantar hasta codigo, y como leer
esta cadena de comentarios en sentido inverso (de codigo hacia arriba). No
es la arquitectura aprobada de RMA: no implementa persistencia, API ni
autenticacion, y no incorpora reglas que todavia no fueron definidas con
el negocio.
"""

import itertools
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

RepairOrderOrigin = Literal[
    "CLIENTE_EXTERNO",
    "RT_INTERNO",
    "RT_GARANTIA_VENTA",
    "RMA_GARANTIA_REPARACION",
]

RepairOrderStatus = Literal["REQUERIMIENTO"]

_id_sequence = itertools.count(1)


@dataclass
class RepairOrder:
    id: str
    origin: RepairOrderOrigin
    equipment_id: str
    customer_id: Optional[str]
    status: RepairOrderStatus
    created_by: str
    created_at: datetime


def _next_repair_order_id() -> str:
    return f"OR-{next(_id_sequence):06d}"


def create_repair_order(
    origin: RepairOrderOrigin,
    equipment_id: str,
    created_by: str,
    customer_id: Optional[str] = None,
) -> RepairOrder:
    """
    Crea conceptualmente una Orden de Reparacion en su estado inicial
    REQUERIMIENTO, a partir del equipo y origen ya identificados. No
    persiste nada: es codigo de demostracion para el proof of concept de
    trazabilidad.
    """
    return RepairOrder(
        id=_next_repair_order_id(),
        origin=origin,
        equipment_id=equipment_id,
        customer_id=customer_id,
        status="REQUERIMIENTO",
        created_by=created_by,
        created_at=datetime.now(),
    )
