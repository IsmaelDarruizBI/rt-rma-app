"""Conjuntos cerrados de valores del dominio RMA.

Alcance MVP: solo los valores que HP-REP-001 necesita. No se anticipan
valores del proceso general (PROC-REP V1.3) que el MVP todavia no
recorre.
"""

from enum import Enum


class OrigenOrden(str, Enum):
    """Origen de la Orden de Reparacion (MVP: solo cliente externo)."""

    CLIENTE_EXTERNO = "CLIENTE_EXTERNO"


class EstadoWorkflow(str, Enum):
    """Hitos de workflow de la Orden fijados por eventos explicitos.

    Los estados operativos intermedios (en cola, en reparacion,
    reparacion lista) no se persisten: son derivables de las tomas,
    ejecuciones y del control de los Detalles.
    """

    REQUERIMIENTO = "REQUERIMIENTO"
    HABILITADA = "HABILITADA"
    ENTREGADA = "ENTREGADA"


class EstadoReparacionDetail(str, Enum):
    """Ciclo tecnico de un Detalle de Reparacion.

    Solo el avance del trabajo. La reserva de insumos vive en
    MovimientoInsumo y la aprobacion en ``ReparacionDetail.control_estado``:
    ninguna de las dos es un estado tecnico del Detalle.
    """

    DEFINIDO = "DEFINIDO"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETO = "COMPLETO"


class EstadoControl(str, Enum):
    """Resultado del control tecnico sobre un Detalle (PROC-REP-220)."""

    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"


class TipoMovimientoInsumo(str, Enum):
    """Tipos de movimiento de inventario trazados a un Detalle."""

    RESERVA = "RESERVA"
    CONSUMO = "CONSUMO"
    LIBERACION_RESERVA = "LIBERACION_RESERVA"
    DEVOLUCION = "DEVOLUCION"


class EstadoTomaOrden(str, Enum):
    """Estado de la participacion activa de un tecnico sobre la Orden."""

    ACTIVA = "ACTIVA"
    CERRADA = "CERRADA"


class EstadoEjecucion(str, Enum):
    """Estado de una Ejecucion concreta de un Detalle."""

    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADO = "COMPLETADO"


class RolUsuario(str, Enum):
    """Rol operativo del usuario dentro de RMA."""

    ADMINISTRADOR = "ADMINISTRADOR"
    RECEPCION = "RECEPCION"
    COORDINADOR_RMA = "COORDINADOR_RMA"
    TECNICO = "TECNICO"


class EstadoPago(str, Enum):
    """Estado de cobro, siempre derivado del total y de lo pagado."""

    PENDIENTE = "PENDIENTE"
    PARCIAL = "PARCIAL"
    PAGADO = "PAGADO"
