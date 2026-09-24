"""Personas del dominio: cliente externo y usuario operativo."""

from pydantic import BaseModel

from .enums import RolUsuario


class Cliente(BaseModel):
    """Cliente externo que deja un equipo para reparar."""

    id: str
    nombre: str
    telefono: str
    email: str | None = None


class Usuario(BaseModel):
    """Usuario operativo de RMA. Sin autenticacion en el MVP."""

    id: str
    nombre: str
    rol: RolUsuario
    activo: bool = True
