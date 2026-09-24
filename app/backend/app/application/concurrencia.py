"""Seccion critica de inventario del MVP.

PROC-REP-185 (reservar insumos e iniciar Ejecucion) es el unico nodo del
Happy Path donde dos usuarios pueden pelearse la misma unidad de stock:
la disponibilidad se calcula leyendo TODAS las Ordenes persistidas y,
acto seguido, se escribe una RESERVA. Entre la lectura y la escritura no
puede colarse otro pedido, o ambos creerian tener la ultima unidad.

ALCANCE Y LIMITACION DELIBERADA
-------------------------------
``LOCK_INVENTARIO`` es un ``threading.RLock`` de modulo: protege la
concurrencia DENTRO DE UN UNICO PROCESO Python. No es un lock
distribuido y no protege nada si el backend corre con varios workers,
varias instancias o varios contenedores apuntando al mismo directorio de
datos.

Por eso el MVP se sirve con **un solo worker de uvicorn**:

    uvicorn app.main:app --workers 1

Cuando el almacenamiento deje de ser JSON sobre el filesystem, la
exclusion mutua debera resolverla el motor de persistencia (una
transaccion, un ``SELECT ... FOR UPDATE``, un lock distribuido), no este
modulo.

Es reentrante a proposito: un caso de uso puede llamar a otro que
tambien entre en la seccion critica sin bloquearse a si mismo.
"""

import threading
from collections.abc import Iterator
from contextlib import contextmanager

LOCK_INVENTARIO = threading.RLock()


@contextmanager
def seccion_critica_inventario() -> Iterator[None]:
    """Serializa la lectura-validacion-escritura de stock reservado.

    Cubre la secuencia completa, no solo la escritura:

        cargar Orden -> cargar reservas globales -> validar
        disponibilidad -> generar RESERVA -> guardar Orden

    Se usa en PROC-REP-185 y tambien en la coordinacion de
    PROC-REP-210, que lee el stock fisico del catalogo y lo reescribe.
    """
    with LOCK_INVENTARIO:
        yield
