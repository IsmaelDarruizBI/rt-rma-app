"""Aggregate raiz del MVP: la Orden de Reparacion."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, computed_field

from .documentos import DocumentosOrden
from .enums import EstadoPago, EstadoWorkflow, OrigenOrden
from .equipos import Equipo
from .inventario import MovimientoInsumo
from .pagos import ResumenPago
from .personas import Cliente
from .reparacion import EjecucionReparacion, ReparacionDetail, TomaOrden
from .workflow import HistorialWorkflow


class OrdenReparacion(BaseModel):
    """Unidad de gestion del proceso de reparacion.

    Contiene sus entidades transaccionales (Detalles, tomas, ejecuciones,
    movimientos, pagos, documentos e historial) y referencia los
    catalogos -TipoReparacion, Insumo, EstacionTrabajo, Usuario- solo por
    ID: nunca los copia.

    La situacion comercial (``total``, ``saldo``, ``estado_pago``) es
    siempre derivada: nada que deba sincronizarse a mano. El alcance del
    MVP es el de HP-REP-001, sin descuentos, cortesias, cancelaciones,
    impuestos, ajustes ni garantias no cobrables.

    Es el aggregate que mas adelante se persistira como un unico JSON.
    """

    id: str

    origen: OrigenOrden
    estado_workflow: EstadoWorkflow
    current_process: str

    cliente: Cliente
    equipo: Equipo

    prioridad: int = Field(default=0, ge=0)

    reparaciones_detail: list[ReparacionDetail] = Field(default_factory=list)

    tomas: list[TomaOrden] = Field(default_factory=list)

    ejecuciones: list[EjecucionReparacion] = Field(default_factory=list)

    movimientos_insumo: list[MovimientoInsumo] = Field(default_factory=list)

    resumen_pago: ResumenPago = Field(default_factory=ResumenPago)

    documentos: DocumentosOrden = Field(default_factory=DocumentosOrden)

    historial: list[HistorialWorkflow] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def total(self) -> Decimal:
        """Total cobrable: suma de los precios snapshot de los Detalles."""
        return sum(
            (detalle.precio for detalle in self.reparaciones_detail),
            Decimal("0"),
        )

    @computed_field
    @property
    def saldo(self) -> Decimal:
        """Diferencia entre el total cobrable y lo efectivamente pagado."""
        return self.total - self.resumen_pago.pagado

    @computed_field
    @property
    def estado_pago(self) -> EstadoPago:
        """Estado de cobro derivado del saldo y de lo pagado.

        Una Orden sin Detalles todavia no tiene nada que cobrar, y no es
        lo mismo que una Orden con Detalles cuyo total da 0: la primera
        queda PENDIENTE, la segunda PAGADA.
        """
        if not self.reparaciones_detail:
            return EstadoPago.PENDIENTE
        if self.saldo <= 0:
            return EstadoPago.PAGADO
        if self.resumen_pago.pagado > 0:
            return EstadoPago.PARCIAL
        return EstadoPago.PENDIENTE
