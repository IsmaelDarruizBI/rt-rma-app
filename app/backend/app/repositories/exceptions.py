"""Errores de la capa de persistencia.

Deliberadamente separados de ``app.services.exceptions``: un fallo de
infraestructura (el archivo no existe, el JSON esta corrupto, el disco
no responde) no es una regla de negocio incumplida, y quien los atrape
va a querer tratarlos distinto.
"""


class RepositoryError(Exception):
    """Fallo al acceder a la persistencia."""


class EntidadPersistidaNoEncontradaError(RepositoryError):
    """La entidad pedida no existe en el almacenamiento."""


class PersistenciaError(RepositoryError):
    """No se pudo leer o escribir: contenido invalido o error de E/S."""
