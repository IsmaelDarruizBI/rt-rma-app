"""Autorizacion funcional de los casos de uso.

PROC-REP V1.3 asigna un actor a cada nodo. Cuando ese actor es una
persona concreta (ACT-RECEP, ACT-COORD, ACT-TECH, ACT-ADMIN), quien
ejecuta la operacion debe tener ese rol: es una regla del caso de uso,
no algo que deba quedar librado a que la UI esconda un boton.

Esto NO es autenticacion ni un sistema de permisos. No hay ACLs, scopes
ni permisos dinamicos: solo se comprueba que el usuario este activo y
que su rol sea el que el nodo requiere.

Los nodos ACT-SYSTEM no llevan actor humano. Cuando una operacion
automatica necesita saber quien es el tecnico, lo obtiene de la Toma o
de la Ejecucion existente, no de un usuario inventado.

Correspondencia con ``business/actors/actors.yaml``:

    ACT-RECEP  -> RolUsuario.RECEPCION
    ACT-COORD  -> RolUsuario.COORDINADOR_RMA
    ACT-TECH   -> RolUsuario.TECNICO
    ACT-ADMIN  -> RolUsuario.ADMINISTRADOR

Un nodo puede declarar ``actores_alternativos``: varios actores
igualmente autorizados, sin jerarquia. Para esos casos se usa
``validar_alguno_de``.
"""

from collections.abc import Sequence

from app.domain.models import RolUsuario, Usuario

from .exceptions import PrecondicionInvalidaError


def actor_valido(usuario: Usuario, rol_requerido: RolUsuario) -> bool:
    """True si el usuario esta activo y tiene el rol requerido.

    Version no excepcional, para los nodos de validacion que devuelven
    un resultado en vez de interrumpir el flujo (PROC-REP-172).
    """
    return usuario.activo and usuario.rol is rol_requerido


def validar_actor(usuario: Usuario, rol_requerido: RolUsuario) -> None:
    """Exige que el usuario pueda actuar como el actor del nodo.

    Falla si esta inactivo o si su rol no corresponde.
    """
    validar_alguno_de(usuario, (rol_requerido,))


def validar_alguno_de(
    usuario: Usuario,
    roles_autorizados: Sequence[RolUsuario],
) -> None:
    """Exige que el usuario tenga ALGUNO de los roles indicados.

    Para los nodos que V1.3 declara con ``actores_alternativos``: varios
    actores igualmente autorizados, sin jerarquia entre ellos. Por
    ejemplo PROC-REP-150 (ACT-COORD o ACT-RECEP) y PROC-REP-270
    (ACT-ADMIN o ACT-RECEP).

    ``validar_actor`` es el caso de un solo rol.
    """
    if not usuario.activo:
        raise PrecondicionInvalidaError(
            f"El usuario {usuario.id} no esta activo."
        )
    if usuario.rol not in roles_autorizados:
        esperados = " o ".join(rol.value for rol in roles_autorizados)
        raise PrecondicionInvalidaError(
            f"La operacion requiere el rol {esperados}; "
            f"el usuario {usuario.id} es {usuario.rol.value}."
        )


def validar_usuario_activo(usuario: Usuario) -> None:
    """Exige unicamente que el usuario este activo.

    Se usa en los nodos ACT-SYSTEM que igualmente registran quien
    disparo la operacion, y en las capacidades transversales cuyo rol
    autorizado todavia no esta definido funcionalmente (por ejemplo
    Registrar Pago, BR-REP-017).
    """
    if not usuario.activo:
        raise PrecondicionInvalidaError(
            f"El usuario {usuario.id} no esta activo."
        )
