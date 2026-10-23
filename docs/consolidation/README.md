# Consolidación V1.4 — baseline funcional candidata

**Estado: CANDIDATA**, pendiente de aprobación final (DC01). No se declaró vigente.

| Ítem | Valor |
|---|---|
| Rama | `consolidacion/v1.4` de `rt-rma-app` |
| Punto de partida | Tag `v1.4-pre-consolidacion`: la V1.4 tal como estaba, sin commitear, sobre `main` `6c82639` |
| Decisiones | Del 23/10/2026, confirmadas por el responsable de producto |

No se modificó `rt-rma-mvp` ni el código del producto, no hubo push ni despliegue y no se tocó `main`.

| Documento | Contenido |
|---|---|
| `business/decisions/decision-log-v1.4.yaml` | Registro de decisiones, incorporaciones de UAT (DC16) y pendientes. Fuente de la trazabilidad. |
| [`matriz-trazabilidad-v1.4.md`](matriz-trazabilidad-v1.4.md) | Matriz decisión → regla → Feature → nodo → Scenario → estado de implementación, generada desde el registro. |
| [`diseno-logico-v1.4.md`](diseno-logico-v1.4.md) | Entidades, relaciones, estados, eventos, invariantes y transacciones de cada funcionalidad nueva o ampliada. |
| [`sincronizacion-dc02.md`](sincronizacion-dc02.md) | Copia generada con el hash del commit de origen y su verificación. |
| `docs/audits/repair-management-v1.4-transversal-audit.md` | Estado de cada hallazgo después de la consolidación. |

## A. Resumen

### Alcance, antes y después

| | Antes (`v1.4-pre-consolidacion`) | Candidata |
|---|---|---|
| Nodos (funcionales) | 73 (69) | 76 (71) |
| Aristas | 135 | 142 |
| Reglas | 38 | 49 |
| Features | 9 | 11 (2 TRANSVERSALES) |
| Scenarios | 44 (3 HP, 36 VAR, 5 EXC) | 51 (3 HP, 43 VAR, 5 EXC) |

### Reglas

| Tipo de cambio | Reglas |
|---|---|
| Nuevas (11) | BR-REP-039 permisos · 040 administración y auditoría de configuración · 041 política de garantía y garantía por Detalle · 042 firmas · 043 consentimiento · 044 comunicaciones asistidas · 045 check-in de entrega · 046 ingreso inicial simplificado · 047 reparación «Otros» · 048 catálogo de equipos de Ventas · 049 stock operativo |
| Reemplazadas en parte (8) | BR-REP-009 (DC05) · 014 (DC07, DC08) · 016 (DC09) · 017 (DC10, DC11, fórmula única) · 018 (DC04, texto del MVP) · 021 (DC14) · 022 (DC20) · 025 (DC12) |
| Corregida (1) | BR-REP-003: el técnico, no Recepción, redefine (DC06) |
| Ampliadas (16) | BR-REP-004 · 011 · 012 · 015 · 019 · 020 · 023 · 024 · 027 · 028 · 030 · 031 · 033 · 034 · 036 · 038 |
| Solo renombre de estados (2) | BR-REP-006 · 008 |
| Sin cambios (11) | BR-REP-001 · 002 · 005 · 007 · 010 · 013 · 026 · 029 · 032 · 035 · 037 |

El renombre de estados es DC17: PENDIENTE pasa a DEFINIDO y EN_PROCESO a EN_PROGRESO.

### Proceso

**Nodos nuevos:**

- PROC-REP-036: vigencia de la garantía de origen (DC15B).
- PROC-REP-269: entrega bloqueada hasta el check-in (UAT-009).
- EVT-REP-998: ingreso en garantía no admitido.

**Aristas nuevas:**

- 180 → 212, reemplaza a 180 → 181 (cambio del MVP, DC04).
- 035 → 036, reemplaza a 035 → 040.
- 036 → 040 [Vigente] y 036 → 040 [Vencida, excepción autorizada].
- 036 → EVT-REP-998 [Vencida, sin excepción].
- 265 → 269 [Saldo en 0, falta el check-in] y 269 → 265 [Revalidar].
- 211 → 300 [Desistimiento solicitado de un Detalle ya interrumpido] y 211 → 305 [Desistimiento total solicitado, sin Ejecución activa] (DC07).

**Nodos modificados (28):** 030, 032, 035, 040, 046, 047, 060, 070, 120, 150, 180, 185, 200, 211, 212, 213, 245, 260, 265, 266, 267, 270, 271, 280, 300, 305, 306 y EVT-REP-999.

**Solo renombre:** 080, 125, 186 y 235.

**`actores_alternativos`:** 150 (RECEP), 213 (COORD), 267 (ADMIN) y 270 (RECEP).

### Features

- FEAT-REP-010, «Administración de configuración», y FEAT-REP-011, «Seguridad, roles y permisos», son nuevas y **TRANSVERSALES**. El schema admite ahora `kind: TRANSVERSAL` con `governed_nodes`, de forma retrocompatible.
- Se amplían las nueve Features existentes.
- El repositorio no tiene User Stories, que viven en los specs del producto. El alcance se expresa en `scope.includes/excludes`.

### Scenarios

**Nuevos:**

| ID | Caso | Decisión |
|---|---|---|
| VAR-REP-037 | Liberación de una Orden tomada por otro técnico con una Ejecución en curso | DC04, UAT |
| VAR-REP-038 | Garantía vencida sin excepción | DC15B |
| VAR-REP-039 | Garantía vencida con excepción autorizada | DC15B |
| VAR-REP-040 | Anulación de un Pago | DC10 |
| VAR-REP-041 | Cortesía total con Pagos previos | DC11 |
| VAR-REP-042 | Cancelación de un Detalle en ejecución | DC07B |
| VAR-REP-043 | Desistimiento total guiado | DC07C |

**Modificados:**

- HP-REP-001/002/003: 180 → 212 → 181.
- HP-REP-001: además registra el check-in antes de entregar.
- HP-REP-003: además valida la vigencia.
- VAR-REP-031 y VAR-REP-034: registran el check-in antes de la validación de entrega.

**Solo renombre:** VAR-REP-003, 028 y 029; EXC-REP-003, 004 y 005.

### Cambios propios del MVP incorporados

Los cambios que el MVP había hecho sobre V1.3 entraron como cambios identificados, sin copiar archivos:

1. `actores_alternativos`: en el schema, en el validador, en el visor y en 150/270 (DC03).
2. 180 → 212, el nombre de 212, los textos de 212/213 y BR-REP-018, y la liberación antes del primer Detalle (DC04).
3. 245 «Consolidar puntaje» y BR-REP-009 (DC05).
4. Los permisos de Recepción en FEAT-REP-004/008 (DC03).
5. El test de mecánica multidetalle del MVP (212 [Sí] → 181 forma parte del recorrido base).

En BR-REP-003, BR-REP-006 y EXC-REP-002 se conservó la redacción de V1.4, que es más completa. Las diferencias del MVP en esos tres puntos eran de redacción, no de contenido.

### Desvíos respecto de la propuesta del 23/10

1. **Casos dentro de un nodo.** La reutilización del Equipo por IMEI, el ajuste por Detalle, la versión nueva de un documento y el checklist con faltantes se resuelven dentro de un nodo o de una acción transversal. Por la convención del repositorio quedan como **casos funcionales** (ver más abajo), no como Scenarios. Por eso los IDs VAR-REP-037 a 043 se asignaron por orden de bloque.
2. **Check-in.** La UAT confirmó el check-in de entrega. Se modeló como el nodo PROC-REP-269, análogo a 266, más la acción transversal «Registrar check-in».
3. **Garantía vencida.** Se agregó el fin EVT-REP-998. La garantía vencida sin excepción no crea una Orden y no corresponde pasar por PROC-REP-268.
4. **Validador de Scenarios.** Ahora acepta cualquier nodo final para un Happy Path. Los tests siguen exigiendo que los tres Happy Paths terminen en EVT-REP-999.
5. **Reglas nuevas por DC16.** Se agregaron BR-REP-045 a 049, que la propuesta no preveía.

Estas elecciones se registran para revisión en ABI-02.

## B. Matriz de trazabilidad

Ver [`matriz-trazabilidad-v1.4.md`](matriz-trazabilidad-v1.4.md). Es la misma información que el registro, en forma de tablas.

## C. Validaciones

`npm run validate:v1.4` corre la cadena completa:

- proceso, Features y referencias;
- Scenarios y mapeo Feature–Scenario;
- tests de Scenarios, de cierre comercial y de decisión del cliente;
- **`test:consolidation:v1.4`** (nuevo): una verificación por cada decisión y casos negativos de los validadores;
- **`validate:decisions:v1.4`** (nuevo): registro de decisiones, cobertura de lo nuevo, referencias en el texto y matriz al día;
- **`test:functional-copy`** (nuevo, DC02).

También pasan:

- `test:cliente-externo:v1.4`;
- los tres tests del explorador interactivo;
- la regresión V1.3 (`validate:v1.3`).

Las vistas generadas (`generated/`) se regeneraron.

**Diferencias esperadas respecto del estado previo:**

- **Tests de identidad contra V1.3** (`test-scenarios.ts`): ahora comparan aplicando el renombre DC17 y declaran cada regla, nodo, arista y Scenario que cambia, con su motivo. Todo lo no declarado sigue identico a V1.3.
- **Conteos fijos** (44 Scenarios, salidas de 211 y 265, visitas de 265): actualizados a la candidata.
- **Mecánica multidetalle:** VAR-REP-037 es la única excepción declarada.
- **Textos que la consolidación reemplazó a propósito** (BR-REP-025 sobre el checklist, BR-REP-038 sobre quién devuelve, BR-REP-019): sus aserciones se actualizaron.
- **Replay comercial:** suma check-in, anulación y cortesía, y verifica la entrada a 266 en lugar de la salida.
- **Avisos del validador de referencias:** se mantienen los dos anteriores (FEAT-REP-005/BR-REP-007 y FEAT-REP-007/BR-REP-016, AUD-V14-007) y no hay nuevos.

## D. Decisiones abiertas

Están en `open_items` del registro y en la matriz. Ninguna se completó con una regla inventada.

| Impacto | IDs |
|---|---|
| Bloquean la aprobación | ABI-01 (aprobación final), ABI-02 (revisión de las elecciones de modelado) |
| Bloquean implementar la funcionalidad afectada | ABI-03 precedencias de garantía · 04 quién autoriza la excepción de garantía · 05 equipos sin IMEI o coincidencias ambiguas · 06 responsables por evento de custodia · 09 permisos por tipo de Ajuste Comercial · 10 descuento por debajo de lo cobrado · 12 Compras · 13 WhatsApp: plantillas, disparadores y proveedor · 18 reversibilidad · 31 consentimiento: cómo se obtiene |
| Bloquean la migración a PostgreSQL | ABI-16 (AUD-V14-005, versiones de la definición) · 22 tipos de movimiento · 24 DNI duplicados históricos |
| Posteriores | ABI-07, 08, 11, 14, 15, 17, 19 a 21, 23, 25 a 30 |

## E. Sincronización DC02

Ver [`sincronizacion-dc02.md`](sincronizacion-dc02.md).

## Glosario de entidades, estados y actores

**Actores** (`business/actors/actors.yaml`, sin cambios): ACT-ADMIN Administración, ACT-RECEP Recepción, ACT-TECH Técnico, ACT-COORD Coordinador RMA, ACT-CLIENT Cliente, ACT-SYSTEM Sistema.

- Un nodo declara su actor principal y, cuando corresponde, `actores_alternativos`. Son los responsables predeterminados.
- El permiso efectivo es configurable (BR-REP-039).
- Un usuario puede tener varios roles.

**Entidades principales:**

| Entidad | Qué es |
|---|---|
| Orden de Reparación | Unidad de gestión; un equipo físico. |
| Detalle de Reparación | Unidad técnica de trabajo, con definición vigente e historial de definiciones. |
| Ejecución | Trabajo de un técnico sobre un Detalle. |
| Toma | Participación activa de un técnico en la Orden. |
| Mesa de trabajo | Nombre visible de la Estación: es la misma entidad. |
| Insumo, Movimiento de insumo | Stock y sus movimientos. |
| Cliente | Identificador interno, DNI opcional, nombre y apellido en un campo, clasificación Minorista/Mayorista. |
| Equipo | Identidad física: identificador interno, IMEI y número de serie. |
| Producto del catálogo de Ventas | Referenciado por `tp_id`. |
| Ajuste Comercial | CORTESIA o DESCUENTO, por Orden o por Detalle. |
| Pago, Anulación de pago, Devolución de dinero | Movimientos financieros de la Orden. |
| Documento y Versión de documento | ING, AUT, recepción, final y garantía. |
| Evidencia de firma | Firma en pantalla o archivo firmado, ligada a una versión. |
| Evento de custodia | Recepción confirmada, no recibido, regularización, devolución o entrega. |
| Check-in | Verificación de funciones básicas: realizado o no realizado. |
| Garantía del Detalle | Política aplicada, sugerido, definitivo, ajustes y vencimiento. |
| Solicitud de desistimiento, Cancelación | La cancelación tiene tipo: administrativa, descarte técnico o desistimiento del cliente. |
| Permiso, Rol, Cambio de configuración | Seguridad y auditoría de la configuración. |
| Consentimiento, Envío asistido, Plantilla de mensaje | Comunicaciones con el cliente. |

**Estados del Detalle** (DC17): DEFINIDO, EN_PROGRESO, COMPLETO y CANCELADO.

- Condiciones de un DEFINIDO: BLOQUEADO_POR_RECURSOS y REQUIERE_DEFINICION.
- Autorización del cliente, en una dimensión aparte: PENDIENTE_AUTORIZACION, AUTORIZADO y RECHAZADO.

**Hitos de la Orden:** REQUERIMIENTO, EN_REVISION, HABILITADA, EN_COLA, EN_REPARACION (al iniciar una Ejecución), REPARACION_LISTA, ENTREGADA y CANCELADA. El resultado SIN_REPARACION es un desenlace, no un hito.

**Situación técnica derivada** (resolver BR-REP-012): SIN_DETALLES, TODO_CANCELADO, COMPLETA, EN_EJECUCION, ABIERTA_TRABAJABLE, REQUIERE_REVISION, PENDIENTE_AUTORIZACION y PENDIENTE_RECURSOS, más los bloqueos.

**Custodia** (DC18): sin custodia, bajo custodia, ya devuelto y recepción física sin confirmar.

## Casos funcionales que se resuelven dentro de un nodo (no son Scenarios)

Se verifican como casos de prueba de la funcionalidad. No declaran un recorrido propio del grafo.

| Caso | Dónde | Regla |
|---|---|---|
| Cliente existente por DNI: se muestra y se reutiliza con «Usar estos datos»; un DNI repetido no crea otro Cliente | PROC-REP-030 | BR-REP-020 |
| Cliente nuevo sin proveedor externo habilitado: carga manual sin bloqueo | PROC-REP-030 | BR-REP-021 |
| Equipo con IMEI conocido: Recepción confirma la reutilización y se vincula el historial; si no confirma, Equipo nuevo | PROC-REP-030 | BR-REP-022 |
| Equipo elegido del catálogo (conserva el `tp_id`) o cargado a mano; catálogo sin copia sincronizada | PROC-REP-030 | BR-REP-048 |
| Checklist con verificaciones sin registrar: advertencia y confirmación de continuar | PROC-REP-032 | BR-REP-024, 025 |
| Undécima fotografía rechazada; fotografía descartada en la vista previa que no se guarda | PROC-REP-032 | BR-REP-024 |
| Nota interna que no aparece en el comprobante ING | PROC-REP-032 / 060 | BR-REP-023 |
| Detalle «Otros» con descripción y precio manual | PROC-REP-070 | BR-REP-047 |
| Doble clic al generar el comprobante de ingreso: sin documentos ni registros duplicados | PROC-REP-046 / 060 | BR-REP-046 |
| Comprobante AUT con autorización parcial y nueva versión al autorizar otro Detalle | PROC-REP-046 | BR-REP-031 |
| Corrección de un documento: versión nueva con motivo y referencia; la anterior no se borra | 060 / 280 | BR-REP-031 |
| Ajuste Comercial DESCUENTO por Detalle (porcentaje o importe) que no supera su importe | 265 / 280 | BR-REP-016 |
| Cambio de prioridad por un técnico, trazado con valores anterior y nuevo | Orden en cola o en reparación | BR-REP-034 |
| Check-in no realizado: garantía sugerida de 30 días por Detalle; ajuste manual que no se pisa al volver a registrar | 269 | BR-REP-041, 045 |
| Ingreso y ajuste negativo de stock con confirmación; revalidación de una Orden con un Detalle bloqueado por recursos | Inventario / 120 | BR-REP-049 |
| Inicio de Ejecución rechazado por recepción física sin confirmar, sin movimientos | 185 | BR-REP-033 |
| Mensaje asistido de aviso: queda en el historial sin marcarse como enviado | 260 | BR-REP-044 |
