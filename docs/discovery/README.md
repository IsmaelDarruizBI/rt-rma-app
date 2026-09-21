# Business Process Discovery

Esta carpeta documenta el proceso de descubrimiento y modelado de negocio,
la primera etapa de la trazabilidad E2E descrita en el
[README principal](../../README.md).

## Alcance de esta etapa

- Definir procesos de negocio en YAML (`business/processes/`).
- Definir actores (`business/actors/`).
- Definir reglas de negocio (`business/rules/`).
- Validar la forma de los procesos contra un JSON Schema
  (`business/schemas/process.schema.json`).
- Generar automaticamente una visualizacion Mermaid de cada proceso.

## Fuera de alcance en esta etapa

- Desarrollo de la aplicacion (frontend, backend, base de datos).
- Modelo de datos tecnico.
- Requerimientos funcionales o tecnicos formales.
- Trazabilidad automatizada (ver [traceability/README.md](../../traceability/README.md)).

## Como se agrega un proceso nuevo

1. Crear el archivo YAML en `business/processes/`.
2. Seguir la estructura de `repair-management.yaml` (proceso, nodes, edges).
3. Ejecutar `npm run validate` para validarlo contra
   `business/schemas/process.schema.json`.
4. Ejecutar `npm run generate:mermaid` para producir el diagrama.

`repair-management.yaml` contiene actualmente la V1.2 (approved) del
proceso de Gestion de Ordenes de Reparacion de Rosario Tecno: Business
Process validado con negocio. Esta version constituye la baseline
funcional aprobada para iniciar la siguiente etapa del proyecto, y con
ella **queda cerrada la etapa de Business Process Discovery & Modeling
para esta baseline**. Sobre la V1.1, incorpora la validacion de Estacion
de Trabajo al momento de tomar una Orden (ver "Estaciones de Trabajo" mas
abajo). Ver "Estados conceptuales V1.2", "Estaciones de Trabajo",
"Procesos adicionales descubiertos" y "Pendientes" mas abajo.

La aprobacion es documental (estado del proceso) y no resuelve por si sola
los pendientes funcionales ya identificados (ver "Pendientes" mas abajo):
siguen abiertos exactamente igual que antes de la aprobacion. Cualquier
cambio funcional posterior -incluida la resolucion de esos pendientes-
debera generar una nueva revision del proceso (por ejemplo V1.3), no una
modificacion silenciosa de esta V1.2 aprobada.

## Estados conceptuales V1.2

Propuesta de estados de la Orden de Reparacion, tal como surge del modelado
del proceso (no son todavia un modelo de datos formal). La V1.2 no agrega
estados nuevos respecto de la V1.1: agrega una validacion (Estacion de
Trabajo) antes de poder tomar una Orden EN_COLA, sin cambiar la lista de
estados:

- REQUERIMIENTO
- EN_REVISION — la reparacion requerida todavia no esta definida.
- PENDIENTE_RECURSOS
- HABILITADA
- EN_COLA
- EN_REPARACION — con modo EXCLUSIVA / ABIERTA.
- PENDIENTE_CONTROL
- REPARACION_LISTA
- ENTREGADA
- CANCELADA — estado confirmado, reglas de transicion pendientes de
  definicion (quien puede cancelar, desde que estados, por que motivos).

No se incluye CERRADA (el flujo V1.2 no tiene un paso de cierre adicional).

TERCERIZADA sigue pendiente de definir si sera un estado: ver pendientes.

El comprobante de recepcion se genera para los origenes que lo requieren
(CLIENTE_EXTERNO, RT_GARANTIA_VENTA, RMA_GARANTIA_REPARACION)
independientemente de si la reparacion ya se conoce o la Orden esta
EN_REVISION; RT_INTERNO no lo requiere. El puntaje de una reparacion ya
puede calcularse una vez aprobado el control tecnico; su distribucion entre
multiples tecnicos sigue pendiente (ver Pendientes).

## Resultado de la Orden: SIN_REPARACION

SIN_REPARACION es un **resultado** de la Orden de Reparacion, no un
reemplazo de sus estados (en particular, no reemplaza a ENTREGADA: una
Orden SIN_REPARACION igualmente puede llegar a ENTREGADA, conservando el
resultado SIN_REPARACION). La estructura tecnica definitiva de estado vs.
resultado todavia no esta diseñada.

No equivale a CANCELADA:

- CANCELADA: la Orden fue interrumpida o cancelada.
- SIN_REPARACION: la Orden fue procesada correctamente hasta su fin, pero
  concluyo sin que se realizara una reparacion.

El primer camino implementado hacia SIN_REPARACION es: luego de una
revision tecnica (PROC-REP-065) sobre una Orden EN_REVISION, no se logra
determinar que reparacion necesita el equipo (PROC-REP-068 = No). En el
futuro, otros caminos podrian converger en este mismo resultado; por ahora
son solo posibles extensiones, sin implementar:

- El cliente decide no continuar.
- La reparacion resulta tecnicamente no realizable.
- El presupuesto no es aceptado por el cliente.
- Falta de recursos y decision de no continuar.

## Estaciones de Trabajo

Concepto incorporado en la V1.2 para poder validar, al tomar una Orden de
Reparacion, desde que Estacion de Trabajo se esta operando. Es
documentacion funcional para esta etapa: no define todavia tablas,
columnas ni endpoints.

- Las estaciones son configurables desde la futura aplicacion; el sistema
  no debe asumir una cantidad fija de estaciones. Actualmente existen 4
  estaciones fisicas (3 operativas y 1 no operativa), pero eso no es una
  restriccion del sistema.
- Una estacion puede estar OPERATIVA o NO OPERATIVA.
- Una estacion tiene identificador, nombre, estado operativa/no operativa,
  una o mas computadoras asociadas, y los tipos de reparacion que esta
  habilitada para realizar.
- Cada computadora utilizada en RMA puede estar asociada a una Estacion de
  Trabajo. La asociacion Computadora → Estacion es configurable en la
  aplicacion; no se modela dentro del flujo de Orden de Reparacion, sino
  como funcionalidad de soporte/configuracion.
- La relacion Estacion ↔ Tipo de reparacion es configurable y
  many-to-many: una estacion puede aceptar distintos tipos de reparacion.
- Sesion del tecnico (precondicion del proceso de Orden de Reparacion, no
  modelada como nodos del flujo principal): el tecnico inicia sesion, el
  sistema identifica la computadora utilizada, obtiene la estacion
  configurada para esa computadora y el tecnico confirma la estacion
  detectada; la sesion activa queda asociada a Tecnico + Estacion. Un
  tecnico no pertenece de forma permanente a una estacion: puede trabajar
  en distintas estaciones en distintos momentos.
- Cuando un tecnico toma una Orden de Reparacion (PROC-REP-180) queda
  trazada tambien la estacion utilizada, incluso cuando distintos
  tecnicos continuan la misma Orden desde distintas estaciones.

La administracion completa de estaciones (alta, baja, configuracion de
computadoras y de tipos de reparacion habilitados) sera una funcionalidad
de configuracion de la aplicacion, fuera del flujo principal de Orden de
Reparacion.

### Validaciones antes de tomar una Orden (PROC-REP-172 a PROC-REP-180)

Cuando un tecnico intenta tomar una Orden EN_COLA, las validaciones se
aplican en esta secuencia, y solo se llega a autoasignar la Orden si se
supera cada paso:

1. Validar sesion + estacion: el tecnico tiene sesion activa, esa sesion
   tiene una Estacion de Trabajo asociada/confirmada, y esa estacion esta
   configurada. Si falta cualquiera de estas tres cosas, la Orden no se
   autoasigna, no hay override posible, y la Orden permanece EN_COLA.
2. Validar operatividad: la estacion debe estar OPERATIVA. Una estacion
   NO OPERATIVA tampoco admite override: la Orden permanece EN_COLA.
3. Validar compatibilidad con el tipo de reparacion: solo se evalua una
   vez superados los dos pasos anteriores. Si la estacion (operativa) no
   esta configurada para el tipo de reparacion requerido, el sistema
   advierte la incompatibilidad y, recien alli, permite el override de un
   usuario autorizado (ver BR-REP-011); si no se autoriza, la Orden
   permanece EN_COLA.
4. Recien entonces se autoasigna la Orden (PROC-REP-180): pasa a
   EN_REPARACION y queda registrada la estacion utilizada.

## Procesos adicionales descubiertos

Durante el modelado de la V1.2 se identificaron los siguientes procesos,
relacionados con el dominio RMA:

- Gestion de Ordenes de Compra de repuestos.
- Gestion de Ordenes de Venta mayorista de repuestos.

Estos procesos **no forman parte** del Business Process de Gestion de
Ordenes de Reparacion V1.2 y no se modelan ni desarrollan en esta etapa.
Se modelaran a futuro como procesos de negocio independientes, cada uno
con su propio YAML bajo `business/processes/`.

## Pendientes

Puntos identificados durante el modelado de la V1.2 que quedan pendientes de
validacion funcional con el negocio antes de incorporarse al proceso:

- Flujo completo de tercerizacion.
- Definir si TERCERIZADA es un estado.
- Presupuesto y aprobacion de cliente externo.
- Flujo de SCRAP.
- Flujo de devolucion a proveedor.
- Modelo definitivo de reproceso (reabrir misma OR, crear nueva OR
  relacionada, registrar evento de reproceso, o un modelo combinado). La
  unica relacion confirmada por ahora es que RMA_GARANTIA_REPARACION genera
  una nueva Orden relacionada con la Orden original.
- Reglas de garantia RMA configurable.
- Override de garantia vencida.
- Distribucion de puntos entre multiples tecnicos.
- Catalogo definitivo de prioridades.
- Estado terminal definitivo de RT_INTERNO.
- Reglas de CANCELADA: quien, cuando y motivo.
- Actor/regla que define el modo EXCLUSIVA / ABIERTA de EN_REPARACION.

---

# PROC-REP V1.3 (draft)

Todo lo anterior de este documento describe **V1.2 (approved)**, que
permanece intacta como baseline historica
(`business/processes/repair-management.yaml`,
`business/rules/business-rules.yaml`). Esta seccion documenta **V1.3
(draft)**, una revision funcional independiente
(`business/processes/repair-management-v1.3.yaml`,
`business/rules/business-rules-v1.3.yaml`) que convive con V1.2 sin
reemplazarla todavia. Las 7 Features actuales siguen derivadas de V1.2 y
no fueron tocadas en esta iteracion.

## Cambio central: Orden con 1..N Detalles

La Orden de Reparacion deja de asumir una unica reparacion. Pasa a tener
1..N Detalles de Reparacion (unidad tecnica de trabajo), cada uno con su
propio Tipo de Reparacion, precio snapshot, Ejecuciones e Insumos:

```text
OrdenReparacion (unidad de gestion)
  -> DetalleReparacion (unidad tecnica de trabajo, 1..N por Orden)
      -> Ejecucion (1..N por Detalle; maximo una activa por Orden)
      -> Insumo utilizado -> MovimientoInventario
```

El tecnico toma la Orden completa (igual que V1.2) y luego selecciona un
Detalle para trabajar. Reemplaza el modo EXCLUSIVA/ABIERTA de V1.2 por
una regla mas simple: como maximo una Ejecucion activa por Orden en todo
momento, porque la Orden representa un unico equipo fisico (BR-REP-007
V1.3).

## Resolver de estado de Orden

El estado tecnico agregado de la Orden nunca se fija manualmente: se
calcula siempre a partir de propiedades derivadas de sus Detalles
(BR-REP-012), mediante una politica de reglas ordenada por prioridad,
pensada para poder ampliarse (nueva condicion + prioridad + resultado +
referencia a Business Rule) sin reescribir nodos del proceso.

Propiedades derivadas de cada Detalle (estado tecnico: PENDIENTE /
EN_PROCESO / COMPLETO / CANCELADO; condicion/bloqueo separada y
extensible: SIN_BLOQUEO / REQUIERE_DEFINICION / BLOQUEADO_POR_RECURSOS):

```text
es_terminal            = esta_completo OR esta_cancelado
es_trabajable           = PENDIENTE AND SIN_BLOQUEO AND tiene Tipo definido
esta_en_ejecucion       = EN_PROCESO
requiere_revision       = PENDIENTE AND REQUIERE_DEFINICION
bloqueado_por_recursos  = PENDIENTE AND BLOQUEADO_POR_RECURSOS
esta_completo           = COMPLETO
esta_cancelado          = CANCELADO
```

Matriz de prioridad (primera regla coincidente gana):

| Prioridad | Condicion | Resultado agregado |
|---|---|---|
| 0 | `cantidad_detalles = 0` (BR-REP-013) | `SIN_DETALLES` -unico resultado posible, deterministico; nunca "REQUERIMIENTO o EN_REVISION segun contexto" (ver mas abajo por que esa formulacion anterior era ambigua y como se corrigio)- |
| 1 | Todos terminales Y todos CANCELADO | `TODO_CANCELADO` -> Orden CANCELADA |
| 2 | Todos terminales Y existe >=1 COMPLETO | `COMPLETA` -> habilita Control Tecnico (incluye el caso "algunos CANCELADO + al menos uno COMPLETO", por ejemplo tras cancelar los Detalles no terminales de la Orden) |
| 3 | Existe una Ejecucion activa | `EN_EJECUCION` |
| 4 | Existe >=1 Detalle `es_trabajable` | `ABIERTA_TRABAJABLE` |
| 5 | Ninguno trabajable Y existe >=1 `requiere_revision` | `REQUIERE_REVISION` |
| 6 | Ninguno trabajable Y existe >=1 `bloqueado_por_recursos` | `PENDIENTE_RECURSOS` |
| fail-safe | Ninguna de las anteriores aplica (con `cantidad_detalles > 0`) | `CONTEXTO_INCONSISTENTE` -no es un estado de negocio: ver "Fail-safe del resolver" mas abajo- |

Esta misma politica se invoca desde tres puntos del flujo sin duplicar
logica: PROC-REP-090 (gate inicial de habilitacion), PROC-REP-211
(despues de cada Ejecucion, de un rechazo de control, de cancelar un
Detalle o de cancelar los Detalles no terminales de la Orden) y,
implicitamente, PROC-REP-172 (compatibilidad agregada de Estacion, que
reutiliza `es_trabajable`).

Hitos de **workflow** (explicitos, avanzan por eventos): REQUERIMIENTO,
EN_REVISION (fijado por PROC-REP-045/PROC-REP-055, nunca por el
resolver), HABILITADA, EN_COLA, EN_REPARACION, REPARACION_LISTA (requiere
ademas el evento externo "control tecnico aprobado" - no es deducible
solo de los Detalles), ENTREGADA, CANCELADA. PENDIENTE_CONTROL no se
persiste como estado propio: es la combinacion computada
`workflow=EN_REPARACION AND agregado=COMPLETA`.

`REQUIERE_REVISION` y `PENDIENTE_RECURSOS` son puramente agregados
derivados del resolver, nunca estados de workflow. En particular,
`REQUIERE_REVISION` es deliberadamente un nombre distinto de
`EN_REVISION`: son dos dimensiones separadas (agregado tecnico vs.
workflow) que no deben compartir nombre. La politica de workflow puede,
si asi se decide, usar `REQUIERE_REVISION` como una de las senales que
llevan o mantienen la Orden en el estado de workflow `EN_REVISION`, pero
esa es una decision de politica de workflow, no una equivalencia
automatica ni una segunda fuente de verdad.

### Correccion: `cantidad_detalles = 0` ya no es una regla ambigua

Una version anterior de este documento hacia que la regla de prioridad 0
devolviera "REQUERIMIENTO o EN_REVISION segun contexto" -dos resultados
posibles para la misma condicion, es decir no deterministica-. Se
corrigio separando con precision las dos responsabilidades:

- El **resolver tecnico** (el que agrega Detalles) devuelve, con
  `cantidad_detalles = 0`, un unico resultado posible: `SIN_DETALLES`. No
  intenta -ni le corresponde- distinguir REQUERIMIENTO de EN_REVISION,
  porque esa distincion no depende de ningun Detalle (no puede depender
  de algo que todavia no existe).
- Esa distincion es responsabilidad exclusiva del **workflow**, fijada
  por eventos explicitos ya modelados: PROC-REP-040 (Crear Orden de
  Reparacion) pone a la Orden en REQUERIMIENTO; PROC-REP-045 (decision)
  seguido de PROC-REP-055 (Marcar Orden en revision) la pasan a
  EN_REVISION cuando al momento del ingreso no se conoce ningun Detalle.
  Ninguno de los dos consulta al resolver tecnico para decidirlo.
- Como consecuencia de la topologia actual del diagrama, el resolver
  nunca llega a invocarse mientras `cantidad_detalles = 0`: los dos
  nodos que lo invocan (PROC-REP-090 y PROC-REP-211) solo son
  alcanzables despues de PROC-REP-070/075, que son los que crean el
  primer Detalle. `SIN_DETALLES` queda igual documentado, como salida
  deterministica de una regla explicita (BR-REP-013) dentro de la misma
  politica extensible, pensada como proteccion para cualquier invocacion
  futura del resolver que no respete esa precondicion (por ejemplo desde
  una UI o herramienta de diagnostico).

## Capacidades transversales (no modeladas como nodos)

Siguiendo el mismo criterio que V1.2 ya aplica a "Sesion del tecnico" y a
la configuracion de Estaciones (documentadas en prosa, no como nodos del
flujo principal), V1.3 documenta asi el **registro de Pagos** y el
**registro de Cortesia**: son acciones que pueden ocurrir en cualquier
momento desde que la Orden esta habilitada en adelante, no pasos
secuenciales de un unico punto del proceso. Se documentan funcionalmente
aqui en vez de agregarse como nodos:

- **Pago**: importe, medio de pago (catalogo configurable), fecha/hora,
  usuario, referencia/comprobante cuando corresponda. Puede ser
  anticipado, parcial, o usar varios medios en la misma Orden.
- **Cortesia** (de Detalle o de Orden completa): unicamente ACT-ADMIN
  puede autorizarla, registrando fecha/hora y motivo obligatorio
  (BR-REP-016). No modifica el precio original del Detalle, que
  permanece como dato historico dentro del Subtotal.

### Registrar Pago (transversal) vs. Completar Cobro (secuencial)

Son dos conceptos distintos que no deben confundirse (BR-REP-017):

- **Registrar Pago** es transversal: puede ocurrir en cualquier momento
  de la vida de la Orden (seña, anticipo, pagos parciales, varios medios
  de pago), no unicamente al final. No se modela como nodo, igual que el
  resto de las capacidades de esta seccion.
- **Completar Cobro** SI se modela como nodo, porque es una fase
  secuencial concreta del cierre: recien despues de REPARACION_LISTA se
  determina el Total Cobrable definitivo y se calcula el Saldo
  (PROC-REP-265). Si Saldo > 0, la Orden queda pendiente de completar
  cobro: pueden registrarse uno o mas Pagos adicionales -mediante el
  mismo mecanismo transversal de arriba, no un mecanismo aparte- y el
  Saldo se recalcula despues de cada uno (PROC-REP-266 -> PROC-REP-265,
  "Revalidar"). Solo con Saldo = 0, cortesia total, o condicion
  no-cobrable por origen se habilita la entrega (PROC-REP-270); sin
  override para deuda en V1.3.

No modelar todos los pagos como si ocurrieran unicamente al final de la
Orden, y no modelar la entrega sin este gate final de Saldo.

Calculo comercial (extensible, sin cerrar la puerta a capas futuras):

```text
SUBTOTAL  = suma de precios snapshot de Detalles NO CANCELADOS
          + AJUSTES COMERCIALES PREVIOS (V1.3: solo CORTESIA_DETALLE / CORTESIA_ORDEN)
          = BASE COMERCIAL
          (fuera de V1.3: + impuestos/recargos/otros conceptos = TOTAL COBRABLE)

SALDO = TOTAL COBRABLE - TOTAL PAGADO
```

Un Detalle CANCELADO conserva su Tipo, precio historico y trazabilidad,
pero no participa del Subtotal (distinto de una cortesia, que si integra
el Subtotal y luego se resta como Ajuste Comercial).

## Cancelacion

La cancelacion **si esta modelada** en V1.3 (a diferencia de V1.2, que
nunca la representa como nodos: CANCELADA es alli solo un estado
documentado en prosa, sin nodos ni edges propios). Lo que queda
pendiente no es "si existe cancelacion", sino puntos especificos
detallados en "Pendientes especificos de V1.3" mas abajo (quien puede
autorizarla, catalogo de motivos, consecuencias comerciales).

Un Detalle no terminal puede cancelarse individualmente (PROC-REP-300),
conservando su historial. Cancelar una Orden completa (PROC-REP-305) **no
implica automaticamente que termine CANCELADA**: se corrigio esa
interpretacion. La accion cancela los Detalles NO TERMINALES
(preservando los ya COMPLETO) y a continuacion se recalcula el estado
agregado mediante el resolver (PROC-REP-211, BR-REP-014):

- **(A)** Si tras la cascada TODOS los Detalles quedan CANCELADO ->
  Orden = CANCELADA, sin pasar por control tecnico ni por
  REPARACION_LISTA.
- **(B)** Si existe al menos un Detalle COMPLETO y el resto quedo
  CANCELADO -> la Orden queda tecnicamente COMPLETA y continua el flujo
  normal: Control Tecnico -> REPARACION_LISTA -> cierre comercial ->
  entrega cuando corresponda. Motivo: ese Detalle representa trabajo
  efectivamente realizado, que debe poder controlarse, cobrarse y
  cerrarse correctamente -no se descarta solo porque otros Detalles de
  la misma Orden se cancelaron-.

En ambos casos (Detalle u Orden) la cancelacion no puede ejecutarse
mientras exista una Ejecucion activa: primero debe cerrarse/
interrumpirse. Nunca se reescribe historia tecnica real.

### Reconciliacion de insumos antes de cancelar

**Invariante: un Detalle CANCELADO no puede conservar reservas activas de
inventario.** No se crea un mecanismo nuevo para garantizarlo: se
reutiliza el que ya existe (PROC-REP-210, BR-REP-005), que en cada
finalizacion de Ejecucion -Completada o Interrumpida- consume lo
efectivamente utilizado, libera toda reserva no utilizada y registra
desperdicio cuando corresponda, siempre trazado al Detalle que lo
origino.

La razon por la que esto ya esta garantizado por la topologia actual, sin
necesidad de un paso adicional en PROC-REP-300/305: un Detalle solo puede
cancelarse si es no terminal Y no tiene Ejecucion activa (PENDIENTE). El
unico camino desde EN_PROCESO hacia PENDIENTE es interrumpir la Ejecucion
(PROC-REP-200, resultado "Interrumpido"), y ese paso ya pasa
obligatoriamente por PROC-REP-210 antes de que el Detalle quede
disponible de nuevo. Es decir: para cuando un Detalle con Ejecucion
previa llega a ser candidato a cancelacion, sus insumos ya estan en
CONSUMIDO, LIBERADO o DESPERDICIO -nunca en RESERVADO-. Un Detalle sin
Ejecucion previa nunca tuvo reserva que reconciliar. Los movimientos
historicos (incluyendo los de un Detalle luego cancelado) nunca se
borran ni reescriben; conservan su trazabilidad al Detalle de origen.

## Fail-safe del resolver

Proteccion conceptual, no un estado de negocio nuevo: si
`cantidad_detalles > 0` y ninguna regla valida de la matriz de prioridad
aplica, el sistema futuro NO debe inventar un estado ni continuar
silenciosamente. Debe tratarse como **CONTEXTO_INCONSISTENTE / invariante
violada** y reportarse para diagnostico (ver la fila "fail-safe" de la
matriz y BR-REP-012).

Esto no deberia ocurrir si la politica de reglas se mantiene exhaustiva,
pero es exactamente la proteccion que hace segura la extensibilidad ya
prevista para el catalogo de condicion/bloqueo del Detalle (hoy
SIN_BLOQUEO / REQUIERE_DEFINICION / BLOQUEADO_POR_RECURSOS, "extensible a
futuro"): si en el futuro se agrega un nuevo valor de bloqueo sin
actualizar tambien las prioridades del resolver, un Detalle con ese
bloqueo nuevo no encajaria en ninguna regla existente. El fail-safe evita
que ese descuido derive en un estado de Orden erroneo silencioso.

Ejemplos de combinaciones que el futuro diseño tecnico deberia poder
detectar/impedir como invariantes violadas (no exhaustivo):

- un Detalle EN_PROCESO sin ninguna Ejecucion activa asociada;
- mas de una Ejecucion activa simultanea en la misma Orden (viola
  BR-REP-007);
- un Detalle PENDIENTE sin Tipo de Reparacion asignado y sin condicion
  REQUIERE_DEFINICION (inconsistencia entre dos hechos que deberian ir
  juntos);
- cualquier otra combinacion que las invariantes funcionales de V1.3
  declaren imposible.

Este mecanismo queda documentado para el posterior diseño tecnico; no se
implementa en este borrador (no hay base de datos ni codigo en esta
etapa).

## Pendientes especificos de V1.3

Ademas de todos los pendientes de V1.2 listados arriba (que siguen
abiertos sin cambios), V1.3 identifico estos pendientes adicionales,
deliberadamente fuera de alcance de esta revision:

- Presupuestacion y aprobacion de cliente externo (se mantiene fuera de
  V1.3, como en V1.2).
- Consecuencias comerciales de la cancelacion (reembolso de pagos ya
  realizados sobre Detalles luego cancelados).
- Costo de reparacion (mano de obra + costo real de insumos vs. precio):
  metodologia de valoracion de stock (FIFO, promedio, lote especifico)
  todavia no definida.
- Impuestos, recargos, descuentos y otros conceptos comerciales futuros
  entre Base Comercial y Total Cobrable.
- Si la cortesia puede ser parcial o siempre equivale al 100% del precio
  del Detalle/Orden.
- Quien esta autorizado a cancelar un Detalle o una Orden (que actor,
  con que permiso). No se asume ningun actor: los nodos PROC-REP-300 y
  PROC-REP-305 omiten deliberadamente el campo `actor` en el YAML (el
  schema no lo exige para nodos `activity`) en vez de inventar uno sin
  aprobacion de negocio.
- Si el reproceso de RMA_GARANTIA_REPARACION debe referenciar la Orden
  origen completa o el Detalle especifico que fallo.
- Distribucion/acreditacion de puntaje entre multiples tecnicos que
  participaron de un mismo Detalle (ya pendiente en V1.2, ahora ademas
  interactua con multiples Ejecuciones por Detalle).
- Catalogo definitivo de motivos de cancelacion/interrupcion de
  Ejecucion.
- Garantia de reparacion post-entrega a nivel Detalle (hoy solo se
  relaciona a nivel Orden).
- Multi-moneda en precios y pagos.
