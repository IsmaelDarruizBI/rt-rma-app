"""Escritura consistente de la trazabilidad de workflow.

Esto NO es un workflow engine: no decide cual es el proximo nodo, no
interpreta los YAML de ``business/`` y no conoce los edges del proceso.
La secuencia la compone el caller invocando services en orden; este
modulo solo centraliza como queda registrado cada paso.
"""

from datetime import datetime

from app.domain.models import HistorialWorkflow, OrdenReparacion


def registrar_paso(
    orden: OrdenReparacion,
    *,
    process_id: str,
    accion: str,
    fecha: datetime,
    usuario_id: str | None = None,
    reparacion_detail_id: str | None = None,
    ejecucion_id: str | None = None,
    observacion: str | None = None,
) -> OrdenReparacion:
    """Devuelve una copia de la Orden con el paso registrado.

    Actualiza ``current_process`` y ``updated_at``, y agrega la entrada
    al historial. La Orden recibida nunca se modifica: los services la
    usan como primer paso y siguen trabajando sobre la copia devuelta.

    ``process_id`` debe ser un ID real de ``business/`` (por ejemplo
    ``PROC-REP-185``); este modulo no los valida ni los inventa.
    """
    nueva_orden = orden.model_copy(deep=True)

    nueva_orden.current_process = process_id
    nueva_orden.updated_at = fecha
    nueva_orden.historial.append(
        HistorialWorkflow(
            process_id=process_id,
            accion=accion,
            fecha=fecha,
            usuario_id=usuario_id,
            reparacion_detail_id=reparacion_detail_id,
            ejecucion_id=ejecucion_id,
            observacion=observacion,
        )
    )

    return nueva_orden
