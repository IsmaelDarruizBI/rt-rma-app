"""Modelos de dominio del MVP de Rosario Tecno RMA App.

Alcance: lo necesario para representar el escenario HP-REP-001
("Reparacion estandar de cliente externo") de PROC-REP V1.3. Los modelos
no leen ni derivan nada de ``business/``: esa sigue siendo la unica
fuente de verdad funcional, y aqui solo se conservan sus IDs
(``HistorialWorkflow.process_id``).
"""

from .catalogos import (
    EstacionTrabajo,
    Insumo,
    TipoReparacion,
    TipoReparacionEstacion,
    TipoReparacionInsumos,
)
from .documentos import Documento, DocumentosOrden
from .enums import (
    EstadoControl,
    EstadoEjecucion,
    EstadoPago,
    EstadoReparacionDetail,
    EstadoTomaOrden,
    EstadoWorkflow,
    OrigenOrden,
    RolUsuario,
    TipoMovimientoInsumo,
)
from .equipos import Equipo
from .inventario import MovimientoInsumo
from .orden_reparacion import OrdenReparacion
from .pagos import Pago, ResumenPago
from .personas import Cliente, Usuario
from .reparacion import EjecucionReparacion, ReparacionDetail, TomaOrden
from .workflow import HistorialWorkflow

__all__ = [
    # Enums
    "EstadoControl",
    "EstadoEjecucion",
    "EstadoPago",
    "EstadoReparacionDetail",
    "EstadoTomaOrden",
    "EstadoWorkflow",
    "OrigenOrden",
    "RolUsuario",
    "TipoMovimientoInsumo",
    # Personas y equipo
    "Cliente",
    "Equipo",
    "Usuario",
    # Catalogos
    "EstacionTrabajo",
    "Insumo",
    "TipoReparacion",
    "TipoReparacionEstacion",
    "TipoReparacionInsumos",
    # Trabajo tecnico
    "EjecucionReparacion",
    "ReparacionDetail",
    "TomaOrden",
    # Inventario
    "MovimientoInsumo",
    # Pagos
    "Pago",
    "ResumenPago",
    # Documentos
    "Documento",
    "DocumentosOrden",
    # Workflow
    "HistorialWorkflow",
    # Aggregate raiz
    "OrdenReparacion",
]
