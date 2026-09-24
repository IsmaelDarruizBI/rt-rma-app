"""Endpoints de consulta de catalogos.

Solo lectura. El frontend los usa para poblar selectores: tipos de
reparacion al definir un Detalle, estaciones al tomar una Orden y
usuarios para el selector de actor DEMO.
"""

from fastapi import APIRouter

from app.application import (
    listar_estaciones,
    listar_tipos_reparacion,
    listar_usuarios,
)

from .dependencias import ContextoDep
from .schemas import EstacionOut, TipoReparacionOut, UsuarioOut

router = APIRouter(prefix="/api/catalogs", tags=["catalogos"])


@router.get("/repair-types")
def get_tipos_reparacion(contexto: ContextoDep) -> list[TipoReparacionOut]:
    """Tipos de Reparacion del catalogo."""
    return [
        TipoReparacionOut.desde_dominio(tipo)
        for tipo in listar_tipos_reparacion(contexto)
    ]


@router.get("/stations")
def get_estaciones(contexto: ContextoDep) -> list[EstacionOut]:
    """Estaciones de trabajo configuradas."""
    return [
        EstacionOut.desde_dominio(estacion)
        for estacion in listar_estaciones(contexto)
    ]


@router.get("/users")
def get_usuarios(contexto: ContextoDep) -> list[UsuarioOut]:
    """Usuarios operativos. Alimenta el selector de actor DEMO."""
    return [
        UsuarioOut.desde_dominio(usuario)
        for usuario in listar_usuarios(contexto)
    ]
