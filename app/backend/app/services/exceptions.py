"""Errores de dominio de los casos de uso del MVP.

Alcance: el MVP implementa unicamente HP-REP-001. Cuando una
precondicion que sacaria al flujo de ese camino no se cumple, los
services fallan de forma explicita en vez de inventar un
comportamiento: los caminos alternativos de PROC-REP V1.3 (revision,
override, reserva fallida, retrabajo, cancelacion) todavia no existen.
"""


class DomainError(Exception):
    """Error de negocio del dominio RMA."""


class PrecondicionInvalidaError(DomainError):
    """La Orden no esta en condiciones de recibir esta operacion."""


class RecursoNoDisponibleError(DomainError):
    """No hay disponibilidad suficiente para completar la operacion."""


class EntidadNoEncontradaError(DomainError):
    """La entidad referenciada no existe en la Orden o en el catalogo."""
