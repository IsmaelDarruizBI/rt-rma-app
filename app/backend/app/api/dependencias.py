"""Dependencias FastAPI compartidas por los routers.

El ``ApplicationContext`` se construye UNA vez al crear la app, a partir
de ``Settings``, y queda en ``app.state``. Los endpoints lo reciben por
inyeccion y nunca instancian repositories.

Asi un test levanta la app con un ``Settings(data_dir=tmp_path)`` y todo
el backend -API, aplicacion, storage- queda apuntando a ese directorio
temporal, sin tocar los JSON DEMO versionados de ``app/backend/data``.
"""

from typing import Annotated

from fastapi import Depends, Request

from app.application import ApplicationContext


def obtener_contexto(request: Request) -> ApplicationContext:
    """Devuelve el contexto de aplicacion montado en la app."""
    return request.app.state.contexto


ContextoDep = Annotated[ApplicationContext, Depends(obtener_contexto)]
