"""Identificadores legibles que la aplicacion asigna a lo que crea.

``app.services.identificadores`` genera IDs opacos para entidades
internas (tomas, ejecuciones, movimientos, pagos). Estos, en cambio, son
los que una persona lee y dicta por telefono: el numero de Orden y el
numero de Detalle dentro de ella.

La numeracion de Ordenes se calcula mirando lo persistido. No hay
secuencia en base de datos; el MVP la deriva, y quien la invoca lo hace
dentro de la seccion critica para que dos altas simultaneas no reciban
el mismo numero.
"""

import re

from app.domain.models import OrdenReparacion
from app.repositories import OrdenReparacionRepository

PREFIJO_ORDEN = "OR"
PREFIJO_DETALLE = "DET"

_PATRON_ORDEN = re.compile(rf"^{PREFIJO_ORDEN}-(\d+)$")
_PATRON_DETALLE = re.compile(rf"^{PREFIJO_DETALLE}-(\d+)$")


def siguiente_orden_id(ordenes: OrdenReparacionRepository) -> str:
    """Proximo numero de Orden libre, con formato ``OR-000001``.

    Ignora los IDs que no siguen el patron: una Orden importada con otro
    formato no rompe la numeracion.
    """
    maximo = 0
    for orden in ordenes.listar():
        encontrado = _PATRON_ORDEN.match(orden.id)
        if encontrado:
            maximo = max(maximo, int(encontrado.group(1)))
    return f"{PREFIJO_ORDEN}-{maximo + 1:06d}"


def siguiente_detalle_id(orden: OrdenReparacion) -> str:
    """Proximo numero de Detalle dentro de la Orden (``DET-001``)."""
    maximo = 0
    for detalle in orden.reparaciones_detail:
        encontrado = _PATRON_DETALLE.match(detalle.id)
        if encontrado:
            maximo = max(maximo, int(encontrado.group(1)))
    return f"{PREFIJO_DETALLE}-{maximo + 1:03d}"
