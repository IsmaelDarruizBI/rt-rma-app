"""Pagos de la Orden."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, computed_field


class Pago(BaseModel):
    """Pago registrado sobre la Orden.

    Puede registrarse en cualquier momento de la vida de la Orden (seña,
    anticipo, pago parcial o pago final), no unicamente al cierre.
    """

    id: str
    monto: Decimal = Field(gt=0)
    metodo: str
    usuario_id: str
    fecha: datetime


class ResumenPago(BaseModel):
    """Pagos registrados de la Orden y su suma.

    No almacena el total cobrable: ese valor deriva de los Detalles de la
    Orden, que este modelo no conoce. El total, el saldo y el estado de
    cobro se calculan en OrdenReparacion.
    """

    pagos: list[Pago] = Field(default_factory=list)

    @computed_field
    @property
    def pagado(self) -> Decimal:
        """Suma de los pagos registrados."""
        return sum((pago.monto for pago in self.pagos), Decimal("0"))
