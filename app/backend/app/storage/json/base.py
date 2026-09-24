"""Lectura y escritura de archivos JSON para el almacenamiento del MVP.

Unico lugar del backend que conoce ``Path``, ``open()`` y el modulo
``json``. Los services nunca llegan hasta aqui: hablan con los contratos
de ``app.repositories``.
"""

import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from app.repositories.exceptions import PersistenciaError


def asegurar_directorio(directorio: Path) -> Path:
    """Crea el directorio si falta y lo devuelve."""
    try:
        directorio.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise PersistenciaError(
            f"No se pudo preparar el directorio {directorio}: {error}"
        ) from error
    return directorio


def leer_json(ruta: Path) -> Any:
    """Lee y parsea un archivo JSON.

    Traduce cualquier fallo -contenido invalido o error de E/S- a
    ``PersistenciaError``, para que el llamador no tenga que conocer las
    excepciones del modulo ``json`` ni del sistema de archivos.
    """
    try:
        contenido = ruta.read_text(encoding="utf-8")
    except OSError as error:
        raise PersistenciaError(
            f"No se pudo leer {ruta}: {error}"
        ) from error

    try:
        return json.loads(contenido)
    except json.JSONDecodeError as error:
        raise PersistenciaError(
            f"El archivo {ruta} no contiene JSON valido: {error}"
        ) from error


def escribir_json_atomico(ruta: Path, contenido: Any) -> None:
    """Escribe el JSON de forma atomica.

    Escribe en un temporal del mismo directorio, lo cierra y recien
    entonces hace ``os.replace``, que es atomico dentro del mismo
    sistema de archivos. Asi una escritura interrumpida nunca deja el
    archivo destino a medias: o esta la version anterior, o la nueva.

    Si algo falla, el temporal se borra y no queda basura al lado del
    archivo bueno.
    """
    asegurar_directorio(ruta.parent)

    temporal: Path | None = None
    try:
        with NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=ruta.parent,
            prefix=f".{ruta.name}.",
            suffix=".tmp",
            delete=False,
        ) as archivo:
            temporal = Path(archivo.name)
            json.dump(contenido, archivo, ensure_ascii=False, indent=2)
            archivo.write("\n")
            archivo.flush()
            os.fsync(archivo.fileno())

        os.replace(temporal, ruta)
        temporal = None
    except OSError as error:
        raise PersistenciaError(
            f"No se pudo escribir {ruta}: {error}"
        ) from error
    finally:
        if temporal is not None and temporal.exists():
            temporal.unlink(missing_ok=True)
