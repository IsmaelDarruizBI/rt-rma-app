"""Identificadores para las entidades que los services crean.

Mecanismo minimo a proposito. Los IDs generados son opacos: ningun test
debe depender de su valor. Cuando el caller ya tiene un identificador
propio (por ejemplo el de un Detalle definido por Recepcion), lo pasa
explicitamente y este modulo no interviene.
"""

from uuid import uuid4


def nuevo_id(prefijo: str) -> str:
    """Devuelve un identificador unico y legible con el prefijo dado."""
    return f"{prefijo}-{uuid4().hex[:12]}"
