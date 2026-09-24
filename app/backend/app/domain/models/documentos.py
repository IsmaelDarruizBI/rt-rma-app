"""Documentos de la Orden. En el MVP solo se registra si fueron emitidos."""

from datetime import datetime

from pydantic import BaseModel, Field


class Documento(BaseModel):
    """Marca de emision de un documento. Todavia no se generan archivos."""

    generado: bool = False
    fecha_generacion: datetime | None = None


class DocumentosOrden(BaseModel):
    """Documentos que una Orden puede emitir a lo largo del flujo."""

    comprobante_recepcion: Documento = Field(default_factory=Documento)
    comprobante_final: Documento = Field(default_factory=Documento)
    garantia_reparacion: Documento = Field(default_factory=Documento)
