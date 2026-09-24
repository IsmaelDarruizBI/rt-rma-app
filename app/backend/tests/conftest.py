"""Fixtures compartidas por los tests del dominio."""

import pytest

from app.domain.models import OrdenReparacion
from tests.fixtures.hp_rep_001 import construir_orden_hp_rep_001


@pytest.fixture
def orden_hp_rep_001() -> OrdenReparacion:
    """Orden en el estado final del escenario HP-REP-001."""
    return construir_orden_hp_rep_001()
