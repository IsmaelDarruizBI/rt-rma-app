"""Persistencia de Ordenes de Reparacion en archivos JSON.

Una Orden por archivo: ``<directorio>/<orden_id>.json``. La Orden es el
aggregate raiz, asi que su archivo es autocontenido -Detalles, tomas,
ejecuciones, movimientos, pagos, documentos e historial-, salvo los
catalogos, que se referencian por ID.

Solo se persisten los campos almacenados. Los derivados se excluyen
y vuelven a calcularse al cargar.
"""

from pathlib import Path

from pydantic import ValidationError

from app.domain.models import OrdenReparacion
from app.repositories.exceptions import (
    EntidadPersistidaNoEncontradaError,
    PersistenciaError,
)

from .base import asegurar_directorio, escribir_json_atomico, leer_json


class JsonOrdenReparacionRepository:
    """Implementa ``OrdenReparacionRepository`` sobre el filesystem."""

    def __init__(self, directorio: Path) -> None:
        self._directorio = asegurar_directorio(Path(directorio))

    @property
    def directorio(self) -> Path:
        """Directorio donde viven los archivos de Orden."""
        return self._directorio

    def _ruta_de(self, orden_id: str) -> Path:
        return self._directorio / f"{orden_id}.json"

    def obtener(self, orden_id: str) -> OrdenReparacion:
        """Carga la Orden desde su archivo."""
        ruta = self._ruta_de(orden_id)
        if not ruta.is_file():
            raise EntidadPersistidaNoEncontradaError(
                f"No existe la Orden {orden_id}"
            )
        return self._validar(leer_json(ruta), ruta)

    def guardar(self, orden: OrdenReparacion) -> None:
        """Crea o reemplaza el archivo de la Orden.

        Idempotente: la ruta depende solo del ID, asi que guardar dos
        veces la misma Orden nunca duplica archivos.

        Los campos derivados (``total``, ``saldo``, ``estado_pago``,
        ``puntaje_total``, ``resumen_pago.pagado``) NO se escriben: no
        son fuente de verdad y persistirlos crearia una segunda copia
        que podria quedar desincronizada de los Detalles y los Pagos.
        Se recalculan solos al reconstruir el modelo.
        """
        escribir_json_atomico(
            self._ruta_de(orden.id),
            orden.model_dump(mode="json", exclude_computed_fields=True),
        )

    def listar(self) -> list[OrdenReparacion]:
        """Carga todas las Ordenes, ordenadas por ID."""
        ordenes = [
            self._validar(leer_json(ruta), ruta)
            for ruta in sorted(self._directorio.glob("*.json"))
        ]
        return sorted(ordenes, key=lambda orden: orden.id)

    @staticmethod
    def _validar(datos: object, ruta: Path) -> OrdenReparacion:
        """Reconstruye la Orden con el contrato Pydantic del dominio."""
        try:
            return OrdenReparacion.model_validate(datos)
        except ValidationError as error:
            raise PersistenciaError(
                f"El archivo {ruta} no representa una Orden valida: {error}"
            ) from error
