"""Cobro de la Orden: pagos y condicion de entrega.

Nodos cubiertos: PROC-REP-265 (validar condicion de entrega) y
PROC-REP-266 (saldo pendiente). Regla: BR-REP-017. Feature: FEAT-REP-007.

BR-REP-017 distingue dos cosas que no deben confundirse:

- Registrar Pago es TRANSVERSAL: puede ocurrir en cualquier momento de
  la vida de la Orden y no tiene nodo propio en el proceso.
- Completar Cobro es SECUENCIAL: es la fase de cierre modelada en
  PROC-REP-265/266.
"""

from datetime import datetime
from decimal import Decimal

from app.domain.models import (
    EstadoWorkflow,
    OrdenReparacion,
    OrigenOrden,
    Pago,
    Usuario,
)

from .autorizacion import validar_usuario_activo
from .exceptions import PrecondicionInvalidaError
from .identificadores import nuevo_id
from .workflow import registrar_paso


def registrar_pago(
    orden: OrdenReparacion,
    *,
    monto: Decimal,
    metodo: str,
    usuario: Usuario,
    fecha: datetime,
    pago_id: str | None = None,
) -> OrdenReparacion:
    """Registra un Pago (BR-REP-017-A, FEAT-REP-007).

    Capacidad transversal: NO corresponde a ningun PROC-REP-*, asi que
    no toca ``current_process`` ni agrega historial de workflow. El
    propio Pago conserva importe, medio, usuario y fecha.

    Despues del pago, ``orden.saldo`` y ``orden.estado_pago`` se
    recalculan solos: son campos derivados.

    PENDIENTE FUNCIONAL: BR-REP-017 no define que rol puede registrar
    un Pago, asi que aqui no se exige ninguno. Solo se comprueba que
    el usuario este activo. Cuando el negocio lo defina, se agrega el
    ``validar_actor`` correspondiente.
    """
    validar_usuario_activo(usuario)

    if monto <= 0:
        raise PrecondicionInvalidaError(
            f"El monto del pago debe ser positivo: {monto}."
        )

    nueva_orden = orden.model_copy(deep=True)
    nueva_orden.updated_at = fecha
    nueva_orden.resumen_pago.pagos.append(
        Pago(
            id=pago_id or nuevo_id("PAG"),
            monto=monto,
            metodo=metodo,
            usuario_id=usuario.id,
            fecha=fecha,
        )
    )
    return nueva_orden


def validar_condicion_entrega(
    orden: OrdenReparacion,
    *,
    fecha: datetime,
) -> tuple[OrdenReparacion, bool]:
    """PROC-REP-265: determina si la Orden puede entregarse (BR-REP-017-B).

    Para CLIENTE_EXTERNO la condicion es saldo = 0. V1.3 no admite
    override para entregar con deuda. Las otras dos condiciones que la
    regla contempla -cortesia total y origen no cobrable- quedan fuera
    del MVP, que solo modela CLIENTE_EXTERNO sin ajustes comerciales.

    Se evalua antes de generar el comprobante final (PROC-REP-280), para
    que el comprobante refleje siempre el saldo definitivo.
    """
    if orden.estado_workflow is not EstadoWorkflow.REPARACION_LISTA:
        raise PrecondicionInvalidaError(
            f"La condicion de entrega se evalua sobre una Orden "
            f"REPARACION_LISTA; esta en {orden.estado_workflow.value}."
        )
    if orden.origen is not OrigenOrden.CLIENTE_EXTERNO:
        raise PrecondicionInvalidaError(
            f"El MVP solo resuelve el cobro de CLIENTE_EXTERNO, no de "
            f"{orden.origen.value}."
        )

    puede_entregar = orden.saldo <= 0

    nueva_orden = registrar_paso(
        orden,
        process_id="PROC-REP-265",
        accion="VALIDAR_CONDICION_ENTREGA",
        fecha=fecha,
        observacion=f"Saldo {orden.saldo}",
    )
    return nueva_orden, puede_entregar


def registrar_saldo_pendiente(
    orden: OrdenReparacion,
    *,
    fecha: datetime,
) -> OrdenReparacion:
    """PROC-REP-266: la entrega queda bloqueada por saldo pendiente.

    Solo deja constancia del bloqueo en el workflow: no agrega ningun
    estado de Orden. Se destraba registrando uno o mas Pagos por la via
    transversal de siempre y revalidando PROC-REP-265.
    """
    if orden.saldo <= 0:
        raise PrecondicionInvalidaError(
            "No hay saldo pendiente que bloquee la entrega."
        )

    return registrar_paso(
        orden,
        process_id="PROC-REP-266",
        accion="SALDO_PENDIENTE_ENTREGA_BLOQUEADA",
        fecha=fecha,
        observacion=f"Saldo {orden.saldo}",
    )
