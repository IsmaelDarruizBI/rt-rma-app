# Trazabilidad implementada — HP-REP-001

Este documento describe **lo que ahora existe** de trazabilidad en el
repositorio. Complementa a [`README.md`](./README.md), que define la
**convencion de IDs y la jerarquia** y que fue escrito cuando todavia no
habia ninguna implementacion.

> **Nota de reconciliacion**: `traceability/README.md` afirma en varios
> puntos que "no hay todavia ninguna implementacion" y que no existen
> User Stories reales. Esas afirmaciones quedaron desactualizadas con
> este trabajo. `README.md` **no se modifico** aqui: se reconcilia
> despues del merge, junto con el resto de los README generales.

## Que se agrego

| Artefacto | Ruta |
|---|---|
| Constitution del proyecto | `.specify/memory/constitution.md` |
| Especificaciones por Feature activa | `specs/001-…/` … `specs/008-…/` |
| Grafo machine-readable (items + links) | `traceability/hp-rep-001.yaml` |
| Validador de integridad | `scripts/validate-traceability.ts` |

## Alcance: slice, no Feature

La distincion mas importante de todo este material:

```text
feature_status           = draft        -> estado de la Feature V1.3
implemented_scenario     = HP-REP-001
implemented_slice_status = IMPLEMENTED  -> estado del slice, no de la Feature
```

**Ninguna `FEAT-REP-XXX` esta implementada.** Lo implementado es el
recorrido que el Scenario `HP-REP-001` ejercita dentro de cada Feature.
`FEAT-REP-009` (Cancelacion) no esta activa en el Happy Path, por lo que
no tiene spec.

El validador falla explicitamente si algun item de tipo `feature` se
declara `IMPLEMENTED`.

## Estructura del grafo

`traceability/hp-rep-001.yaml` implementa la decision de diseño que
`README.md` ya habia tomado: **items + links**, nunca anidamiento rigido,
para poder representar relaciones N:M.

```yaml
items:
  - {id: FR-REP-027, type: functional_requirement, name: …, status: …}
links:
  - {from: TR-REP-033, to: FR-REP-027, relationship: satisfies}
```

Cada item declara al menos `id`, `type`, `name` y `status`; los items de
codigo y de test declaran ademas `source` (archivo + simbolo, o archivo +
funcion). Cada link declara `from`, `to` y `relationship`.

### Niveles presentes

| Nivel | Tipo | Cantidad |
|---|---|---|
| Business Domain | `business_domain` | 1 |
| Business Process | `business_process` | 1 |
| Scenario | `scenario` | 1 |
| Feature | `feature` | 9 |
| Event | `business_event` | 2 |
| Process Node | `process_node` | 56 |
| Business Rule | `business_rule` | 18 |
| User Story | `user_story` | 16 |
| System Action | `system_action` | 26 |
| Functional Requirement | `functional_requirement` | 60 |
| Technical Requirement | `technical_requirement` | 50 |
| Data Model / Arquitectura | `data_model_artifact` | 13 |
| Task | `task` | 141 |
| Code / Artifact | `code_artifact` | 103 |
| Internal Test | `internal_test` | 175 |
| UAT | `uat` | 16 |

Los nodos del Business Process incluyen tanto los 31 que `HP-REP-001`
recorre (`in_scenario: true`) como los 25 que las Features declaran y el
Happy Path **no** recorre (`in_scenario: false`, `implemented: false`),
para que los gaps sean navegables dentro del mismo grafo.

### Vocabulario de relaciones

Declarado en `meta.relationship_vocabulary` y verificado por el
validador: `belongs_to`, `activates`, `realizes`, `covers`,
`governed_by`, `derives_from`, `satisfies`, `supports`, `implements`,
`produced_by`, `exercises`, `verifies`, `accepts`.

### El modelo de datos es transversal

Los `data_model_artifact` se enlazan con `supports` hacia Functional
Requirements **y** Technical Requirements a la vez, en N:M, tal como
`README.md` anticipaba. No ocupan un nivel fijo de la cadena.

### Capacidades transversales sin nodo de proceso

Tres System Actions no corresponden a ningun `PROC-REP-*` y lo declaran
explicitamente (`transversal: true`, `process_node: null`):

- `ACC-REP-003` — registrar el recorrido en el historial.
- `ACC-REP-020` — **Registrar Pago** (`FEAT-REP-007`, `BR-REP-017-A`).
  `HP-REP-001` la recorre como paso `kind: FUNCTIONAL_ACTION`. **No se le
  invento un `PROC-REP-*`.**
- `ACC-REP-023` — mantener derivada la situacion comercial.

## Validacion

```bash
npm run validate:traceability    # solo el grafo de trazabilidad
npm run validate:all             # validate:v1.3 + validate:traceability
```

El validador esta escrito en TypeScript sobre `tsx`, igual que
`validate-process.ts`, `validate-features.ts`, `validate-references.ts` y
`validate-scenarios.ts`. **Justificacion**: el repositorio ya valida todo
artefacto de negocio con scripts `tsx` bajo `scripts/`, ya depende de
`yaml` y `tsx` en `package.json`, y los expone a todos por
`npm run validate:*`. Mantener el validador de trazabilidad en el mismo
lugar y el mismo lenguaje deja una sola superficie de validacion para
todo el repositorio, sin dependencias ni runtimes nuevos. El lado Python
del repositorio es la aplicacion backend, cuyo harness (`pytest`) verifica
comportamiento, no integridad de artefactos: otra responsabilidad.

### Que comprueba

1. IDs unicos.
2. Links sin referencias rotas y con `relationship` dentro del vocabulario.
3. Toda User Story pertenece a una Feature.
4. Toda System Action realiza al menos una User Story.
5. Todo Functional Requirement deriva de al menos una System Action.
6. Todo Technical Requirement satisface al menos un Functional
   Requirement, salvo los marcados `cross_cutting: true`.
7. Todo Code artifact esta vinculado a una Task y/o un Technical
   Requirement.
8. Todo Internal Test se relaciona con un Code artifact, un Functional
   Requirement o un Technical Requirement, y declara su `source`.
9. Toda Task `DONE` implementa al menos un Technical Requirement. Las
   Task `NOT_IMPLEMENTED` pueden quedar sin links **a proposito**: son el
   registro explicito de los gaps.
10. Los UAT pueden —y deben— estar `PENDING`. Un UAT en cualquier otro
    estado se reporta, porque no hubo ronda de aceptacion formal.
11. Higiene de cobertura: ninguna Feature puede declararse
    `IMPLEMENTED`; debe declarar `feature_status` e
    `implemented_slice_status` por separado.

## UAT: ninguno aprobado

Los 16 `UAT-REP-XXX` estan en `PENDING`. **Los 218 tests internos en
verde no son evidencia de aceptacion de usuario** (Constitution,
Principio IX). No ha ocurrido ninguna ronda de UAT formal sobre esta
baseline.

## Estado de cobertura

| Metrica | Valor |
|---|---|
| Tasks con evidencia real de codigo + test (`DONE`) | 86 / 141 |
| Tasks `NOT_IMPLEMENTED` (gaps declarados) | 55 / 141 |
| Features con slice implementado | 8 / 9 |
| Features implementadas por completo | **0 / 9** |
| UAT aprobados | **0 / 16** |

## Divergencias entre baseline funcional y modelado tecnico

Diferencias entre lo que `business/` define y lo que el modelado tecnico
previo dejo implementado. Siguiendo el Principio V de la constitution,
se REPORTAN: el requerimiento no se reescribe para que coincida con el
codigo, y el codigo no se toca desde esta rama.

### Catalogo de tipos de movimiento de insumo

`TipoMovimientoInsumo.DEVOLUCION` fue incorporado durante el modelado
tecnico inicial, pero no esta respaldado por PROC-REP V1.3. En sentido
inverso, `PROC-REP-210` y `BR-REP-005` contemplan `DESPERDICIO`,
actualmente ausente del enum.

La divergencia debe reconciliarse; el comportamiento de desperdicio sigue
fuera del slice implementado por HP-REP-001, que solo recorre `RESERVA`,
`CONSUMO` y `LIBERACION_RESERVA`.

Trazado como TASK-REP-089 (`NOT_IMPLEMENTED`), con TASK-REP-090
dependiendo de su resolucion. Es una decision de negocio sobre la
baseline funcional, no una tarea de implementacion.

### Otras divergencias registradas

- `PROC-REP-186` — `BR-REP-006` define que ante reserva fallida el
  Detalle queda `PENDIENTE` + `BLOQUEADO_POR_RECURSOS` y la Orden se
  recalcula. El codigo lanza un error de dominio sin ejecutar ese
  comportamiento. La invariante "sin movimientos parciales" si se
  cumple. Trazado como TASK-REP-086.
- `BR-REP-011-A` item (1) "sesion activa" — no hay gestion de sesion; se
  aproxima con rol + usuario activo. Documentado como interpretacion
  explicita en `specs/004-feat-rep-004-hp-slice/plan.md`.
- `BR-REP-017` — no define que rol puede registrar un Pago. El codigo lo
  declara pendiente funcional y solo valida usuario activo. Requiere
  decision de negocio.
- `BR-REP-015` — menciona precio configurable con historico; el catalogo
  guarda solo el precio vigente. El snapshot en el Detalle funciona.
- `BR-REP-017-A` — menciona catalogo configurable de medios de pago y
  referencia/comprobante; ninguno implementado.
- `PROC-REP-280` — describe un comprobante con desglose completo; el
  codigo registra el hecho "generado + fecha".
- `BR-REP-012` — el resolver implementa solo la regla de prioridad 2 de
  las 7, coherente con el fail-safe que la propia regla exige.

## Gaps de cobertura de test conocidos

Requerimientos declarados sin un Internal Test que los verifique
directamente. Se dejan asi, sin inventar cobertura:

- `FR-REP-023` — "tomar la Orden no inicia ninguna Ejecucion". El E2E lo
  respeta de hecho, pero ningun test lo afirma explicitamente.
- `TR-REP-003` — "`domain` no importa FastAPI, repositories ni storage".
  No existe test de arquitectura que lo verifique.
- `TR-REP-023` — estandar PEP 8 / Ruff / pytest. Se verifica corriendo el
  linter, no con un test.
- `TR-REP-024` — `nuevo_id`. Solo tiene evidencia indirecta (los IDs
  aparecen en las entidades que crean los tests E2E).
