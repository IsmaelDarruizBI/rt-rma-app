"""El dominio puede representar el escenario HP-REP-001 completo.

No ejecuta el flujo (todavia no hay services ni workflow engine): valida
que el modelo es capaz de contener su estado final y de sobrevivir un
ciclo de serializacion/validacion.
"""

from decimal import Decimal

from app.domain.models import (
    EstadoControl,
    EstadoEjecucion,
    EstadoPago,
    EstadoReparacionDetail,
    EstadoTomaOrden,
    EstadoWorkflow,
    OrdenReparacion,
    OrigenOrden,
    TipoMovimientoInsumo,
)

# 8) Se puede construir una Orden completa consistente con HP-REP-001.


def test_orden_refleja_el_estado_final_del_escenario(orden_hp_rep_001):
    orden = orden_hp_rep_001

    assert orden.origen is OrigenOrden.CLIENTE_EXTERNO
    assert orden.estado_workflow is EstadoWorkflow.ENTREGADA


def test_el_escenario_termina_en_el_evento_final(orden_hp_rep_001):
    """HP-REP-001 cierra en PROC-REP-280 -> PROC-REP-270 -> EVT-REP-999."""
    assert orden_hp_rep_001.current_process == "EVT-REP-999"


def test_orden_tiene_un_unico_detalle_completo_y_aprobado(orden_hp_rep_001):
    assert len(orden_hp_rep_001.reparaciones_detail) == 1

    detalle = orden_hp_rep_001.reparaciones_detail[0]

    # El ciclo tecnico termina en COMPLETO; la aprobacion es otra
    # dimension y vive en control_estado.
    assert detalle.estado is EstadoReparacionDetail.COMPLETO
    assert detalle.control_estado is EstadoControl.APROBADO
    assert detalle.control_usuario_id == "RECEP-001"
    assert detalle.control_fecha is not None


def test_detalle_conserva_el_snapshot_del_tipo_de_reparacion(orden_hp_rep_001):
    detalle = orden_hp_rep_001.reparaciones_detail[0]

    assert detalle.tipo_reparacion_id == "TREP-001"
    assert detalle.precio == Decimal("80000")
    assert detalle.puntaje == 10
    assert detalle.garantia_dias == 90


def test_no_queda_ninguna_toma_activa(orden_hp_rep_001):
    assert len(orden_hp_rep_001.tomas) == 1

    toma = orden_hp_rep_001.tomas[0]

    assert toma.estado is EstadoTomaOrden.CERRADA
    assert toma.fin is not None
    assert toma.usuario_id == "TECH-001"
    assert toma.estacion_id == "EST-001"


def test_la_ejecucion_quedo_completada_dentro_de_su_toma(orden_hp_rep_001):
    assert len(orden_hp_rep_001.ejecuciones) == 1

    ejecucion = orden_hp_rep_001.ejecuciones[0]
    detalle = orden_hp_rep_001.reparaciones_detail[0]
    toma = orden_hp_rep_001.tomas[0]

    assert ejecucion.estado is EstadoEjecucion.COMPLETADO
    assert ejecucion.fin is not None
    assert ejecucion.reparacion_detail_id == detalle.id
    assert ejecucion.toma_orden_id == toma.id


def test_la_reserva_y_el_consumo_se_conservan_ambos(orden_hp_rep_001):
    movimientos = orden_hp_rep_001.movimientos_insumo

    assert [m.tipo for m in movimientos] == [
        TipoMovimientoInsumo.RESERVA,
        TipoMovimientoInsumo.CONSUMO,
    ]

    reserva, consumo = movimientos

    assert reserva.movimiento_origen_id is None
    assert consumo.movimiento_origen_id == reserva.id
    assert consumo.ejecucion_id == orden_hp_rep_001.ejecuciones[0].id
    assert reserva.cantidad == consumo.cantidad == Decimal("1")


def test_los_movimientos_automaticos_no_tienen_usuario(orden_hp_rep_001):
    """PROC-REP-185 y PROC-REP-210 son acciones ACT-SYSTEM."""
    for movimiento in orden_hp_rep_001.movimientos_insumo:
        assert movimiento.usuario_id is None


def test_la_trazabilidad_al_tecnico_pasa_por_la_ejecucion(orden_hp_rep_001):
    """Sin usuario en el movimiento, el tecnico sigue siendo alcanzable."""
    consumo = orden_hp_rep_001.movimientos_insumo[1]
    ejecuciones = {e.id: e for e in orden_hp_rep_001.ejecuciones}

    assert consumo.usuario_id is None
    assert ejecuciones[consumo.ejecucion_id].usuario_id == "TECH-001"


def test_el_total_deriva_del_detalle(orden_hp_rep_001):
    assert orden_hp_rep_001.total == Decimal("80000")
    assert orden_hp_rep_001.total == (
        orden_hp_rep_001.reparaciones_detail[0].precio
    )


def test_el_saldo_final_es_cero(orden_hp_rep_001):
    orden = orden_hp_rep_001

    assert orden.resumen_pago.pagado == Decimal("80000")
    assert orden.saldo == Decimal("0")
    assert orden.estado_pago is EstadoPago.PAGADO


def test_los_documentos_finales_fueron_generados(orden_hp_rep_001):
    documentos = orden_hp_rep_001.documentos

    assert documentos.comprobante_recepcion.generado is True
    assert documentos.comprobante_final.generado is True
    assert documentos.garantia_reparacion.generado is True


def test_el_historial_conserva_los_ids_funcionales(orden_hp_rep_001):
    recorridos = [paso.process_id for paso in orden_hp_rep_001.historial]

    # Hitos del escenario, con los IDs tal como estan en business/.
    for process_id in [
        "PROC-REP-040",
        "PROC-REP-070",
        "PROC-REP-060",
        "PROC-REP-185",
        "PROC-REP-210",
        "PROC-REP-220",
        "PROC-REP-265",
        "PROC-REP-280",
        "PROC-REP-270",
    ]:
        assert process_id in recorridos

    # PROC-REP-265 se evalua dos veces: bloqueo por saldo y revalidacion
    # despues del pago final.
    assert recorridos.count("PROC-REP-265") == 2


def test_los_catalogos_no_se_embeben_en_la_orden(orden_hp_rep_001):
    """La Orden referencia catalogos por ID, nunca los copia."""
    volcado = orden_hp_rep_001.model_dump()
    detalle = volcado["reparaciones_detail"][0]

    assert "tipo_reparacion" not in detalle
    assert detalle["tipo_reparacion_id"] == "TREP-001"

    for campo in ("insumos", "usuarios", "estaciones", "tipos_reparacion"):
        assert campo not in volcado


# 9) y 10) Serializacion a JSON y revalidacion.


def test_la_orden_se_serializa_a_json(orden_hp_rep_001):
    volcado = orden_hp_rep_001.model_dump(mode="json")

    assert volcado["id"] == "OR-001"
    assert volcado["estado_workflow"] == "ENTREGADA"
    assert volcado["current_process"] == "EVT-REP-999"
    assert volcado["total"] == "80000"
    assert volcado["saldo"] == "0"
    assert volcado["estado_pago"] == "PAGADO"
    assert volcado["resumen_pago"]["pagado"] == "80000"


def test_el_json_vuelve_a_validarse_sin_perdida(orden_hp_rep_001):
    volcado = orden_hp_rep_001.model_dump(mode="json")

    reconstruida = OrdenReparacion.model_validate(volcado)

    assert reconstruida == orden_hp_rep_001
    assert reconstruida.model_dump(mode="json") == volcado


def test_los_derivados_se_recalculan_tras_el_round_trip(orden_hp_rep_001):
    """Los computed_field no se leen del JSON: se vuelven a calcular."""
    volcado = orden_hp_rep_001.model_dump(mode="json")
    volcado["total"] = "999999"
    volcado["saldo"] = "999999"
    volcado["estado_pago"] = "PENDIENTE"

    reconstruida = OrdenReparacion.model_validate(volcado)

    assert reconstruida.total == Decimal("80000")
    assert reconstruida.saldo == Decimal("0")
    assert reconstruida.estado_pago is EstadoPago.PAGADO
