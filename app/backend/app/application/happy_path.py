"""Lectura del avance de una Orden sobre HP-REP-001.

Dos preguntas que la UI necesita y que no le corresponde responder a
ella, porque dependen del proceso funcional y no de la pantalla:

    1. Por que nodos de HP-REP-001 ya paso esta Orden.
    2. Que accion humana corresponde ahora, y a que rol.

Las dos se derivan del estado de la Orden. Nada de esto autoriza nada:
la autorizacion y las precondiciones las siguen validando los services
cuando el comando llega. Esto es solo lo que la pantalla puede ofrecer.

El recorrido replica el de ``HP-REP-001`` en
``business/scenarios/repair-management-scenarios-v1.3.yaml``. Los IDs
``PROC-REP-*`` se citan; ``business/`` sigue siendo la fuente de verdad.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.domain.models import (
    EstadoControl,
    EstadoReparacionDetail,
    EstadoWorkflow,
    OrdenReparacion,
    RolUsuario,
)
from app.services import ejecucion_activa, toma_activa

# Nodos de HP-REP-001 en el orden en que el escenario los recorre.
# ``EVT-REP-999`` no genera historial: se alcanza cuando la Orden queda
# en ese ``current_process``.
NODOS_HAPPY_PATH: tuple[tuple[str, str], ...] = (
    ("PROC-REP-010", "Identificar origen"),
    ("PROC-REP-030", "Registrar cliente y equipo"),
    ("PROC-REP-040", "Crear Orden"),
    ("PROC-REP-045", "Detalles conocidos"),
    ("PROC-REP-070", "Definir Detalles"),
    ("PROC-REP-050", "Requiere comprobante de recepcion"),
    ("PROC-REP-060", "Generar comprobante de recepcion"),
    ("PROC-REP-080", "Validar factibilidad"),
    ("PROC-REP-090", "Existe Detalle trabajable"),
    ("PROC-REP-140", "Habilitar Orden"),
    ("PROC-REP-150", "Definir prioridad"),
    ("PROC-REP-170", "Ingresar a cola"),
    ("PROC-REP-172", "Validar estacion de trabajo"),
    ("PROC-REP-180", "Tomar Orden"),
    ("PROC-REP-181", "Seleccionar Detalle"),
    ("PROC-REP-174", "Estacion habilitada para el Detalle"),
    ("PROC-REP-185", "Reservar insumos e iniciar Ejecucion"),
    ("PROC-REP-190", "Ejecutar Detalle"),
    ("PROC-REP-200", "Registrar ejecucion real"),
    ("PROC-REP-210", "Aplicar movimientos de inventario"),
    ("PROC-REP-211", "Evaluar situacion de la Orden"),
    ("PROC-REP-220", "Realizar control tecnico"),
    ("PROC-REP-230", "Todos los Detalles aprobados"),
    ("PROC-REP-245", "Calcular puntaje"),
    ("PROC-REP-240", "Marcar reparacion lista"),
    ("PROC-REP-250", "Requiere entrega a cliente"),
    ("PROC-REP-260", "Notificar cliente"),
    ("PROC-REP-265", "Validar condicion de entrega"),
    ("PROC-REP-266", "Saldo pendiente"),
    ("PROC-REP-280", "Generar comprobante final"),
    ("PROC-REP-270", "Entregar equipo"),
    ("EVT-REP-999", "Proceso finalizado"),
)

# Codigos de accion que la API expone. Cada uno es exactamente un
# endpoint de comando.
ACCION_DEFINIR_REPARACION = "DEFINIR_REPARACION"
ACCION_ENCOLAR = "ENCOLAR"
ACCION_TOMAR = "TOMAR"
ACCION_INICIAR_DETALLE = "INICIAR_DETALLE"
ACCION_COMPLETAR_EJECUCION = "COMPLETAR_EJECUCION"
ACCION_APROBAR_CONTROL = "APROBAR_CONTROL"
ACCION_NOTIFICAR = "NOTIFICAR"
ACCION_REGISTRAR_PAGO = "REGISTRAR_PAGO"
ACCION_ENTREGAR = "ENTREGAR"

CERO = Decimal("0")


@dataclass(frozen=True)
class PasoHappyPath:
    """Un nodo del recorrido y si la Orden ya paso por el."""

    process_id: str
    etiqueta: str
    alcanzado: bool


@dataclass(frozen=True)
class AccionDisponible:
    """Accion humana que la Orden admite ahora mismo.

    ``rol`` es ``None`` cuando el negocio todavia no definio el actor
    (Registrar Pago, BR-REP-017: capacidad transversal sin rol).
    """

    codigo: str
    etiqueta: str
    rol: RolUsuario | None
    detalle_id: str | None = None
    ejecucion_id: str | None = None


def nodos_alcanzados(orden: OrdenReparacion) -> set[str]:
    """IDs de proceso por los que la Orden ya paso."""
    alcanzados = {paso.process_id for paso in orden.historial}
    if orden.current_process == "EVT-REP-999":
        alcanzados.add("EVT-REP-999")
    return alcanzados


def progreso(orden: OrdenReparacion) -> list[PasoHappyPath]:
    """Recorrido de HP-REP-001 marcando lo ya transitado."""
    alcanzados = nodos_alcanzados(orden)
    return [
        PasoHappyPath(
            process_id=process_id,
            etiqueta=etiqueta,
            alcanzado=process_id in alcanzados,
        )
        for process_id, etiqueta in NODOS_HAPPY_PATH
    ]


def detalle_trabajable(orden: OrdenReparacion) -> str | None:
    """Primer Detalle DEFINIDO, que es el que se puede iniciar."""
    for detalle in orden.reparaciones_detail:
        if detalle.estado is EstadoReparacionDetail.DEFINIDO:
            return detalle.id
    return None


def _espera_control(orden: OrdenReparacion) -> bool:
    """Todos los Detalles terminados y ninguno controlado todavia."""
    if not orden.reparaciones_detail:
        return False
    if ejecucion_activa(orden) is not None:
        return False
    return all(
        detalle.estado is EstadoReparacionDetail.COMPLETO
        and detalle.control_estado is EstadoControl.PENDIENTE
        for detalle in orden.reparaciones_detail
    )


def acciones_disponibles(orden: OrdenReparacion) -> list[AccionDisponible]:
    """Acciones humanas que corresponden al estado actual de la Orden.

    Una Orden ENTREGADA no admite ninguna: el proceso termino.
    """
    if orden.estado_workflow is EstadoWorkflow.ENTREGADA:
        return []

    acciones: list[AccionDisponible] = []
    estado = orden.estado_workflow
    alcanzados = nodos_alcanzados(orden)

    sin_detalles = not orden.reparaciones_detail
    if estado is EstadoWorkflow.REQUERIMIENTO and sin_detalles:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_DEFINIR_REPARACION,
                etiqueta="Definir la reparacion",
                rol=RolUsuario.RECEPCION,
            )
        )

    if estado is EstadoWorkflow.HABILITADA:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_ENCOLAR,
                etiqueta="Priorizar e ingresar a la cola",
                rol=RolUsuario.COORDINADOR_RMA,
            )
        )

    if estado is EstadoWorkflow.EN_COLA and toma_activa(orden) is None:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_TOMAR,
                etiqueta="Tomar la Orden",
                rol=RolUsuario.TECNICO,
            )
        )

    en_curso = ejecucion_activa(orden)
    trabajable = detalle_trabajable(orden)

    if toma_activa(orden) is not None and en_curso is None and trabajable:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_INICIAR_DETALLE,
                etiqueta="Iniciar el Detalle",
                rol=RolUsuario.TECNICO,
                detalle_id=trabajable,
            )
        )

    if estado is EstadoWorkflow.EN_REPARACION and en_curso is not None:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_COMPLETAR_EJECUCION,
                etiqueta="Registrar la ejecucion realizada",
                rol=RolUsuario.TECNICO,
                detalle_id=en_curso.reparacion_detail_id,
                ejecucion_id=en_curso.id,
            )
        )

    lista = estado is EstadoWorkflow.REPARACION_LISTA
    if not lista and _espera_control(orden):
        acciones.append(
            AccionDisponible(
                codigo=ACCION_APROBAR_CONTROL,
                etiqueta="Aprobar el control tecnico",
                rol=RolUsuario.RECEPCION,
            )
        )

    notificada = "PROC-REP-260" in alcanzados

    if lista and not notificada:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_NOTIFICAR,
                etiqueta="Notificar al cliente",
                rol=RolUsuario.RECEPCION,
            )
        )

    if orden.reparaciones_detail and orden.saldo > CERO:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_REGISTRAR_PAGO,
                etiqueta="Registrar un pago",
                rol=None,
            )
        )

    if lista and notificada and orden.saldo <= CERO:
        acciones.append(
            AccionDisponible(
                codigo=ACCION_ENTREGAR,
                etiqueta="Entregar el equipo",
                rol=RolUsuario.ADMINISTRADOR,
            )
        )

    return acciones
