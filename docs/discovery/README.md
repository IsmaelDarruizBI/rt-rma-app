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

## Toma y liberacion de Orden (participacion activa)

Una Orden corresponde a un unico equipo fisico. Cuando un tecnico toma
una Orden (PROC-REP-180), toma la Orden COMPLETA, no solamente un
Detalle: existe como concepto funcional una toma/participacion activa
(Orden + tecnico + estacion + fecha/hora de inicio). Como maximo puede
existir UNA toma activa por Orden en simultaneo (BR-REP-018 V1.3) -esto
es distinto pero complementario de BR-REP-007 (maximo una Ejecucion
activa por Orden)-.

```text
Tecnico toma OR
  -> queda registrada una participacion activa (Orden + tecnico + estacion + inicio)
  -> selecciona Detalle (PROC-REP-181)
  -> inicia Ejecucion, trabaja, completa/interrumpe
  -> resolver recalcula (PROC-REP-211)
```

Si el resolver determina que sigue existiendo al menos un Detalle
trabajable y la Orden continua tomada por el tecnico actual, se pregunta
explicitamente (PROC-REP-212): **¿el tecnico desea continuar trabajando
esta Orden?**

- **Si** -> mantiene la toma activa y vuelve a seleccionar Detalle
  (PROC-REP-181).
- **No** -> PROC-REP-213 "Liberar Orden de Reparacion": cierra la
  participacion activa (fecha/hora de fin), la Orden vuelve a EN_COLA
  (PROC-REP-170), y otro tecnico -o el mismo- puede tomarla nuevamente
  pasando otra vez por PROC-REP-172/PROC-REP-180.

No se libera automaticamente una Orden trabajable solo porque termino un
Detalle: la decision de continuar o liberar es siempre una accion
explicita del tecnico. Distinto es el caso en que ya no queda ningun
Detalle trabajable porque la Orden quedo COMPLETA, PENDIENTE_RECURSOS,
REQUIERE_REVISION o TODO_CANCELADO: alli no se ofrece "continuar con otro
Detalle", y la participacion activa se cierra automaticamente (no hay
nada mas que preguntar).

El historial completo de participaciones (quien tomo la Orden, cuando,
desde que estacion, cuando la libero) se conserva siempre; nunca se
sobrescribe. Este historial es la base sobre la que, a futuro, podra
construirse reporting por tecnico (ver "Pendientes especificos de V1.3").

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

### Correccion: PENDIENTE_RECURSOS y REQUIERE_REVISION nunca vuelven a EN_COLA

Una version anterior de este borrador hacia que PROC-REP-211, ante
cualquier resultado "ninguno trabajable pero tampoco todos terminales",
volviera a PROC-REP-170 (EN_COLA). Esto era incorrecto: una Orden
PENDIENTE_RECURSOS o REQUIERE_REVISION no tiene ningun Detalle trabajable,
por lo que no debe quedar disponible/tomable en la cola. Se corrigio
separando ambos resultados en sus propios circuitos de espera:

- **PENDIENTE_RECURSOS** -> PROC-REP-120 ("Detalle(s) pendientes por
  recursos"). Permanece esperando hasta que ocurra un evento de
  revalidacion (por ejemplo, cambio de disponibilidad de insumos), que
  dispara nuevamente PROC-REP-080 ("Validar factibilidad por Detalle").
  No es un loop inmediato automatico: es un re-ingreso disparado por un
  evento posterior.
- **REQUIERE_REVISION** -> PROC-REP-125 ("Detalle(s) pendientes de
  revision tecnica"), nodo nuevo, analogo a PROC-REP-120 pero para la
  dimension de revision en vez de recursos. A diferencia de
  PENDIENTE_RECURSOS, aqui PROC-REP-080 no puede resolver la causa: valida
  factibilidad/recursos, pero un Detalle con condicion REQUIERE_DEFINICION
  necesita primero una accion tecnica que le quite esa condicion. Por eso
  la espera continua hacia dos nodos nuevos, tambien acotados a ESE
  Detalle en particular (no a la Orden completa):
  - **PROC-REP-126** "Realizar revision tecnica de Detalle pendiente" -
    analogo a PROC-REP-065, pero sobre un Detalle ya existente.
  - **PROC-REP-127** "Definir/actualizar reparacion del Detalle" - analogo
    a PROC-REP-070/075, redefine el MISMO Detalle (nueva definicion
    vigente, la anterior se conserva historicamente) y le quita la
    condicion REQUIERE_DEFINICION cuando corresponde.

  Quien ASIGNA REQUIERE_DEFINICION es `PROC-REP-200` con su tercer
  resultado "Requiere redefinicion" (Ejecucion cerrada como no completada,
  Detalle PENDIENTE + REQUIERE_DEFINICION, motivo obligatorio, luego
  PROC-REP-210 y PROC-REP-211); no existe un nodo aparte que la produzca.
  `PROC-REP-125` solo representa la espera/circuito posterior,
  `PROC-REP-126` realiza la revision tecnica y `PROC-REP-127` redefine y
  RETIRA la condicion. Si otro Detalle sigue trabajable, `PROC-REP-211`
  devuelve ABIERTA_TRABAJABLE y recien cuando no queda ninguno trabajable
  se llega a REQUIERE_REVISION -> 125. REQUIERE_REVISION no es un estado
  de workflow. "Interrumpido" (definicion vigente) no es lo mismo que
  "Requiere redefinicion" (definicion invalida). Un `PROC-REP-127`
  invalida cualquier override de `PROC-REP-130` anterior del mismo
  Detalle (BR-REP-003) y preserva historicamente la definicion previa
  (BR-REP-015), incluso si se confirma el mismo Tipo.

  Recien despues de PROC-REP-127 se revalida factibilidad con
  PROC-REP-080 (el Detalle ya definido). Deliberadamente NO se reutiliza
  el circuito inicial de revision de la Orden completa (PROC-REP-050,
  055, 060, 065, 068, 069): ese circuito asume que la Orden todavia no
  tiene ningun Detalle, y reutilizarlo aqui podria regenerar
  incorrectamente el comprobante de recepcion o convertir la revision de
  un unico Detalle en SIN_REPARACION de toda la Orden -efectos que no
  corresponden cuando ya existen uno o mas Detalles definidos y lo
  pendiente es solo sobre alguno en particular-. El Detalle conserva su
  identidad y su historial completo (incluida la revision de
  PROC-REP-126): no se crea un Detalle nuevo.

Ambos agregados siguen sin mezclarse entre si ni con el estado de
workflow EN_REVISION (ver mas abajo).

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
- **Override de recursos de un Detalle** (MVP v2, BR-REP-003): unicamente
  ACT-COORD puede autorizarlo, con motivo obligatorio, sobre cualquier
  Detalle PENDIENTE con condicion BLOQUEADO_POR_RECURSOS. Registra
  usuario, fecha, Detalle, validacion ignorada y motivo; no reserva ni
  consume stock. No exige que toda la Orden este bloqueada: tambien
  aplica con factibilidad parcial (otros Detalles trabajables, Orden
  habilitada, en cola, tomada o en reparacion), y ahi no reinicia el
  proceso (no vuelve a PROC-REP-140, no cierra la toma ni toca la
  Ejecucion en curso). Solo cuando la Orden esta detenida en PROC-REP-100
  ("ningun Detalle trabajable") la autorizacion resuelve PROC-REP-110 = Si
  y la Orden continua 130 -> 140. Es una unica capacidad: misma
  validacion y misma vigencia (la autorizacion vale mientras no exista un
  PROC-REP-127 posterior del mismo Detalle).

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

**Correccion funcional (MVP v2): autorizacion para Registrar Pago.** El
MVP actual dejaba registrar un Pago a cualquier usuario activo, sin
restriccion de rol; es un bug funcional. BR-REP-017 ahora define
explicitamente que puede registrar un Pago todo usuario OPERATIVO ACTIVO
EXCEPTO Tecnico (`ACT_ADMIN`, `ACT_RECEP`, `ACT_COORD` si estan activos;
`ACT_TECH` nunca). No es una decision de frontend: el backend debe hacer
cumplir `usuario activo AND rol != TECNICO`, trazable hacia
Business Rule (BR-REP-017) -> Technical Requirement -> autorizacion en el
backend -> test de API -> accion disponible en el frontend. No se
implementa el fix en Python en esta etapa: este repositorio cierra
primero el contrato funcional.

### Comprobante final despues del cobro

Corregido en este borrador: el comprobante final (PROC-REP-280) se
genera **despues** de que PROC-REP-265 aprueba la condicion de entrega,
no antes. Una version anterior lo generaba antes de completar el cobro,
lo que podia dejarlo desactualizado si despues se registraba un pago
final. Secuencia vigente, para CLIENTE_EXTERNO / entrega al cliente:

```text
REPARACION_LISTA (o SIN_REPARACION)
  -> PROC-REP-260 Notificar cliente
  -> PROC-REP-265 Completar cobro / validar saldo
       -> No cumplida -> PROC-REP-266 registrar Pago(s) -> revalida PROC-REP-265
       -> Si cumplida  -> PROC-REP-280 Generar comprobante final
                        -> PROC-REP-270 Entregar equipo
```

El comprobante final debe poder reflejar: Detalles finales, Subtotal,
Ajustes Comerciales, Total Cobrable, todos los Pagos registrados, y el
Saldo final -que para una Orden cobrable entregable debe ser el
definitivo al momento de la entrega (0, salvo cortesia total o condicion
no-cobrable)-. Registrar Pago sigue siendo una capacidad transversal:
pueden existir señas/anticipos antes de este punto igual que siempre; lo
unico que se mueve es el cierre/comprobante definitivo, que ahora ocurre
despues del gate de cobro y no antes.

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

## SIN_REPARACION en V1.3: sin Diagnostico cobrable

Corregido en este borrador: en V1.3 **no existe Diagnostico cobrable**.
La revision tecnica (PROC-REP-065) puede realizarse para determinar que
reparacion necesita el equipo, pero:

- no es por si misma un Detalle de Reparacion cobrable;
- no genera precio;
- no genera Subtotal;
- no existe un Tipo de Reparacion "Diagnostico" en V1.3.

Por lo tanto, SIN_REPARACION significa: la Orden fue
recibida/revisada/procesada, pero finalmente no se definio ni se realizo
una reparacion. Consecuencia directa: SIN_REPARACION implica Subtotal = 0
-no existe reparacion realizada ni importe cobrable asociado (ver
PROC-REP-069, BR-REP-010)-. Una version anterior de este borrador permitia
que SIN_REPARACION coexistiera con un importe cobrable proveniente de un
supuesto "Detalle de Diagnostico COMPLETO y cobrable"; esa referencia se
elimino de PROC-REP-069, BR-REP-010 y PROC-REP-280.

SIN_REPARACION sigue siendo distinto de CANCELADA:

- **SIN_REPARACION**: el proceso llego legitimamente a la conclusion de
  que no habra reparacion.
- **CANCELADA**: el trabajo o el proceso fue cancelado.

Si en el futuro Rosario Tecno decide cobrar el diagnostico, sera una
nueva regla/capacidad a diseñar, fuera de alcance de V1.3.

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

## Features V1.3

PROC-REP V1.3 tiene ahora su propia descomposicion funcional en 9
Features draft (`business/features/repair-management-features-v1.3.yaml`),
independiente de las 7 Features de V1.2
(`business/features/repair-management-features.yaml`), que permanecen
intactas como baseline historica y no se modificaron. Ninguna User Story
ni Spec Kit fueron creados en esta iteracion.

Igual que en V1.2, la relacion Feature <-> process_nodes y Feature <->
business_rules es N:M: un mismo nodo o regla puede pertenecer a mas de
una Feature cuando es transversal. El resolver tecnico de estado de
Orden (BR-REP-012) no es una Feature independiente -es una politica
transversal que varias Features invocan-, mientras que la cancelacion si
es una Feature propia (FEAT-REP-009) por tener comportamiento y reglas
propias.

| Feature | Nombre | Nodos propios/compartidos destacados |
|---|---|---|
| FEAT-REP-001 | Ingreso y creacion de Orden de Reparacion | 010, 020, 025, 030, 035, 040, 050, 060 |
| FEAT-REP-002 | Diagnostico y gestion de Detalles de Reparacion | 045, 055, 065, 068, 069, 070*, 075*, 125, 126, 127* |
| FEAT-REP-003 | Validacion de factibilidad y habilitacion | 080, 090, 100, 110, 120, 130, 140 |
| FEAT-REP-004 | Gestion de prioridad, cola, toma y liberacion tecnica | 150, 170, 172, 180, 212, 213 |
| FEAT-REP-005 | Ejecucion de Detalles y gestion de insumos | 181, 174, 176, 178, 179, 185, 186, 190, 200, 210, 211* |
| FEAT-REP-006 | Control tecnico, retrabajo y evaluacion | 220, 230, 235, 245, 240, 211* |
| FEAT-REP-007 | Gestion comercial y pagos de la Orden | 265, 266, 070*, 075*, 127*, 280* |
| FEAT-REP-008 | Finalizacion, entrega e integracion del resultado | 250, 260, 280*, 270, 290 |
| FEAT-REP-009 | Cancelacion de Detalles y Orden | 300, 305, 211* |

`*` = nodo compartido con otra Feature (N:M). Nodos compartidos: PROC-REP-070/075/127
(entre FEAT-REP-002 y FEAT-REP-007, porque alli se registra el precio
snapshot), PROC-REP-211 (entre FEAT-REP-005, FEAT-REP-006 y FEAT-REP-009,
porque las tres reevaluan la situacion de la Orden mediante el mismo
resolver -pero no simultaneamente: ver la siguiente seccion-), y
PROC-REP-280 (entre FEAT-REP-007 y FEAT-REP-008, porque el comprobante
final materializa el resultado comercial aunque su generacion/entrega sea
responsabilidad principal de Finalizacion). Cobertura: los 56
process_nodes funcionales de PROC-REP V1.3 (excluyendo
EVT-REP-001/EVT-REP-999) quedan cubiertos por al menos una Feature.

Notas de numeracion: FEAT-REP-007 (Comercial y Pagos) precede
conceptualmente a FEAT-REP-008 (Finalizacion y Entrega), porque el gate
de Saldo ocurre antes del comprobante final y la entrega. FEAT-REP-009
(Cancelacion) queda al final de la numeracion porque es transversal -no
una etapa secuencial posterior a FEAT-REP-008-.

### Feature <-> Process Node compartido: ALWAYS vs. CONTEXTUAL

Compartir un process_node entre varias Features sigue siendo valido -la
relacion es N:M por diseño-, pero no todos los nodos compartidos
significan lo mismo. `shared_node_bindings` (campo opcional en cada
Feature, ver `business/schemas/feature.schema.json` y
`scripts/lib/feature-model.ts`) distingue dos semanticas:

- **ALWAYS**: el nodo ejecuta simultaneamente comportamiento de todas las
  Features que lo declaran ALWAYS, cada vez que se atraviesa. Ejemplo:
  `PROC-REP-070` es ALWAYS para FEAT-REP-002 (define el Detalle) y para
  FEAT-REP-007 (registra su price snapshot) - ambas cosas ocurren en el
  mismo paso.
- **CONTEXTUAL**: el nodo es un mecanismo compartido, y que Feature esta
  funcionalmente involucrada depende de por que transicion concreta se
  alcanzo. El contexto se identifica por `from + condition + to` (la
  misma identidad de edge que usan los Scenarios), declarado en
  `when.incoming_edges`. Ejemplo: `PROC-REP-211` (el resolver
  centralizado) es CONTEXTUAL para FEAT-REP-005 (via PROC-REP-186 o
  PROC-REP-210, tras una Ejecucion o una reserva fallida), para
  FEAT-REP-006 (via PROC-REP-235, tras un rechazo de control) y para
  FEAT-REP-009 (via PROC-REP-300 o PROC-REP-305, tras una cancelacion) -
  las tres reutilizan el mismo nodo, pero solo una esta funcionalmente
  activa segun por donde se llego.

`scripts/validate-references.ts` exige, como ERROR (no warning), que toda
Feature propietaria de un node genuinamente compartido (mas de un
process_nodes[] lo declara) tenga exactamente un `shared_node_binding`
para ese node: evita que un futuro node compartido quede con su semantica
sin explicar. El campo es opcional y retrocompatible: V1.2 no tiene nodes
compartidos hoy, por lo que esta regla nunca se activa alli y no requiere
migrarla.

Tres conceptos distintos, deliberadamente NO llamados "coverage" todavia:

- **touched_features**: interseccion bruta entre los nodos que un
  Scenario recorre y `Feature.process_nodes[]`. Diagnostico only - puede
  incluir falsos positivos semanticos en nodes CONTEXTUAL alcanzados por
  la transicion "equivocada".
- **active_features**: `touched_features` refinado por ALWAYS/CONTEXTUAL
  y por `FUNCTIONAL_ACTION.feature` - las Features genuinamente
  involucradas. Es lo que el viewer muestra.
- **covered_features**: NO implementado todavia. Reservado para un futuro
  Coverage Analyzer (agregando muchos Scenarios); no debe confundirse con
  "un Scenario paso una vez por esta Feature".

## Scenarios / Happy Path V1.3

PROC-REP V1.3 incorpora una tercera capa, `Scenarios`
(`business/scenarios/repair-management-scenarios-v1.3.yaml`), ademas de
Business Rules y Features:

```text
Business Process
  |- Business Rules
  |- Features
  `- Scenarios
       `- HP-REP-001
```

Un Scenario es una capa SOBRE el Business Process: no lo reemplaza ni lo
duplica. No crea un Mermaid alternativo ni nodos nuevos; cada paso
`PROCESS_EDGE` referencia una transicion real de `process.edges`
(identificada por from + condition + to, nunca solo por from/to, porque
pueden existir varias transiciones entre los mismos dos nodos), y cada
paso `FUNCTIONAL_ACTION` representa una capacidad funcional transversal
sin nodo propio (por ejemplo Registrar Pago, FEAT-REP-007/BR-REP-017),
mostrada unicamente en el panel de detalle del Scenario, nunca como una
linea nueva del diagrama.

`HP-REP-001` ("Reparacion estandar de cliente externo") es el primer
baseline E2E: una Orden CLIENTE_EXTERNO con un unico Detalle conocido
desde el ingreso, sin desvios operativos ni tecnicos. El Happy Path
representa el comportamiento NORMAL del proceso, no necesariamente el
camino con menos nodos: en particular, en lo comercial se considera
normal que el cliente tenga Saldo pendiente hasta el momento de retirar
el equipo, pague en ese momento (`PROC-REP-266` -> Registrar pago final
-> revalida `PROC-REP-265` -> Saldo = 0), y solo entonces se genere el
comprobante final y se entregue el equipo.

Por ahora solo existe `type: HAPPY_PATH` y `scope: E2E`. El modelo
(`business/schemas/scenario.schema.json`,
`scripts/lib/scenario-model.ts`) ya admite `VARIANT`/`EXCEPTION`/
`EDGE_CASE` y `scope: FEATURE`/`RULE` en el enum, para que una futura
iteracion no requiera un cambio de schema, pero su comportamiento -en
particular, una Variant como conjunto de overrides de `facts` sobre este
baseline- no esta implementado ni validado todavia. Tampoco existen
todavia Coverage Analyzer, generador automatico de Scenarios, ni User
Stories: esta iteracion es unicamente el primer Happy Path formal,
validado estructural y referencialmente (`npm run validate:scenarios:v1.3`)
y visualizado como capa de highlighting en el viewer HTML
(selector "Happy Path", independiente y mutuamente excluyente del
selector de Features).

Las Features que un Scenario "involucra" se calculan como
`active_features` (ver la seccion anterior, ALWAYS/CONTEXTUAL), nunca
como la interseccion bruta `touched_features`: para HP-REP-001 eso
significa que FEAT-REP-001 a FEAT-REP-008 quedan activas, pero
FEAT-REP-009 (Cancelacion) NO -aunque el Happy Path atraviesa
PROC-REP-211, lo hace via PROC-REP-210 (que activa a FEAT-REP-005 por
CONTEXTUAL), nunca via PROC-REP-300/305-. El panel del viewer muestra esta
lista bajo "Features involucradas", calculada por
`scripts/lib/feature-scenario-mapping.ts` (el mismo helper que usan
`validate-references.ts` y `validate-scenarios.ts`, para que la semantica
nunca diverja entre la CLI y el HTML).

### Caminos sobre el Process Graph: Happy Path, Variant, Exception, Edge Case

Vocabulario (todos son capas sobre el Process Graph, nunca copias de el):

- **Process Graph**: los nodes/edges de `repair-management-v1.3.yaml`. Es
  la unica fuente de verdad de la topologia, de las descripciones, actores,
  Business Rules y outputs de cada nodo.
- **Happy Path**: recorrido E2E CANONICO del proceso.
- **Variant**: desviacion o condicion alternativa sobre uno o mas puntos de
  un recorrido (por ejemplo una garantia).
- **Exception**: algo que falla o interrumpe el flujo esperado.
- **Edge Case**: combinacion o condicion limite poco frecuente.

> Un Happy Path representa un recorrido E2E canonico del proceso. Una
> Variant representa una desviacion o condicion alternativa sobre uno o
> mas puntos de ese recorrido. No se crean nuevos Happy Paths para cada
> combinacion de Variants.

Modelo: **Happy Path base + Variants atomicas + Exceptions + Edge Cases**.
Una ejecucion futura podra combinar varias Variants; nunca se enumeran las
combinaciones (Cliente + Garantia + Pago anticipado + Falta de stock ...),
que crecerian de forma explosiva.

```text
Process Graph  +  Happy Path (steps sobre edges reales)  =  Recorrido E2E
```

Hoy existen tres Happy Paths (`business/scenarios/repair-management-scenarios-v1.3.yaml`):

| Happy Path | Origen | Recorrido distintivo |
|---|---|---|
| **HP-REP-001** Cliente externo | CLIENTE_EXTERNO | registra cliente/equipo, comprobante de recepcion, cobro (Saldo), notificacion, comprobante final y entrega al cliente |
| **HP-REP-002** Equipo RT | RT_INTERNO | recibe contexto del equipo RT (PROC-REP-020), sin comprobante de recepcion; tras REPARACION_LISTA informa el resultado a Gestion RT (PROC-REP-290) y RECIEN DESPUES registra la entrega/devolucion del equipo a Gestion RT (PROC-REP-270), luego fin |
| **HP-REP-003** Garantia RMA | RMA_GARANTIA_REPARACION | parte de una Orden origen finalizada (EVT-REP-002), identifica la Orden y el Detalle origen (PROC-REP-035), recupera cliente/equipo, crea una NUEVA Orden vinculada; NO_COBRABLE: recorre 265 (validacion de condicion de entrega) que aprueba por origen, sin pago ni 266, con notificacion, comprobante final y entrega al cliente |

HP-REP-002 es un Happy Path propio (y no una Variant) porque el origen
cambia estructuralmente el recorrido E2E. NO tiene pago/anticipo de
cliente, validacion de saldo, cortesia comercial, notificacion de retiro
ni entrega comercial a cliente: esos nodos (030, 060, 260, 265, 266, 280)
se declaran en `skipped_nodes` con su motivo. La entrega/devolucion del
equipo a Gestion RT SI ocurre (`PROC-REP-270`, ver abajo). Se conserva la trazabilidad con
el equipo/origen RT y el resultado se informa a Gestion RT. El estado
terminal definitivo de RT_INTERNO sigue pendiente (ver Pendientes).
Orden final de HP-REP-002: `REPARACION_LISTA` (PROC-REP-240) -> `PROC-REP-250`
(no requiere entrega a cliente) -> `PROC-REP-290` informar resultado a
Gestion RT -> `PROC-REP-270` entrega/devolucion del equipo a Gestion RT ->
fin (`EVT-REP-999`). Nunca se entrega primero y se informa despues. Para
esto se reutilizo `PROC-REP-270` (no se creo un nodo) y el unico cambio de
topologia fue reemplazar el edge `PROC-REP-290 -> EVT-REP-999` por
`PROC-REP-290 -> PROC-REP-270` (`270 -> EVT-REP-999` ya existia); el camino
de cliente (`265 -> 280 -> 270`) no cambia. Para RT_INTERNO, `270` es una
devolucion a Gestion RT, no una entrega comercial: no usa Saldo ni Pagos y
NO define el estado terminal de la Orden (sigue `PENDIENTE_DE_DEFINIR`; no
se asume ENTREGADA ni un estado nuevo). No existe un nodo "Cerrar Orden"
aparte: el cierre es el fin `EVT-REP-999`.

**Feature activa no significa "todos sus comportamientos aplican".** Una
Feature esta activa en un Happy Path si PARTE de su comportamiento
funcional participa en ese recorrido; no implica que todos sus nodos,
reglas o comportamientos se ejecuten. FEAT-REP-007 esta activa tanto en
HP-REP-001 como en HP-REP-002, y es correcto, pero con comportamientos
distintos: en HP-REP-001 recorre pago, saldo y cierre comercial
(PROC-REP-265/266/280); en HP-REP-002 no hay pago, ni validacion de saldo,
ni cortesia comercial, ni notificacion de retiro. Su participacion hoy
derivada en HP-REP-002 es el registro del precio snapshot de cada Detalle
(PROC-REP-070, binding ALWAYS). Precio registrado no es pago requerido:
todo Detalle, de cualquier origen, puede tener precio snapshot, y luego la
condicion comercial (RT_INTERNO = NO_COBRABLE_AL_CLIENTE) determina si se
cobra; NO_COBRABLE tampoco significa "sin precio de referencia". La
derivacion (`deriveScenarioFeatures`) ahora devuelve `activationReasons`:
por que esta activa cada Feature (nodo propio, nodo compartido ALWAYS/
CONTEXTUAL o accion funcional), para no atribuir la activacion a una unica
causa; el viewer la muestra como "Activa por". Nota de modelo: la
entrega/devolucion (PROC-REP-270) y el informe a Gestion RT (PROC-REP-290)
pertenecen hoy a FEAT-REP-008, no a FEAT-REP-007; no se movieron Features
en esta iteracion.

**included / skipped / conditional.** *included* = nodo atravesado por
`steps[]` (se deriva, no se repite); *skipped* = nodo listado en
`skipped_nodes[]` con `reason` (documental; el validador exige que exista y
que el mismo Scenario no lo atraviese); *conditional* es un concepto de las
Variants (su `trigger`/condicion de activacion), no de un Happy Path, que
es determinista. Se eligio `steps[]` sobre edges (from + condition + to) en
vez de un mapa nodo->estado porque tambien dice QUE transicion se tomo en
nodos con varias entradas (por ejemplo PROC-REP-211) y se valida con
continuidad.

**Arquitectura preparada para Variants** (ninguna real declarada todavia).
Un Scenario de tipo VARIANT/EXCEPTION/EDGE_CASE puede indicar, todos
opcionales: `feature` (Feature donde se origina), `applies_to` (Happy Paths
a los que aplica), `trigger` (node/edge y condicion de activacion),
`affected_nodes`, `rules` (Business Rules) y `dependencies`
(`requires`/`enables`/`implies`/`excludes` hacia otros Scenarios). Solo se
valida la forma y la integridad referencial; como se combinan esas
relaciones al ejecutar NO esta implementado. Una Variant se define UNA vez
y puede impactar nodos de varias Features (`affected_nodes`), sin
duplicarse por Feature. Steps/facts/expected solo son obligatorios para un
HAPPY_PATH.

**HP-REP-003 - Garantia de reparacion RMA.** Es un Happy Path propio (no una
Variant local) porque cambia estructuralmente el recorrido E2E, igual que
HP-REP-002:

```text
HP-REP-001: necesidad nueva -> registrar cliente/equipo -> crear OR -> ... -> cobro -> saldo -> entrega
HP-REP-003: OR origen finalizada -> iniciar garantia (1..N Detalles origen)
            -> recuperar cliente/equipo/origen -> crear NUEVA OR vinculada
            -> EN_REVISION -> revision tecnica obligatoria -> definir Detalles
            -> ... -> (sin cobro, sin saldo) -> entrega
```

- **Evento inicial propio**: `EVT-REP-002` "Una Orden de Reparacion finalizada
  requiere garantia" (nuevo, unico nodo agregado). Forzar `EVT-REP-001`
  ("surge una necesidad de reparacion") habria borrado la diferencia
  funcional. Converge en `PROC-REP-035`; la entrada por `PROC-REP-010` se
  conserva como alternativa.
- **`PROC-REP-035` reutilizado y ampliado**: toma como entrada la Orden
  origen finalizada, la identifica junto con el/los Detalle(s) origen que
  fallaron, y recupera cliente y equipo de ella (no hay alta nueva, por eso
  no pasa por `PROC-REP-030`). `PROC-REP-040` crea una NUEVA Orden con origen
  RMA_GARANTIA_REPARACION, condicion NO_COBRABLE y referencia a la Orden
  origen y a los 1..N Detalles origen seleccionados (una unica Orden por
  inicio, no una por Detalle). **Revision obligatoria (MVP v2)**: la Orden
  nueva nace sin Detalles y EN_REVISION (`PROC-REP-045` = No -> 055 -> 050
  -> 060), el tecnico la revisa (065) y define y registra los Detalles de
  garantia (068 Si -> 075, ACT-TECH desde la iteracion 8), cada uno vinculado a uno de los Detalles
  origen sin relacion 1:1; si la revision no permite definir reparacion,
  concluye SIN_REPARACION (068 No -> 069). Ya no existe el camino que
  copiaba directamente el Tipo del Detalle origen (045 Si -> 070). La
  Orden origen NO se reabre y conserva su estado: no se crearon estados
  como REABIERTA_POR_GARANTIA.
- **Trazabilidad en ambos niveles** (`BR-REP-019`): Orden nueva -> Orden
  origen y Detalle nuevo -> Detalle origen. Esto RESUELVE el pendiente
  "Orden origen vs. Detalle origen". Sigue pendiente el modelo tecnico
  (sin base de datos aqui) y las reglas de garantia RMA configurable/vencida.
- **Sin estado CERRADA**: el modelo no lo tiene (V1.2 lo excluye). La
  precondicion se define como "Orden origen finalizada (ENTREGADA)"; si
  negocio quiere otra definicion es una decision aparte.
- **Convergencia y gate general de condicion de entrega**: desde
  `PROC-REP-040` hasta `PROC-REP-260` es el mismo circuito tecnico de
  HP-REP-001, y luego HP-REP-003 recorre `PROC-REP-265` igual que
  HP-REP-001: es el mismo gate general de condicion de entrega para todo
  origen con entrega a cliente, y NO se creo ningun bypass alrededor de el
  (`260 -> 265` sin condicion, `265 -> 280 [Si]`; no hay edge
  `260 -> 280`). Lo que cambia es COMO se aprueba:

  ```text
  CLIENTE_EXTERNO          -> aprueba por Saldo = 0 o cortesia total
  RT_GARANTIA_VENTA        -> aprueba por condicion NO_COBRABLE
  RMA_GARANTIA_REPARACION  -> aprueba por condicion NO_COBRABLE
  ```

  HP-REP-003 recorre `PROC-REP-265` como validacion de condicion de
  entrega, pero nunca entra en `PROC-REP-266` ni registra pagos porque la
  condicion NO_COBRABLE aprueba directamente la entrega: no hay cobro
  pendiente, ni anticipo, ni Saldo = 0 mediante pagos, ni cortesia usada
  para evitar el cobro. Los edges de HP-REP-001 no cambian. Business
  Rules: `BR-REP-016` y `BR-REP-017` extendidas y `BR-REP-019` nueva.
- **Omitidos** (`skipped_nodes`): 010 (origen ya conocido), 030 (cliente/
  equipo se recuperan), 266 (no hay cobro pendiente ni registro de pago) y
  290 (informe a Gestion RT, propio de RT_INTERNO). `PROC-REP-265` NO esta
  omitido. El pago no tiene nodo propio (es una capacidad transversal):
  simplemente no hay ninguna accion funcional de pago.
- **Features activas**: FEAT-REP-001 a 008 (no 009). FEAT-REP-007 esta
  activa por su nodo propio `PROC-REP-265` (validacion de condicion de
  entrega) y por los nodos compartidos ALWAYS 070 (precio snapshot) y 280
  (comprobante final), pero no por `PROC-REP-266`: activa no significa
  que se ejecute el cobro. Precio registrado no implica pago requerido.

**Variants futuras ya identificadas sobre HP-REP-001** (documentadas, no
implementadas):

- *Garantia de Venta RT* (RT_GARANTIA_VENTA): hay cliente y el equipo vuelve
  a el; debe existir referencia/trazabilidad con la venta RT; la reparacion
  es NO_COBRABLE, sin pago del cliente ni bloqueo de entrega por saldo; sigue
  existiendo notificacion y entrega al cliente.
- *(La garantia de reparacion RMA ya no es una Variant futura: es el Happy
  Path HP-REP-003, ver arriba.)*

**Viewer.** El selector "Happy Path" ofrece "Proceso completo",
HP-REP-001, HP-REP-002 y HP-REP-003: resalta los nodes y los edges exactos del camino
(no elimina los demas del DOM, los atenua) y muestra los `skipped_nodes`
con su motivo. Ademas, el diagrama ahora se muestra a su tamano real y
legible (100% = tamano natural de Mermaid): antes el SVG se colapsaba a ~16%
de su tamano (`width="100%"` dentro de un contenedor `max-content`) antes de
aplicar cualquier zoom. Zoom de 15% a 800% con paso multiplicativo,
Ctrl/Cmd+rueda (o pellizco) con zoom sobre el cursor, y arrastre del fondo
para desplazarse; el diagrama completo es siempre alcanzable por scroll.

### Scenario Candidate Discovery

Herramienta de descubrimiento **estructural y deterministico** de caminos
alternativos. Compara el Process Graph con cada Happy Path y detecta donde
el grafo ofrece una transicion distinta de la que el Happy Path eligio:

```text
Process Graph + Happy Paths
        |
discover-scenario-candidates.ts
        |
Candidate Scenario Inventory   (generated/scenarios/repair-management-candidates-v1.3.yaml)
        |
LLM / analisis funcional
        |
Human confirmation
        |
VARIANT / EXCEPTION / EDGE_CASE
```

> **Un Candidate Scenario no es un Scenario aprobado.** Es solo una
> diferencia topologica entre el grafo y un Happy Path. No se clasifica
> (no dice si es Variant, Exception o Edge Case), no se nombra, no se
> prioriza y no se agrega a `repair-management-scenarios-v1.3.yaml`. El
> archivo generado esta marcado como GENERATED / NOT SOURCE OF TRUTH / NOT
> CONFIRMED BUSINESS SCENARIOS y nunca se edita a mano.

Uso: `npm run discover:scenarios:v1.3` (genera el inventario y muestra un
resumen; es generacion, por eso NO forma parte de `validate:v1.3`) y
`npm run test:scenario-discovery` (tests del algoritmo; estos si estan en
`validate:v1.3`). Codigo: `scripts/lib/scenario-discovery.ts` (funciones
puras) y `scripts/discover-scenario-candidates.ts` (CLI).

**Algoritmo.**

1. Por cada `PROCESS_EDGE` de un Happy Path (en orden), se toman todos los
   outgoing edges reales de su nodo `from`; los que no son el edge elegido
   en ese paso son alternativos. Un edge se identifica por
   `from + condition + to` (`edgeKey`, compartido), nunca por from/to.
2. Cada alternativa inicia una BFS acotada que corta cada rama en el primer
   desenlace estructural: `END` (llega a un nodo `end`; tiene precedencia
   porque el fin esta en todo Happy Path), `REJOIN_FORWARD` (vuelve a un
   nodo del Happy Path ubicado DESPUES del punto de divergencia),
   `LOOP_TO_BASELINE` (vuelve a un nodo del Happy Path ANTES o EN el punto
   de divergencia: reintentos/revalidaciones), `CYCLE` (revisita un nodo de
   su propio recorrido sin haber tocado el Happy Path), `MAX_DEPTH` (limite
   de seguridad, `DEFAULT_MAX_DEPTH = 30` centralizado) y `DEAD_END`
   (nodo sin salidas que no es `end`; red de seguridad, no ocurre en el
   grafo validado).
3. No hay explosion combinatoria: cada nodo se expande una sola vez por
   desviacion (`visited`), las ramas que reconvergen en un nodo ya explorado
   se podan y se cuentan, y los loops nunca se despliegan. Una desviacion
   que se ramifica produce un candidato por desenlace distinto.
4. Los candidatos se deduplican entre Happy Paths por una firma
   deterministica: edge baseline + edge alternativo + recorrido explorado +
   tipo y nodo de terminacion, SIN el id del Happy Path. Un candidato
   deduplicado acumula `applies_to` y `occurrences` (Happy Path y paso donde
   ocurre). Los ids `CAND-REP-NNN` se asignan tras ordenar por nodo de
   divergencia, edge alternativo, baseline y terminacion, asi que dos
   ejecuciones sin cambios producen exactamente el mismo archivo.

**Limitaciones conocidas (V1).**

- Solo encuentra alternativas que **salen de un nodo del Happy Path**. Las
  capacidades no secuenciales quedan para una futura Pass 2: cancelacion
  transversal, pago anticipado y acciones disponibles desde muchos estados.
- Cycle detection es BFS + `visited` (revisita en el recorrido propio); no
  usa Tarjan/SCC, que puede incorporarse despues si hace falta analisis de
  ciclos mas fino.
- Un candidato es un recorrido hasta el primer desenlace, no un escenario
  completo: no se explora que pasa despues de reincorporarse, ni se combinan
  desviaciones entre si.
- La poda por `visited` implica que, cuando dos ramas de una misma
  desviacion convergen, solo se reporta el recorrido mas corto.
- Los `FUNCTIONAL_ACTION` de los Happy Paths se ignoran (no son edges) y
  no se interpreta ningun nombre, descripcion ni condicion del negocio.

## MVP v2 - Scope funcional cerrado

Cierra el alcance funcional del MVP v2, antes de integrar con el
repositorio productivo `rt-rma-mvp`. Base: los tres Happy Paths
(`HP-REP-001/002/003`) mas 3 `VARIANT` y 5 `EXCEPTION` REALES y
CONFIRMADOS en `business/scenarios/repair-management-scenarios-v1.3.yaml`
(ya no solo entries de analisis). Son los primeros Scenarios que usan de
verdad los campos `feature`/`trigger`/`applies_to`/`affected_nodes`/
`rules` que el schema admitia desde HP-REP-003 pero nadie habia poblado
todavia.

**Trazabilidad Candidate -> Scenario** (no se amplio el schema con un
campo `source_candidate`: la relacion queda documentada aqui y en la
`description` de cada Scenario, que cita sus Candidate IDs de origen):

| Scenario | Tipo | Candidate(s) origen | applies_to |
|---|---|---|---|
| `VAR-REP-001` Ingreso sin diagnostico, con comprobante | VARIANT | CAND-REP-007, CAND-REP-016 | HP-REP-001 (en HP-REP-003 la revision es obligatoria y forma parte del Happy Path) |
| `VAR-REP-002` Ingreso sin diagnostico, sin comprobante (RT) | VARIANT | CAND-REP-007, CAND-REP-009 | HP-REP-002 |
| `VAR-REP-003` Ejecucion interrumpida | VARIANT | CAND-REP-027 | HP-REP-001/002/003 |
| `EXC-REP-001` Recursos insuficientes, en espera | EXCEPTION | CAND-REP-018 | HP-REP-001/002/003 |
| `EXC-REP-002` Recursos insuficientes, con override | EXCEPTION | CAND-REP-019 | HP-REP-001/002/003 |
| `EXC-REP-003` Reserva de insumos fallida al iniciar | EXCEPTION | CAND-REP-026 | HP-REP-001/002/003 |
| `EXC-REP-004` Requiere revision tecnica posterior | EXCEPTION | CAND-REP-032 | HP-REP-001/002/003 |
| `EXC-REP-005` Rechazo de control tecnico / retrabajo | EXCEPTION | CAND-REP-034 | HP-REP-001/002/003 |

**Por que VAR-REP-001/002 son dos Scenarios y no uno.** El business case
("al ingreso no se conoce el Detalle") es el mismo (CAND-REP-007), pero
`steps[]` exige una secuencia LITERAL de edges reales: los origenes con
comprobante (CLIENTE_EXTERNO/RMA_GARANTIA_REPARACION) pasan por
PROC-REP-060 y los sin comprobante (RT_INTERNO) van directo de
PROC-REP-050 a PROC-REP-065; no pueden expresarse en un unico `steps[]`.
No se fusiono el desenlace SIN_REPARACION (CAND-REP-010/017): sigue fuera
de MVP v2 (ver mas abajo).

**Por que Recursos insuficientes son 2 Scenarios (EXC-REP-001/002) y no
uno.** Mismo motivo estructural: `PROC-REP-110` bifurca en dos edges
reales distintos (`No` -> espera/PENDIENTE_RECURSOS, `Si` -> override
BR-REP-003), cada uno con su propio `steps[]` y `expected`. El schema no
admite dos recorridos alternativos dentro de un mismo Scenario, y forzar
uno solo habria ocultado que la resolucion por override es una decision
de autorizacion (BR-REP-003), no un detalle menor de redaccion. No se
crea ninguna Business Rule nueva de autorizacion: EXC-REP-002 cita
BR-REP-002 y BR-REP-003, ya existentes.

**Mecanica multi-Detalle (CAND-REP-028/029/030): NO son Scenarios.**
Siguen `MECHANISM_ONLY` (ver
`generated/scenarios/repair-management-candidate-analysis-v1.3.yaml`):
que una Orden tenga 1..N Detalles y que, al terminar uno, el tecnico
pueda continuar con la misma toma o liberar la Orden, es comportamiento
normal del proceso (BR-REP-018), no una desviacion que necesite su
propio Scenario. `scripts/test-scenarios.ts` verifica explicitamente que
ningun Scenario real declare esos edges como propios.

**Explicitamente diferido de MVP v2 (`OUT_OF_SCOPE`):**

- **`RT_GARANTIA_VENTA`**: no se formaliza ningun Scenario. Informacion
  funcional nueva indica que necesita un modelo de dominio distinto - una
  entidad generica `OrdenRevision` con `tipo_revision = GARANTIA`, cuya
  revision resuelve en `REPARACION` / `CAMBIO_DIRECTO` /
  `NO_APLICA_GARANTIA`, y solo algunas resoluciones derivan en una
  `OrdenReparacion` - todavia no suficientemente diseñado. El Process
  Graph V1.3 NO se modifica para anticipar ese modelo en esta iteracion;
  `RT_GARANTIA_VENTA` permanece como se documenta en `FG-REP-002` del
  candidate analysis (candidate a Variant de HP-REP-001, sujeto a
  revision humana), sin decidir todavia si sera una Variant o un Happy
  Path propio.
- **`SIN_REPARACION` tras un ingreso `EN_REVISION`** (CAND-REP-010/017):
  pendiente la decision de negocio sobre aviso/documentacion/cierre
  adicional (ver Pendientes especificos de V1.3).
- **Cancelacion** (CAND-REP-020/021/033, grupo `FG-REP-005`): BR-REP-014
  todavia no define quien esta autorizado a cancelar un Detalle o una
  Orden; sin esa definicion no se redacta el Scenario real.

**SOURCE_MODEL_CONFLICT durante esta formalizacion: ninguno.** Los 8
Scenarios de MVP v2 se representan integramente con el Process Graph
V1.3 existente, sin modificar nodos ni edges.

## V1.4 consolidada - baseline candidata (23/10/2026)

La V1.4 se consolido con las decisiones confirmadas por el responsable de
producto: los siete bloques, DC07, los permisos predeterminados, DC14 y las
incorporaciones de UAT (DC16). Es una baseline CANDIDATA: su aprobacion final
(DC01) queda pendiente. Donde las secciones de V1.4 que siguen contradigan la
consolidacion, rige la consolidacion.

- Registro de decisiones, incorporaciones de UAT y pendientes:
  `business/decisions/decision-log-v1.4.yaml` (`npm run validate:decisions:v1.4`).
- Resumen, glosario, casos funcionales y estado: `docs/consolidation/README.md`.
- Matriz decision -> regla -> Feature -> nodo -> Scenario -> implementacion:
  `docs/consolidation/matriz-trazabilidad-v1.4.md` (generada).
- Diseno logico de cada funcionalidad nueva o ampliada:
  `docs/consolidation/diseno-logico-v1.4.md`.
- Sincronizacion con `rt-rma-mvp` (DC02): `docs/consolidation/sincronizacion-dc02.md`.

## V1.4 (draft) - Ingreso de CLIENTE_EXTERNO, decision del cliente por Detalle y desistimiento

V1.4 evoluciona V1.3 con decisiones confirmadas con Recepcion. Es
documentacion funcional: no hay backend, frontend, scraping ni base de
datos. Sigue en draft (no existe V1.5). Archivos (V1.2 y V1.3 intactos):
`business/processes/repair-management-v1.4.yaml`,
`business/rules/business-rules-v1.4.yaml`,
`business/features/repair-management-features-v1.4.yaml` y
`business/scenarios/repair-management-scenarios-v1.4.yaml`. Comandos:
`validate:process:v1.4`, `validate:features:v1.4`,
`validate:references:v1.4`, `validate:scenarios:v1.4`,
`test:feature-scenario-mapping:v1.4`, `test:scenarios:v1.4`,
`validate:v1.4`, `generate:mermaid:v1.4`, `generate:viewer:v1.4`,
`generate:v1.4` y `discover:scenarios:v1.4` (generacion, no validacion).
Son los mismos scripts que V1.3, parametrizados por ruta; los dos tests
reciben la revision como argumento (default v1.3).

**Principio.** La unidad de definicion, autorizacion, ejecucion y
cancelacion de trabajos es ReparacionDetail. Se distinguen tres cosas que
no se mezclan: (1) el estado operativo del Detalle, (2) la decision del
cliente sobre su definicion vigente y (3) el estado agregado de la Orden,
que sigue derivandose con el resolver (BR-REP-012). Excepcion preservada: la
Orden con cero Detalles (BR-REP-013) no usa el resolver y se cancela con la
transicion explicita de PROC-REP-306.

### Frontera FEAT-REP-001 / FEAT-REP-002 / FEAT-REP-009

```text
FEAT-REP-001  010 -> 030 -> 040 -> 032 -------------------------------> 045
              (captura de informacion y creacion de la Orden; termina en 032)

FEAT-REP-002  045 -> 070 | 055 -> 046 -> 047 -> 050 -> 060 -> ...  (definicion,
              decision del cliente por Detalle, comprobante de recepcion)

FEAT-REP-009  047 -> 300 | 305 | 306   (ejecuta las cancelaciones)
```

- **FEAT-REP-001** captura informacion y crea la Orden. Ya NO define
  Detalles, autoriza trabajos, decide desistimientos, genera el comprobante
  ni ejecuta cancelaciones (las aristas y nodos se movieron: 033 desaparece,
  050/060 pasan a FEAT-REP-002).
  - `PROC-REP-030`: Cliente (DNI/telefono, consulta opcional a cuitonline.com
    por DNI -scraping, no Renaper-, datos editables, carga manual) y Equipo
    (IMEI, historial, medio alternativo si no hay IMEI); BR-REP-020 a 022.
  - `PROC-REP-040` (compartido): crea la Orden (REQUERIMIENTO, cero
    Detalles, BR-REP-013) y bifurca por origen igual que 010.
  - `PROC-REP-032`: sobre la Orden ya creada registra diagnostico inicial y
    observaciones (texto libre), checklist y fotografias opcionales (camara
    del celular o galeria en web movil), guardable y recuperable sin cambiar
    el estado de la Orden (BR-REP-023/024). Al intentar avanzar evalua la
    advertencia NO bloqueante por fotografias/observaciones faltantes, con
    "volver a completar" (se queda en 032) o "continuar igualmente"
    (confirmacion registrada); sin advertencia por checklist ni diagnostico
    inicial (BR-REP-025).
  - Diagnostico inicial (problemas: "no carga") NO es reparacion diagnosticada
    (trabajo: "cambio de bateria", ReparacionDetail de FEAT-REP-002).
    La estandarizacion futura del diagnostico complementa al texto libre; no
    hay entidad DiagnosticoInicial.
- **FEAT-REP-002** define los Detalles (045/070/075 sin rediseño; el origen del
  diagnostico queda RECEPCION en 070 y REVISION_TECNICA en 075, BR-REP-026;
  desde la iteracion 8 Recepcion define en 070 y el tecnico en 075),
  registra la decision del cliente (046/047) y emite el comprobante (050/060).
- **FEAT-REP-009** ejecuta las cancelaciones reutilizando 300, 305 y 306.

### Modelo funcional de la decision del cliente por Detalle

Un solo par de nodos reutilizado desde cuatro puntos, solo para
CLIENTE_EXTERNO (los demas origenes conservan su arista anterior mediante la
condicion "Origen distinto de CLIENTE_EXTERNO"):

| Punto de entrada | Contexto | Si acepta |
|---|---|---|
| `070 -> 046` | Detalles conocidos al ingreso | `047 -> 211 -> 050` (comprobante) |
| ~~`055 -> 046`~~ | (iteracion 10) sin Detalles ya NO se consulta por Detalle: `055 -> 056` | `056 -> 050` (continua con la revision) o `056 -> 306` (desiste) |
| `075 -> 046` | Detalles hallados en la revision | `047 -> 211 -> 080` |
| `127 -> 046` | Detalle redefinido | `047 -> 211 -> 080` |

- `PROC-REP-046` (ACT-RECEP) registra, por Detalle Y definicion vigente, si el
  cliente autoriza o rechaza; fecha/hora, usuario, alcance, resultado y
  evidencia de consentimiento (el canal -firma, WhatsApp, presencial- NO se
  define). `PROC-REP-047` (decision) enruta el resultado comercial en tres
  decisiones (ver "Decision del cliente simplificada", iteracion 10).
- La autorizacion es una dimension PROPIA (pendiente de decision / autorizado /
  rechazado), no un estado del ciclo operativo del Detalle ni de la Orden; un
  rechazo se ejecuta cancelando el Detalle. En CLIENTE_EXTERNO, para
  es_trabajable (BR-REP-012) un Detalle requiere ademas autorizacion vigente
  (BR-REP-028), sin tocar la prioridad del resolver.
- El cliente no esta obligado a aceptar todos los Detalles. Aceptar la
  revision tecnica sin trabajos NO autoriza reparaciones posteriores.
- Revalidacion (BR-REP-029): un Detalle nuevo o redefinido requiere decision
  nueva; uno que no cambia conserva la suya. Toda 127 genera una nueva
  definicion y requiere decision nueva (coherente con BR-REP-003/015).

### Desistimiento

- **Individual** (`047 -> 300` "Rechaza algunos Detalles"): cancela solo ese
  Detalle, conserva los demas y recalcula con el resolver.
- **Todo** (`047 -> 305` "Rechaza todos los trabajos"): es una
  opcion de UI/UX, no un estado ni una entidad; aplica a cada Detalle las
  reglas de la cancelacion individual, no cancela los COMPLETO, respeta
  ejecuciones activas y conciliacion de insumos, y el resolver decide el
  estado de la Orden.
- **Sin Detalles** (`056 -> 306`, iteracion 10): transicion explicita a CANCELADA, sin
  resolver ni Detalles ficticios; la devolucion fisica depende de la
  custodia (BR-REP-033): `306 -> 270 [Equipo bajo custodia]` solo si el comprobante
  ya se entrego, y `306 -> fin [Equipo no recibido]` si no (caso de
  VAR-REP-004). Sin pasar a ENTREGADA. No es SIN_REPARACION (069).
- **Orden aun sin habilitar:** 211 llevaria a la cola (170) y la Orden nunca
  paso por 140, por eso 211 tiene salidas precisas por hito, hacia 050
  ("Antes del comprobante de recepcion") u 080 ("Comprobante emitido,
  factibilidad pendiente"); ver "Resolver y enrutamiento" mas abajo.
  BR-REP-014, 069, 300 y 305 conservan sus precondiciones; 300/305 solo ganan
  un origen mas.
- Requerimientos funcionales de UI (en PROC-REP-046, sin desarrollar): mostrar
  Detalles con tipo y estado, cuales estan autorizados / pendientes /
  rechazados; seleccion individual y "Desistir de todos los trabajos
  pendientes"; motivo y confirmacion; informar que se mantiene y que se
  cancela; impedir seleccionar lo no cancelable; conservar el historial.

### Comprobante de recepcion

Pertenece a FEAT-REP-002 (050/060, BR-REP-031). En CLIENTE_EXTERNO se emite
una sola vez DESPUES de la decision inicial: refleja los trabajos autorizados
y su definicion vigente, o "pendiente de diagnostico" si no hay Detalles; no
se emite si el cliente desiste antes de aceptar el ingreso ni se regenera por
cambios posteriores (075/127). RT_INTERNO, RT_GARANTIA_VENTA y
RMA_GARANTIA_REPARACION conservan su comportamiento y no reciben la decision
de cliente externo.

### Escenarios

Distincion: tienen recorrido propio (Scenarios) vs. se resuelven dentro de un
mismo nodo (casos de prueba).

| # | Caso pedido | Cobertura |
|---|---|---|
| 1 | Cliente acepta todos los Detalles iniciales | HP-REP-001 |
| 2 | Rechaza uno y acepta los demas | VAR-REP-005 |
| 3 | Desiste de todos antes de ejecutar | VAR-REP-006 |
| 4 | Sin Detalles, acepta revision y acepta lo diagnosticado | VAR-REP-001 |
| 5 | Sin Detalles, acepta revision y luego desiste | VAR-REP-007 |
| 6 | Nuevo Detalle descubierto y aceptado | VAR-REP-001 (tras la revision, 075) y VAR-REP-010 (agregado por el tecnico, 128) |
| 7 | Nuevo Detalle descubierto y rechazado | VAR-REP-007 (075) y VAR-REP-011 (128) |
| 8 | Se modifica un Detalle y se requiere nueva autorizacion | VAR-REP-008 |
| 9 | Se rechaza un Detalle nuevo conservando uno completado | VAR-REP-009 |
| 10 | OR sin Detalles cancelada por desistimiento | VAR-REP-004 |
| 11 | Comprobante despues de la aceptacion inicial | HP-REP-001 / VAR-REP-001 (orden verificado por test) |
| 12 | Otros origenes preservados | HP-REP-002/003 + tests de regresion |

Casos dentro de un mismo nodo (sin Scenario propio): creacion de la OR con
cero Detalles; cliente nuevo/existente (DNI, telefono); equipo nuevo/existente
(IMEI) o sin IMEI; consulta externa exitosa, fallida o sin resultados;
diagnostico y observaciones completos o vacios; fotografias (camara/galeria)
presentes o ausentes; checklist presente, incompleto o ausente; guardado
parcial y recuperacion; advertencia por faltante de fotografias, observaciones
o ambas, volver a completar o continuar igualmente con confirmacion.
HP-REP-002/003, VAR-REP-002 y EXC-REP-004 solo explicitan la condicion de
origen; EXC-REP-004 queda acotado a los origenes sin decision de cliente (su
contraparte de CLIENTE_EXTERNO es VAR-REP-008).

### Autorizacion por Detalle, altas del tecnico, resolver y devolucion (iteracion 4)

**Tres dimensiones independientes** (BR-REP-028): estado operativo del
Detalle, autorizacion del cliente sobre su definicion vigente y
factibilidad/recursos. `PENDIENTE_AUTORIZACION` (con `AUTORIZADO` y
`RECHAZADO`) es una condicion derivada de la autorizacion, NO un estado
operativo. Un Detalle pendiente de autorizacion no se ejecuta, no se evalua
su factibilidad, no reserva ni consume insumos y no es candidato de estacion,
pero NO bloquea a los demas Detalles. No hay una autorizacion general de la
Orden. Un rechazo se ejecuta cancelando el Detalle (FEAT-REP-009).

**Alta de Detalles por el tecnico** (`PROC-REP-128`, ACT-TECH, BR-REP-032,
BR-REP-037). Entrada `190 -> 128 [Detecta reparacion adicional]` (simplificacion
del diagrama: puede ocurrir en cualquier momento de la participacion). El Detalle
nuevo queda con origen REVISION_TECNICA, Tipo y precio snapshot, usuario y
fecha. En CLIENTE_EXTERNO el alta solo CREA la solicitud de autorizacion
(Detalle PENDIENTE_AUTORIZACION) y el flujo tecnico vuelve directamente a `190`
(`128 -> 190`): la resolucion la hace Recepcion despues por su carril
(`EVT-REP-003 -> 046 -> 047`) y el tecnico no la espera; los demas origenes van
directo a factibilidad (`128 -> 080`, evaluacion del sistema). La Ejecucion
activa NO se interrumpe ni se toca la toma. Cuando Recepcion obtiene la
autorizacion: `047 -> 211 -> 080` (factibilidad, enrutada por el resolver) y, como la
Orden ya estaba habilitada, `090 -> 211 [Orden ya habilitada]` (sin volver a 140/150/170) y
`211 -> 190 [Ejecucion activa vigente]` (sin iniciar una segunda ejecucion).
Si se rechaza: `047 -> 300`. Si el cliente no responde: `046 -> 211 [Solicitud sin
resolver, Detalles siguen pendientes de autorizacion]` (iteracion 10). No reutiliza `PROC-REP-075` (definicion posterior a una revision inicial).
`PROC-REP-129` es la espera de autorizacion, analoga a 120 (recursos) y 125
(revision): `211 -> 129 [PENDIENTE_AUTORIZACION] -> 046`.

### Resolver y enrutamiento (BR-REP-012 V1.4 y BR-REP-034)

El resolver sigue siendo centralizado, determinista y parametrizable; la
politica admite la extension sin reescribirse. Se agrega la propiedad
derivada `pendiente_autorizacion`, `es_trabajable` exige ademas que no este
pendiente de autorizacion, y se inserta una prioridad:

| Prioridad | Condicion | Resultado |
|---|---|---|
| 0 | cantidad_detalles = 0 | SIN_DETALLES |
| 1 | todos terminales y todos CANCELADO | TODO_CANCELADO |
| 2 | todos terminales y existe >=1 COMPLETO | COMPLETA |
| 3 | existe una Ejecucion activa | EN_EJECUCION |
| 4 | existe >=1 Detalle trabajable | ABIERTA_TRABAJABLE |
| 5 | ninguno trabajable y existe requiere_revision | REQUIERE_REVISION |
| **6 (nueva)** | ninguno trabajable y existe pendiente de autorizacion | PENDIENTE_AUTORIZACION |
| 7 (antes 6) | ninguno trabajable y existe bloqueado_por_recursos | PENDIENTE_RECURSOS |
| fail-safe | ninguna aplica | CONTEXTO_INCONSISTENTE (no es un estado de negocio) |

Ademas el resolver devuelve el conjunto de **bloqueos** (causas presentes entre
los Detalles no terminales y no en ejecucion), sin crear estados combinados
(formato ilustrativo, no contrato de datos). Ejemplos:

| Caso | situacion | bloqueos |
|---|---|---|
| A. autorizado ejecutable + pendiente | ABIERTA_TRABAJABLE | PENDIENTE_AUTORIZACION |
| B. todos los no terminales pendientes | PENDIENTE_AUTORIZACION | PENDIENTE_AUTORIZACION |
| C. COMPLETO + pendiente | PENDIENTE_AUTORIZACION (no hay control final) | PENDIENTE_AUTORIZACION |
| D. COMPLETO + el resto CANCELADO | COMPLETA | - |
| E. todos CANCELADO | TODO_CANCELADO | - |
| F. autorizado sin stock + pendiente | PENDIENTE_AUTORIZACION | PENDIENTE_AUTORIZACION, PENDIENTE_RECURSOS |
| G. requiere revision + pendiente | REQUIERE_REVISION | REQUIERE_REVISION, PENDIENTE_AUTORIZACION |
| H. uno en ejecucion + otro pendiente | EN_EJECUCION | PENDIENTE_AUTORIZACION |

La precedencia entre las tres causas es una **decision de negocio aprobada**
(REQUIERE_REVISION > PENDIENTE_AUTORIZACION > PENDIENTE_RECURSOS). Aplica solo
cuando ningun Detalle es ejecutable y define **unicamente la situacion
principal y la ruta de espera inicial** (125, 129 o 120); no descarta las demas
causas, que permanecen todas en los bloqueos. Caso I: DET-001 requiere
revision, DET-002 pendiente de autorizacion y DET-003 sin stock -> principal
REQUIERE_REVISION, bloqueos [REQUIERE_REVISION, PENDIENTE_AUTORIZACION,
PENDIENTE_RECURSOS]. Las causas se resuelven de forma independiente (tecnico,
Recepcion con el cliente, abastecimiento), no hay estados combinados y el
resolver se vuelve a evaluar tras cualquier cambio relevante de un Detalle
(VAR-REP-014). Un Detalle ejecutable deja continuar a la Orden aunque otros
sigan bloqueados; uno pendiente de autorizacion nunca es ejecutable. Se
conservan SIN_DETALLES, TODO_CANCELADO, COMPLETA, EN_EJECUCION,
ABIERTA_TRABAJABLE y el fail-safe CONTEXTO_INCONSISTENTE.

**Enrutamiento** (el resolver no decide la estacion; la decide el workflow por
situacion Y hitos: comprobante emitido, factibilidad, habilitacion, toma
activa). Salidas de `PROC-REP-211`:

| Situacion y hito | Destino |
|---|---|
| EN_EJECUCION | 190 (conserva la Ejecucion vigente) |
| ABIERTA_TRABAJABLE, habilitada, toma activa | 212 (continuar o liberar) |
| ABIERTA_TRABAJABLE, habilitada, sin toma | 170 (cola) |
| ABIERTA_TRABAJABLE, sin habilitar, sin comprobante | 050 |
| ABIERTA_TRABAJABLE, sin habilitar, comprobante emitido | 080 |
| PENDIENTE_AUTORIZACION | 129 -> 046 |
| REQUIERE_REVISION / PENDIENTE_RECURSOS | 125 / 120 |
| COMPLETA | 220 (control tecnico) |
| TODO_CANCELADO, equipo bajo custodia | 270 (devolucion) -> fin |
| TODO_CANCELADO, sin equipo bajo custodia (nunca recibido o ya devuelto) | fin |
| TODO_CANCELADO, custodia sin confirmar | 271 (regularizar custodia) -> 270 o fin |

Las dos condiciones genericas "Orden sin habilitar, comprobante pendiente/ya
emitido" se reemplazaron por hitos precisos. `PROC-REP-090` es el gate de
habilitacion inicial.

**Conservacion de hitos, prioridad y toma (iteracion 5, decisiones
aprobadas).**

- *Habilitacion.* "Orden ya habilitada" se determina por el **hito historico**
  (140 cumplido alguna vez), no por el estado agregado actual. El circuito de
  primera habilitacion (080, 090, 140, 150, 170) se ejecuta una sola vez. Al
  agregar, modificar o autorizar un Detalle en una Orden ya habilitada solo se
  evalua la factibilidad del Detalle afectado (080), se conserva el hito, no se
  duplica la cola, no se pide prioridad, no se tocan las participaciones de
  tecnicos y se re-ejecuta el resolver (`090 -> 211 [Orden ya habilitada]`).
  Las salidas de 090 son mutuamente excluyentes y completas por el hito
  historico, sin depender del orden de las aristas: "Orden ya habilitada" ->
  211; "Primera habilitacion, existe Detalle trabajable" -> 140; "Primera
  habilitacion, ninguno trabajable" -> 100 y su circuito de espera. Las dos
  ultimas son las aristas de V1.3 con la condicion precisada (mismo origen,
  destino y recorrido; los tests lo verifican).
- *Prioridad.* La prioridad existente se mantiene; solo cambia por una accion
  explicita y autorizada, con trazabilidad (usuario, fecha/hora, valor anterior
  y nuevo), que reutiliza la capacidad de `PROC-REP-150`. No hay un proceso
  nuevo y ninguna reevaluacion llega a 150 (la unica arista hacia 150 sigue
  siendo `140 -> 150`).
- *Toma activa.* `PROC-REP-128` y los retornos 080/090/211 no liberan, no
  duplican ni sobrescriben la toma, y no interrumpen la Ejecucion de otro
  Detalle; el Detalle nuevo no se inicia hasta estar autorizado y ser factible.
  La toma solo se cierra automaticamente cuando 211 determina que no queda
  ningun Detalle trabajable (BR-REP-018).
- *Concurrencia.* La consulta al cliente por un Detalle nuevo (Recepcion) es
  independiente de la ejecucion de otro (tecnico) y no es una espera del hilo
  tecnico: DET-001 sigue EN_PROGRESO, DET-002 espera, autorizar o rechazar no
  interrumpe a DET-001 y DET-002 pasa por factibilidad antes de iniciarse
  (VAR-REP-010 y VAR-REP-011). El grafo es de un solo token: dibuja la resolucion
  de Recepcion como una entrada propia (`EVT-REP-003 -> 046`) que vuelve al
  resolver (`211 -> 190`); ninguna arista del hilo tecnico exige pasar por
  `046/047` (ver "Independencia operativa entre Detalles", iteracion 9).

### Custodia fisica y devolucion (BR-REP-033)

El comprobante de recepcion es el documento que se intercambia por el equipo
fisico, pero **generarlo (`060`) no confirma el intercambio**: la custodia
comienza cuando se confirma que el comprobante se entrego y el equipo se
recibio. La confirmacion registra fecha/hora, usuario responsable y referencia
del comprobante (sin estados operativos de Detalle). La OR puede existir sin
equipo recibido y un comprobante generado pero no entregado no activa la
custodia. Tres situaciones que ningun nodo debe confundir: sin custodia,
recepcion pendiente de confirmar y equipo recibido. Una Orden puede quedar
CANCELADA, pero no finaliza operativamente mientras no este determinada la
custodia. Cuatro situaciones: nunca recibido (sin devolucion), bajo custodia
(devolucion por `270`), ya devuelto (no se duplica) y recepcion fisica sin
confirmar (impide el fin y no se manda a devolucion automaticamente). Salidas de
`211` y `306`, mutuamente excluyentes: "equipo bajo custodia" -> 270; "sin
equipo bajo custodia" -> fin; "custodia sin confirmar" -> **`PROC-REP-271`**
(nodo nuevo, ACT-RECEP), donde Recepcion resuelve la situacion dejando usuario,
fecha/hora y evidencia o referencia, y desde donde se continua a 270 (equipo
bajo custodia) o a fin (nunca recibido o ya devuelto). VAR-REP-015 lo recorre.
No hay devolucion automatica ni se pasa a ENTREGADA.

*Cambio minimo elegido:* se extiende `060` (descripcion, salidas y regla) en
lugar de agregar un nodo posterior, porque un nodo de espera impondria al grafo
secuencial un orden que el negocio no exige (el flujo sigue sin esperar el
intercambio). No hay nodos ni aristas nuevos, y por eso tampoco un escenario
nuevo: se cubre con tests de regla.

Sin recepcion confirmada no hay devolucion (VAR-REP-004 y VAR-REP-006: el
cliente desiste antes). Con custodia confirmada y equipo sin devolver, una
Orden CANCELADA no finaliza sin la devolucion registrada (`PROC-REP-270`:
fecha/hora, usuario que entrega y persona que recibe; no convierte CANCELADA
en ENTREGADA ni pasa por control, cobro o entrega comercial):
`211 -> 270 [Todos cancelados, equipo bajo custodia]` (VAR-REP-007) y
`306 -> 270 [Equipo bajo custodia]`. Con algun Detalle COMPLETO no hay cancelacion
de la Orden: el resolver da COMPLETA y siguen control, cierre comercial y
entrega, sin omitir lo adeudado por trabajos realizados. `PROC-REP-270`
queda con cuatro contextos (entrega al cliente, devolucion a Gestion RT,
desistimiento sin Detalles y cancelacion total) sin romper los anteriores.
Los demas origenes conservan su custodia sin definir.

### Escenarios nuevos de esta iteracion

VAR-REP-010 (el tecnico agrega un Detalle y se autoriza), 011 (se rechaza), 012
(la ejecucion termina y queda un Detalle pendiente: espera de autorizacion),
013 (cancelacion parcial tras el comprobante, antes de habilitar) y 014 (bloqueo
mixto con la Orden habilitada). Adaptados: VAR-REP-004/006/007 (custodia) y
las condiciones de 047/211 en HP-REP-001, VAR-REP-001/005/008. Cobertura de los
17 casos pedidos: 1 y 2 -> VAR-REP-012 (C) y reglas del resolver (B); 3 ->
VAR-REP-012; 4 -> VAR-REP-010; 5 -> VAR-REP-010 (autoriza) y 6 -> VAR-REP-011
(rechaza); 7 -> VAR-REP-010/011; 8 y 9 (F y G) -> casos de la politica y
VAR-REP-014 para F; 10 -> VAR-REP-005; 11 -> VAR-REP-013; 12 -> VAR-REP-014; 13
-> VAR-REP-007; 14 -> VAR-REP-006; 15 -> VAR-REP-009; 16 -> VAR-REP-010; 17 ->
HP-REP-002/003 y tests de regresion. Los casos 1, 2, 8 y 9 (A, B, F, G) son
reglas del resolver, no recorridos propios, por eso se verifican como casos de
la politica y no como Scenarios artificiales.

### Evaluacion tecnica de Detalles diagnosticados por Recepcion (FEAT-REP-005)

Decision aprobada: todo Detalle con origen del diagnostico RECEPCION requiere una
**evaluacion tecnica vigente** antes de iniciar su primera Ejecucion. Es
individual, la hace ACT-TECH con la OR ya tomada, ocurre despues de seleccionar
el Detalle (`181`) y antes de las validaciones de estacion (`174`) y de la
reserva (`185`), y se registra sobre la **definicion vigente** (Detalle,
version evaluada, tecnico, fecha/hora, resultado, motivo, observaciones y efecto
aplicado). Los Detalles de origen REVISION_TECNICA no requieren una segunda
confirmacion (los diagnostico el propio tecnico en su revision), pero si
autorizacion del cliente cuando corresponda y factibilidad. Es una dimension
distinta de la autorizacion del cliente y de la ejecucion; no garantiza stock y
no reserva ni consume insumos.

**Responsabilidades (iteraciones 7 y 8).** El tecnico es responsable de definir y
registrar las reparaciones derivadas de una revision o evaluacion tecnica;
Recepcion conserva la comunicacion con el cliente.

| Accion | Responsable |
|---|---|
| Diagnostico inicial y definicion preliminar de trabajos (`070`) | ACT-RECEP |
| Revision tecnica inicial (`065`) | ACT-TECH |
| Definicion de Detalles tras la revision tecnica inicial (`075`) | ACT-TECH |
| Confirmacion o descarte tecnico (`183`) | ACT-TECH |
| Redefinicion tecnica de un Detalle (`127`) | ACT-TECH |
| Definicion de un Detalle nuevo detectado tecnicamente (`128`) | ACT-TECH |
| Consulta al cliente (`046`) | ACT-RECEP |
| Registro de autorizacion o desistimiento (`046/047`) | ACT-RECEP |

`075` pasa de ACT-RECEP a ACT-TECH (iteracion 8): sigue siendo un solo nodo, con
las mismas aristas hacia `046` (CLIENTE_EXTERNO) y `080` (otros origenes), las
mismas reglas (BR-REP-001 y BR-REP-019, con el texto de BR-REP-019 ajustado) y los
snapshots de siempre; ahora registra el tecnico que definio cada Detalle, la
fecha/hora y la referencia a la revision inicial `065`. Los Detalles quedan con
origen REVISION_TECNICA y no exigen segunda confirmacion. Definir tecnicamente no
es autorizar: luego Recepcion gestiona la autorizacion o el desistimiento. `070`
no cambia. `127` pasa de ACT-RECEP a ACT-TECH (iteracion 7); sus caminos entrantes
son `126` y `183`, ambos tecnicos, y conserva identidad del Detalle, definiciones
anteriores, historial, snapshots, vinculos de garantia, invalidacion de la
autorizacion anterior y reevaluacion de factibilidad.

**Resultado principal, aplicacion inmediata y reparaciones adicionales
(iteracion 8).** La evaluacion registra **exactamente un** resultado principal
(CONFIRMADO, DESCARTADO, REQUIERE_REDEFINICION) y su efecto se aplica **de
inmediato** sobre el Detalle original, sin esperar a que se registren, consulten
o evaluen las reparaciones adicionales. Detectar reparaciones adicionales (0..N)
es una accion complementaria, no un resultado. Antes (iteracion 7) el recorrido
del resultado se difería detras del alta y de la consulta al cliente de los
Detalles nuevos (`183 -> 184 -> 128 -> 184 -> 046 -> ... -> 182 -> 300/127`); eso
dejaba al Detalle descartado o con definicion invalidada PENDIENTE y elegible
hasta terminar. Se corrigio.

Grafo (modificacion minima):

- `181 -> 182` (decision). `182` solo decide si hace falta evaluar:
  "Requiere evaluacion tecnica" -> `183`; "No requiere evaluacion tecnica"
  (REVISION_TECNICA o CONFIRMADO vigente) -> `174`. Se eliminaron las salidas de
  retoma de la iteracion 7 (ya no hay efecto diferido).
- `183` (ACT-TECH) registra UN resultado y lo aplica: `CONFIRMADO -> 184`,
  `DESCARTADO -> 300`, `REQUIERE_REDEFINICION -> 127`.
- `300` y `127` ganan una salida de contexto para no pasar por el resolver ni por la
  consulta antes de registrar las altas: `300 -> 184` "Descarte durante la
  evaluacion tecnica" (y `300 -> 211` "Cancelacion fuera de la evaluacion tecnica"
  para el resto de los contextos); `127 -> 184` "Redefinicion durante la
  evaluacion tecnica" (y las salidas anteriores a `046`/`080` pasan a
  "Redefinicion posterior a una Ejecucion, ..."). No se duplica logica de
  cancelacion ni de redefinicion.
- `184` (decision, "Hay reparaciones adicionales detectadas por registrar"):
  "Otra reparacion adicional por registrar" -> `128` (que vuelve a `184`: 0..N
  altas); cuando no queda ninguna, el hilo tecnico continua sin pasar por la
  consulta al cliente: "Hay Detalles pendientes de factibilidad (origen distinto
  de CLIENTE_EXTERNO)" -> `080`; "Original CONFIRMADO, sin Detalles pendientes de
  factibilidad" -> `182` (que lo enruta a `174`); "Original cancelado o
  redefinido, sin Detalles pendientes de factibilidad" -> `211`. En iteracion 9
  se elimino la salida `184 -> 046` (ver "Independencia operativa entre
  Detalles").

Efectos y momento exacto:

| Resultado principal | Se aplica | Efecto |
|---|---|---|
| CONFIRMADO | al registrarlo (`183`) | Confirmacion sobre la definicion vigente; se conserva la autorizacion; sigue elegible y habilitado; las altas pendientes no lo bloquean ni invalidan su confirmacion |
| DESCARTADO | al registrarlo (`183 -> 300`) | Motivo obligatorio; deja de ser elegible (no se selecciona, ejecuta ni reserva) y se cancela por `300` con motivo tecnico DIAGNOSTICO_DESCARTADO (no es desistimiento del cliente); no cancela otros Detalles ni la OR; el resolver recien interviene tras registrar las altas |
| REQUIERE_REDEFINICION | al registrarlo (`183 -> 127`) | La definicion anterior queda invalidada y no ejecutable; el tecnico registra la nueva por `127` (mismo Detalle e historial); autorizacion anterior invalidada y nueva decision en `046/047`; nueva factibilidad en `080`; sin insumos reservados |

Casos: A (CONFIRMADO + adicional) `VAR-REP-020` y `VAR-REP-022` (varios);
B (DESCARTADO + adicional) `VAR-REP-023` (otro origen) y `VAR-REP-024` (CLIENTE_EXTERNO,
el Detalle descartado era el unico: la OR **no** pasa a TODO_CANCELADO ni inicia
custodia antes de registrar y encaminar el adicional, porque `300` vuelve a `184`
y no a `211`); C (REQUIERE_REDEFINICION + otro trabajo) `VAR-REP-025`.

*Resolver.* "Trabajable" (BR-REP-012) sigue significando **elegible para ser
seleccionado y evaluado**. Refinamiento minimo de `es_trabajable`, sin nuevos
estados: un Detalle tampoco es trabajable para ejecutar desde que se registra un
resultado tecnico que lo impide (descarte, o definicion invalidada). Como el
efecto se aplica en el mismo recorrido, no hay ventana en la que el resolver lo
trate como trabajable. La precedencia (REQUIERE_REVISION > PENDIENTE_AUTORIZACION >
PENDIENTE_RECURSOS), las causas de bloqueo, el hito historico de habilitacion, la
prioridad, la toma y el maximo de una ejecucion no cambian.

*Idempotencia.* El efecto se aplica una sola vez. Tras la factibilidad (o la
resolucion de Recepcion) el flujo vuelve al resolver (`211`) y, al reseleccionar
el Detalle,
`182` lo enruta a `174` por su evaluacion vigente: no se evalua de nuevo, no se
cancela ni redefine de nuevo y no se duplican altas (cada alta es un Detalle
distinto). Esa vuelta usa el mecanismo ya existente (`211 -> 212 -> 181`), que no
se dibuja en Scenarios.

*Trazabilidad.* Evaluacion del Detalle original: Detalle, version evaluada,
tecnico, fecha/hora, resultado, motivo/observaciones y efecto aplicado. Detalles
adicionales: IDs independientes, tecnico que los detecto y registro, fecha/hora,
definicion y snapshots, evaluacion de origen, y autorizacion y factibilidad
propias; no se mezcla con el historial de la evaluacion del original.

*Por que `127` y no `125/126`.* `125/126` estan pensados para un Detalle
REQUIERE_DEFINICION tras una Ejecucion interrumpida con la OR sin Detalles
trabajables (espera dirigida por el resolver). Aqui el tecnico ya tiene la OR
tomada y evalua el Detalle; reutilizar la espera bloquearia la OR para la propia
persona que debe evaluar. Una definicion que nace de una evaluacion o revision
tecnica queda tecnicamente validada por ese mismo acto.

*Elegible vs. habilitado.* Un Detalle sin evaluar sigue siendo trabajable, por lo
que la OR puede tomarse (FEAT-REP-004 no cambia) y no se genera REQUIERE_REVISION.
Queda **habilitado para iniciar la Ejecucion** solo tras `182/183`.

Escenarios: VAR-REP-016 (confirma sin adicionales), 017 (descarta, los demas
continuan), 018 (descartan todos, custodia y devolucion), 019 (redefine), 020
(caso A), 021 (REVISION_TECNICA no requiere segunda confirmacion), 022 (varias
adicionales), 023 y 024 (caso B), 025 (caso C). HP-REP-001 y HP-REP-002 (origen
RECEPCION) pasan por `183 -> 184 -> 182 -> 174`; HP-REP-003 (REVISION_TECNICA,
definido por el tecnico en `075`) por `182 -> 174`.

### Independencia operativa entre Detalles y autorizacion diferida (BR-REP-037)

Decision aprobada (iteracion 9): si un Detalle tiene su diagnostico tecnico
confirmado cuando corresponde, esta autorizado y cumple las condiciones de
ejecucion, el tecnico puede continuar trabajando sobre el independientemente de
la situacion de los demas Detalles (pendientes de autorizacion, de revision, de
recursos o de resolucion comercial). La trabajabilidad y la posibilidad de
ejecutar se evaluan **por Detalle**: (1) definicion vigente valida; (2)
autorizacion vigente del cliente, cuando corresponda; (3) confirmacion tecnica
vigente, si es exigible; (4) compatibilidad con la estacion; (5) factibilidad y
posibilidad de reservar insumos; (6) ausencia de una restriccion operativa de la
OR, como otra Ejecucion activa. El estado de los otros Detalles no es, por si
mismo, una restriccion; ellos conservan sus bloqueos individuales y no se
desbloquean automaticamente.

**Autorizacion diferida.** Se separa la **creacion** de la solicitud (el tecnico
registra el alta con `128`; el Detalle nace PENDIENTE_AUTORIZACION) de su
**resolucion** (Recepcion consulta al cliente y registra autorizacion, rechazo o
falta de respuesta con `046/047`). La resolucion puede hacerse despues, sin
respuesta inmediata del cliente; la ausencia de respuesta no equivale a
autorizacion ni a rechazo. Una consulta pendiente no bloquea al tecnico.

**Problema corregido.** Hasta la iteracion 8 el grafo obligaba a pasar por la
consulta antes de seguir: `184 -> 046` (evaluacion) y `128 -> 046` (ejecucion)
llevaban a `046/047 -> 080 -> 090 -> 211` antes de poder retomar el trabajo. Eso
dejaba una dependencia funcional que contradice la regla aprobada.

| Cambio | Antes | Ahora |
|---|---|---|
| Alta durante la ejecucion en CLIENTE_EXTERNO | `128 -> 046` | `128 -> 190` (la ejecucion continua) |
| Fin de las altas en la evaluacion | `184 -> 046` / `184 -> 080` | `184 -> 182` (original CONFIRMADO) / `184 -> 211` (cancelado o redefinido) / `184 -> 080` solo si hay pendientes de factibilidad de otro origen (evaluacion del sistema) |
| Gestion de la solicitud por Recepcion | dentro del hilo tecnico | entrada propia `EVT-REP-003 -> 046` (y `129 -> 046` cuando ningun Detalle es trabajable) |
| Falta de respuesta | no modelada | `046 -> 211 [Solicitud sin resolver, Detalles siguen pendientes de autorizacion]` (antes `047 -> 211 [Sin respuesta ...]`) |

Nodos y aristas nuevos: el evento `EVT-REP-003` (entrada independiente de
Recepcion, como `EVT-REP-002` lo es de la garantia RMA) y las aristas
`EVT-REP-003 -> 046` y `046 -> 211 [Solicitud sin resolver ...]`; ademas se
modifican `128 -> 190` y las salidas de `184`. No se agregan estados operativos,
no se toca la precedencia del resolver ni su politica; BR-REP-012 suma los casos
J, K y L y la distincion entre Detalle elegible, habilitado para ejecutar y
terminal.

**Hilo tecnico y carril de Recepcion.** El hilo tecnico (`181 -> 182 -> 174 ->
185 -> 190 -> 200 -> 210 -> 211`) no pasa por `046/047`. El carril de Recepcion
(`EVT-REP-003 -> 046 -> 047 -> 080 | 300 | 305 | 306 | 211`) vuelve al resolver, que
se reevalua cuando cambia una condicion relevante: con una Ejecucion activa
devuelve EN_EJECUCION (`211 -> 190`) sin iniciar una segunda; sin Detalles
trabajables sigue la precedencia REQUIERE_REVISION > PENDIENTE_AUTORIZACION >
PENDIENTE_RECURSOS conservando todas las causas.

**Toma, prioridad y control final.** Una consulta pendiente no cierra ni libera
la toma: solo se cierra cuando el resolver determina que no queda ningun Detalle
trabajable (BR-REP-018). Se conservan la prioridad, el hito historico de
habilitacion (sin 140/150) y el maximo de una Ejecucion activa. La OR no pasa al
control final, cobro ni entrega con Detalles pendientes de autorizacion, revision,
recursos o ejecucion; recien con todos terminales (`211 -> 220`).

| Caso | Cobertura |
|---|---|
| A. Original confirmado y adicional pendiente (sin respuesta) | VAR-REP-020 (y 022 con varias altas); VAR-REP-027 (sin respuesta) |
| B. Otro Detalle sin stock | VAR-REP-028 |
| C. Otro Detalle requiere redefinicion o revision | VAR-REP-029 |
| D. Todos los Detalles bloqueados | VAR-REP-014 (recursos + autorizacion), VAR-REP-024/025 (espera de autorizacion) y BR-REP-012 casos I y K |
| E. Se autoriza un adicional durante la ejecucion | VAR-REP-010 |
| F. Ultimo ejecutable completado, otro pendiente | VAR-REP-026 |
| G. Adicional rechazado | VAR-REP-011 |

Pendiente de negocio: cuanto tiempo puede permanecer sin respuesta una
solicitud (hoy sin plazo) y como se escala; si el original CONFIRMADO debe
ofrecerse al tecnico automaticamente tras un desvio por factibilidad de otro
origen (hoy se reselecciona por `211 -> 212 -> 181`).

### Saldo a favor del cliente y devolucion de dinero (BR-REP-038)

Corrige el hallazgo **AUD-V14-001** de la auditoria transversal
(`docs/audits/repair-management-v1.4-transversal-audit.md`): una Orden de
`CLIENTE_EXTERNO` con dinero a favor del cliente (anticipo mayor al Total final,
por ejemplo una revision `SIN_REPARACION` con sena, o trabajos cancelados) quedaba
sin salida entre `PROC-REP-265` y `266`, y las cancelaciones finalizaban sin
verificar el saldo. Decision aprobada: si la OR tiene dinero a favor del cliente,
es **obligatorio** registrar la devolucion de dinero antes de permitir la entrega o
el cierre comercial; haber identificado el saldo a favor no habilita ninguna de
las dos cosas.

**Formula funcional:** `Saldo = Total final de la OR - Pagos recibidos +
Devoluciones realizadas`. Los tres terminos se mantienen separados: los Pagos
originales no se borran ni se modifican, y una devolucion **no** es un pago de
importe negativo sino un movimiento financiero distinto.

| Saldo | Tratamiento | Nodo |
|---|---|---|
| > 0 | cobro pendiente (circuito de cobro, sin cambios) | `265 -> 266 -> 265` |
| = 0 | continua si se cumplen las demas condiciones, sin movimientos nuevos | `265 -> 280` |
| < 0 | registrar la devolucion de dinero; parcial: el remanente sigue pendiente; total: Saldo = 0 y se revalida la entrega | `265 -> 267 -> 265` |

Ejemplo: Total $0, anticipo $5.000, devolucion $0 -> Saldo -5.000; tras devolver
$3.000 -> -2.000 (no entregable); tras otros $2.000 -> 0 (puede continuar).

**Cambios en el grafo (V1.4, `PROC-REP` pasa de 70 a 72 nodos y de 130 a 135
aristas):**

- `PROC-REP-267` (nuevo, ACT-RECEP, FEAT-REP-007): registra la devolucion de dinero
  con identificador unico del movimiento, OR, importe positivo, medio de devolucion,
  usuario responsable, fecha/hora, referencia de la operacion y motivo. Conserva el
  historial completo de devoluciones parciales y totales, no admite una devolucion
  superior al saldo a favor pendiente (sin una regla adicional aprobada) ni
  computarla dos veces por reintentos, y distingue la devolucion realizada de la
  mera intencion. Cada pasada exige un movimiento real: no hay ciclos automaticos.
- `PROC-REP-268` (nuevo, decision, FEAT-REP-008): verificacion previa al fin. Es la
  **unica** entrada a `EVT-REP-999`: la entrega comercial y la devolucion a Gestion
  RT (`270`), el cierre `SIN_REPARACION` (que ya paso por `265`) y todas las
  cancelaciones y desistimientos (`211`, `306`, `271`) pasan por ella.
  "Sin saldo a favor pendiente" -> fin; "Saldo a favor del cliente pendiente de
  devolver" -> `267`, que vuelve a `268` tras cada devolucion.
- `PROC-REP-265` pasa de dos a tres salidas ("No, saldo pendiente de cobro" ->
  `266`; "No, saldo a favor del cliente" -> `267`; "Si" -> `280`): el circuito de
  cobro solo atiende Saldo > 0.
- `267` queda compartido por la validacion de entrega y la verificacion previa al fin
  con salidas rotuladas por contexto ("Devolucion registrada, validar entrega" ->
  `265`; "... validar fin de Orden" -> `268`), el mismo idioma que usa `270`. Con un
  grafo de un solo token, la alcanzabilidad topologica pura cruza contextos; los
  tests usan un recorrido que respeta la salida rotulada.

**Rutas verificadas:** (a) *revision sin reparacion con anticipo*: `068 [No] -> 069 ->
250 -> 260 -> 265 -> 267 -> 265 -> 280 -> 270 -> 268 -> fin` (VAR-REP-030, el caso
BLOCKER: Total $0, anticipo $5.000, devolucion $5.000, Saldo 0). (b) *cancelacion
con anticipo*: con equipo en custodia `211 -> 270 -> 268 -> 267 -> 268 -> fin` (la
devolucion fisica no sustituye a la de dinero, VAR-REP-032); sin equipo
`211 -> 268 -> 267 -> 268 -> fin` (VAR-REP-033). (c) *varios Detalles COMPLETO y
CANCELADO*: solo se devuelve el excedente, en devoluciones parciales (VAR-REP-031).
(d) saldo cero sin devolucion (VAR-REP-034). (e) origenes sin circuito comercial:
`265` aprueba por NO_COBRABLE y `268` siempre responde "sin saldo a favor", sin
registrar pagos ni devoluciones (VAR-REP-035). Una cortesia total con Pagos ya
recibidos deja Saldo < 0 y tambien se devuelve; no habilita la entrega por si sola.

**Verificacion:** `npm run test:commercial-closure:v1.4` (incluido en
`validate:v1.4`) comprueba los invariantes del grafo (unico acceso al fin, tres
salidas excluyentes de `265`, sin ciclos sin accion financiera, las
cancelaciones nunca alcanzan la entrega comercial), el texto de BR-REP-038 y
reproduce los Scenarios con dinero recalculando el Saldo paso a paso con la
formula aprobada.

**Pendientes de negocio:** quien puede registrar devoluciones (por ejemplo solo
ACT-ADMIN, como las cortesias) y el catalogo de medios de devolucion; plazo o
abandono si el cliente no retira el dinero; devoluciones posteriores a ENTREGADA;
tratamiento de un saldo a favor en origenes sin circuito comercial (hoy
documentado como pendiente funcional, sin cobros ni devoluciones); aprobacion de
una sobredevolucion (hoy no admitida). BR-REP-014 conserva su texto V1.3
congelado; BR-REP-038 define el reembolso de pagos ya realizados que esa regla
dejaba pendiente, y las demas consecuencias comerciales de una cancelacion (por
ejemplo penalidades) siguen pendientes.

### Viewer por origen: Cliente Externo V1.4

Para revisar con negocio solo el subproceso de `CLIENTE_EXTERNO` existe una vista
generada, independiente del viewer general (que no cambia):

| Artefacto | Ruta |
|---|---|
| Viewer HTML (autocontenido, abre con doble clic, sin servidor ni red) | `generated/viewer/repair-management-cliente-externo-v1.4.html` |
| Mermaid de la vista | `generated/mermaid/repair-management-cliente-externo-v1.4.mmd` |
| Filtro reproducible | `scripts/lib/origin-filter.ts` |
| Tests de la vista | `scripts/test-origin-view.ts` |

Comandos: `npm run generate:cliente-externo:v1.4` (valida V1.4, genera Mermaid y HTML y
corre los tests de la vista), o por separado
`npm run generate:mermaid:cliente-externo:v1.4`,
`npm run generate:viewer:cliente-externo:v1.4` y
`npm run test:cliente-externo:v1.4`. Los mismos scripts generales aceptan
`--origin=<ORIGEN>` (`CLIENTE_EXTERNO`, `RT_INTERNO`, `RMA_GARANTIA_REPARACION`,
`RT_GARANTIA_VENTA`); sin el flag generan exactamente lo de siempre.

La vista es un **subconjunto de nodos, aristas y Scenarios reales** de la V1.4
(no agrega nada). Una arista se quita solo si (1) su condicion nombra otro origen
o niega `CLIENTE_EXTERNO` ("Origen distinto de CLIENTE_EXTERNO", `RT_INTERNO`, ...),
(2) su condicion es neutra pero SOLO la recorren Scenarios de otro origen (por
ejemplo las salidas "No" de `050` y `250`, que el modelo no codifica por origen), o
(3) queda inalcanzable desde los eventos de inicio que conservan salidas. No se usa
la mera alcanzabilidad topologica. El panel "Proceso" del viewer lista todo lo
excluido y por que, para que negocio lo confirme. Las aristas punteadas son el
carril independiente de Recepcion (`EVT-REP-003 -> 046`): no son un paso del hilo
tecnico. El actor se muestra en cada nodo y el boton "Ajustar a pantalla" encuadra
el diagrama completo. Limites de la representacion (un solo token, capacidades
transversales sin nodo, mecanismo continuar/liberar sin Scenario) en el mismo panel.

### Explorador interactivo de recorridos V1.4

Para **construir un recorrido del proceso paso a paso**, eligiendo en cada bifurcacion una
de las alternativas que realmente existen, hay un viewer independiente (los viewers
general y de Cliente Externo no cambian):

| Artefacto | Ruta |
|---|---|
| Viewer HTML (autocontenido: doble clic, sin servidor, sin red, sin CDN) | `generated/viewer/repair-management-interactive-v1.4.html` |
| Generador | `scripts/generate-interactive-viewer.ts` |
| Motor de navegacion (replay determinista, logica pura) | `scripts/lib/explorer-engine.ts` |
| Politica de origenes (reutiliza `origin-filter.ts`) | `scripts/lib/explorer-origin.ts` |
| Anotaciones del viewer (tipo de decision, esperas, salidas por contexto) | `scripts/lib/explorer-annotations.ts` |
| Datos, layout y exportaciones | `scripts/lib/explorer-data.ts`, `explorer-layout.ts`, `explorer-export.ts` |
| Interfaz (HTML/JS/CSS del cliente) | `scripts/viewer/explorer-client.js`, `scripts/viewer/explorer.css` |
| Tests | `scripts/test-explorer.ts` (logica), `test-explorer-output.ts` (diagrama, exportaciones, HTML), `test-explorer-browser.ts` (Chrome sin cabeza) |

Comandos: `npm run generate:interactive:v1.4` (valida V1.4, genera el HTML y corre los
tests), o por separado `npm run generate:viewer:interactive:v1.4` y
`npm run test:interactive:v1.4`. Chrome es opcional para los tests (`CHROME_PATH`); sin
Chrome la parte de navegador se omite.

**Como funciona.** El viewer no muestra el grafo: muestra el evento inicial, avanza solo
por los nodos que no requieren eleccion y se detiene en la primera bifurcacion. Al elegir
una alternativa agrega solo esa rama y sigue hasta la proxima decision, espera o fin. El
estado completo es la lista ordenada de acciones del usuario (elegir, confirmar un ciclo,
marcar un evento externo, activar o cerrar un carril): el motor las **re-aplica** sobre el
grafo real de PROC-REP, por lo que volver atras, cambiar una decision pasada o reiniciar es
truncar esa lista y nada incompatible puede sobrevivir. El recorrido tambien viaja en la URL
(`#r=...`), asi que se puede guardar o compartir.

**Bifurcaciones.** Cada alternativa es una arista real, con su condicion textual. Se
distingue la decision humana, la validacion del sistema, la condicion derivada de estados, el
dato de la Orden (por ejemplo el origen), el evento externo y la alternativa de escenario
(punto de entrada de una variante o excepcion). Esa clasificacion es del viewer, no del
Source of Truth: cada una cita su fundamento (texto o actor del nodo) y dice si es
documentada o inferida. Elegir una alternativa de una validacion del sistema es explorar un
resultado, no forzarlo. Los nodos compartidos con salidas rotuladas por contexto (127, 128,
267 y 300) ofrecen solo la salida que corresponde al nodo de procedencia, segun su texto.

**Ciclos.** Un salto automatico nunca repite un nodo ya visitado: el motor se detiene y
pide confirmar. Cada repeticion es una caja nueva ("visita 2 de 3"), de modo que se
conserva el historial de cada visita (cobro 265 -> 266 -> 265, devolucion 265 -> 267 -> 265,
ejecuciones multiples, continuar o liberar). Las esperas (129, 120, 125, 266) detienen el
recorrido hasta que el usuario marca que el evento externo ocurrio.

**Eventos independientes.** `EVT-REP-003` (autorizacion diferida de Recepcion) es un panel
aparte: el usuario lo activa y se dibuja en una columna propia, unido por un conector que
dice que **no es una arista del modelo**. No bloquea ni cambia el hilo tecnico (ambos pueden
tener una decision pendiente a la vez) y regresa al recorrido principal al llegar al
resolver (`211`) o a la factibilidad (`080`). Con el grafo de un solo token no se dibuja la
concurrencia real ni se inventa ninguna sincronizacion.

**Origenes.** La primera decision (`PROC-REP-010`) elige el origen y desde ahi se aplica la
politica de `explorer-origin.ts`: las aristas de otro origen demostradas por el modelo (la
condicion nombra otro origen) no se ofrecen; las bifurcaciones por origen que el modelo no
codifica (`050` y `250`) siguen resolviendose con la evidencia de Scenarios, igual que en la
vista de Cliente Externo. Lo que ningun Scenario del origen recorre pero el modelo tampoco
prueba ajeno (por ejemplo `068 -> 069` o las salidas del resolver para RT_INTERNO) **no se
excluye en silencio**: se ofrece marcado como hipotesis sin evidencia, y se puede ocultar
desde Opciones. Lo que no se ofrece se lista con su motivo. RT_GARANTIA_VENTA (fuera de MVP
v2, sin Scenarios) se recorre solo con las condiciones del modelo.

**Varios Detalles.** El explorador no calcula ningun estado de negocio (Saldo, estado
agregado, autorizaciones). Distingue, para cada nodo con evidencia en su texto, si la
condicion es por Detalle, la situacion agregada de la OR (resolver `211`) o el cierre de
todos los Detalles, y muestra un ejemplo ilustrativo de varios Detalles a la vez. Las
alternativas se exploran como hipotesis.

**Exportacion.** Mermaid (`.mmd`, con los helpers del generador), lista ordenada de nodos
y decisiones (`.txt`), recorrido reproducible (`.json`) e imagen (`.svg` / `.png`). Solo
contienen nodos y aristas reales; las visitas repetidas llevan sufijo `_vN` en su id Mermaid.

**Observacion sobre el Source of Truth (no corregida).** `VAR-REP-023` se titula "origen
distinto de CLIENTE_EXTERNO" y recorre `184 [... origen distinto de CLIENTE_EXTERNO] -> 080`,
pero declara `applies_to: HP-REP-001`, por lo que `scenarioOrigins()` la lee como de Cliente
Externo y la vista de ese origen la excluye. Ya figura en la auditoria transversal. El
explorador ofrece esa arista solo a los otros origenes (correcto segun su condicion) y su test
recorre ese Scenario con el origen que dice su titulo.

### Decision del cliente simplificada: sin Detalles y tres decisiones (iteracion 10)

Iteracion acotada, aprobada tras revisar el explorador interactivo. Reemplaza lo
descrito arriba para PROC-REP-045/055/046/047 (esas secciones conservan el
detalle de la capacidad de autorizacion; en caso de diferencia manda esta).

**1. Sin Detalles conocidos, no se consulta por Detalle.** Si en `PROC-REP-045` todavia
no se conocen las reparaciones, la OR queda EN_REVISION (`055`), se registra la
recepcion y la custodia (`050/060`, comprobante "reparacion pendiente de
diagnostico"), se espera la revision y el diagnostico de RT (`065/068`) y el
tecnico define y registra los Detalles (`075`). **Recien entonces** Recepcion consulta al
cliente por esos Detalles (`046/047`). Entre `055` y el comprobante hay un unico nodo
nuevo, `PROC-REP-056` (ACT-RECEP, FEAT-REP-002): registra si el cliente continua con
la revision tecnica ("Acepta la revision tecnica" -> `050`) o desiste ("Desiste sin
Detalles" -> `306`, con su custodia, saldo y cierre). Es el desistimiento propio de esa
etapa, separado de la autorizacion por Detalle, y no se inventa ningun Detalle ficticio.
Si la revision concluye que no corresponde reparar, rige el circuito SIN_REPARACION
(`068 [No] -> 069`). Con esto el recorrido que la auditoria marco en AUD-V14-002
(`055 -> 046 -> 047 -> 211 [Sin respuesta]`, resolver con cero Detalles) deja de existir:
`046` solo se invoca desde `070`, `075`, `127`, `129` y `EVT-REP-003`, es decir, con Detalles.

**2. `PROC-REP-047` tiene exactamente tres decisiones de negocio.**

| Decision | Condicion de la arista | Efecto |
|---|---|---|
| A. ACEPTA_TRABAJOS | `Acepta trabajos` -> `211` | autoriza cada Detalle sobre su definicion vigente; no genera una definicion nueva ni ejecuta nada |
| B. RECHAZA_ALGUNOS_DETALLES | `Rechaza algunos Detalles` -> `300` -> `211` | registra cuales acepta y cuales rechaza; cancela solo los rechazados; los aceptados siguen a factibilidad |
| C. RECHAZA_TODOS_LOS_TRABAJOS | `Rechaza todos los trabajos` -> `305` -> `211` | cancela los Detalles pendientes elegibles (no los COMPLETO ni ejecuciones activas); el desenlace incluye custodia, saldo y devolucion |

Se retiraron de `047`: "Acepta, antes del comprobante" y "Acepta, requiere factibilidad" (eran
condiciones internas), "Desiste sin Detalles" (ahora `056 -> 306`) y "Sin respuesta del
cliente" (no es una decision).

**3. El sistema resuelve lo interno, en `PROC-REP-211`.** Las tres decisiones vuelven al
resolver, que ya elegia el siguiente paso por hitos: "Antes del comprobante de recepcion"
-> `050` (emite el comprobante y sigue a `080`); "Comprobante emitido, factibilidad pendiente"
-> `080`; el resto segun el resolver (BR-REP-012, sin cambios). Existencia del comprobante,
habilitacion historica, factibilidad pendiente y estado de la OR **ya no son elecciones del
cliente**. La factibilidad la evalua el sistema por Detalle (`080`, ACT-SYSTEM) despues de la
autorizacion; no se traslada a Recepcion ni es una decision comercial. Una autorizacion
posterior no regenera el comprobante: `047 -> 211 -> 080`, nunca `050/060`.

**4. Sin respuesta.** No hay una decision que registrar: `046 -> 211 [Solicitud sin resolver,
Detalles siguen pendientes de autorizacion]`. Los Detalles consultados siguen
PENDIENTE_AUTORIZACION, el resolver los mantiene bloqueados individualmente (o abre la
espera `129` si ninguno es trabajable), no se bloquea a los demas Detalles autorizados y
`EVT-REP-003` / `129 -> 046` permiten reintentar. Si el cliente responde solo por algunos
Detalles, esas respuestas se registran (A o B) y los demas quedan pendientes.

**5. AUD-V14-003.** `211 -> 080 [Comprobante emitido, factibilidad pendiente]` aplica ahora tambien
con la Orden ya habilitada, de modo que una autorizacion parcial (`047 -> 300 -> 211 -> 080 -> 090 ->
211 -> 190`, VAR-REP-036) o una autorizacion diferida (`EVT-REP-003`, VAR-REP-010) nunca omiten la
factibilidad ni bloquean la ejecucion vigente: `080` solo consulta disponibilidad (no reserva, no
interrumpe, no libera la toma) y vuelve al resolver por `090 [Orden ya habilitada]`.

**Grafo:** 73 nodos (+`056`) y 135 aristas (sin cambio neto: -4 en `047`, +1 `047 -> 211`, +1
`046 -> 211`, +2 en `056`); 38 reglas (BR-REP-027/028/030/031/034/037 actualizadas, ninguna
nueva); 44 Scenarios (+VAR-REP-036; VAR-REP-001/004/027 reescritos y los demas actualizados a
las nuevas aristas). El explorador interactivo muestra las tres alternativas en `047`; `211` aparece
como decision del sistema y la solicitud sin resolver de `046` como evento externo, sin logica
especial en el HTML.

**Pendientes de negocio (no resueltos aqui):** plazo y escalacion cuando el cliente no responde (en
`046` o en `056`); canal de consentimiento (ya pendiente); si debe existir un nodo de enrutamiento
dedicado en lugar de reutilizar `211` (hoy se reutiliza para no duplicar la politica del resolver);
confirmar que "Acepta trabajos" cubre el caso "responde solo por algunos y el resto queda pendiente".

### Pendientes y posibles conflictos de V1.4

- **Evaluacion tecnica (BR-REP-035/036):** el modelo tecnico de versiones de la
  definicion, el catalogo de motivos tecnicos (hoy DIAGNOSTICO_DESCARTADO o
  equivalente) y quien puede cancelar siguen abiertos. Con un unico token en el
  grafo, las altas y su consulta se dibujan como desvio que vuelve por `211`; el
  Detalle original CONFIRMADO no depende de la decision sobre el adicional (sigue
  trabajable para el resolver), pero su ejecucion en el grafo ocurre al
  reseleccionarlo despues del desvio, por el mecanismo `211 -> 212 -> 181`
  (continuar o liberar).
- **Resuelto en la iteracion 8:** `PROC-REP-075` pasa al tecnico y el efecto del
  resultado principal ya no se difiere. Pendiente de negocio: si la consulta de
  los adicionales debe poder diferirse mas alla del desvio (hoy se hace antes de
  reseleccionar el Detalle original).
- **Rechazo parcial de adicionales (`047 -> 300`):** si el cliente autoriza
  algunos Detalles y rechaza otros en la misma consulta, el rechazo cancela solo
  los rechazados y los autorizados pasan por factibilidad: `300 -> 211 -> 080`
  tambien con la OR ya habilitada (iteracion 10, AUD-V14-003; VAR-REP-036). Una
  reserva fallida sigue cubierta por `186`.
- **Precedencia entre causas de bloqueo** (REQUIERE_REVISION >
  PENDIENTE_AUTORIZACION > PENDIENTE_RECURSOS): resuelta, decision de negocio
  aprobada en la iteracion 5.
- **Custodia pendiente de confirmar:** resuelta con PROC-REP-271. Queda sin
  definir el plazo o la escalacion si Recepcion no la regulariza (la Orden
  permanece CANCELADA sin fin operativo) y la evidencia aceptable (hoy "evidencia
  o referencia", por ejemplo el comprobante).
- **Custodia fuera de CLIENTE_EXTERNO:** RT_INTERNO no emite comprobante de
  recepcion, por lo que su criterio de "equipo recibido" y la devolucion de una
  Orden cancelada de ese origen (o de RMA/garantia de venta) no estan
  definidos; hoy 211 (d) los trataria con el mismo criterio de comprobante.
- **Equipo recibido con cantidad_detalles = 0:** la arista `306 -> 270` existe
  pero ningun recorrido actual la alcanza (el comprobante se emite antes de la
  revision y el desistimiento sin Detalles ocurre antes de emitirlo); queda
  disponible si se agrega un punto de desistimiento durante la revision.
- **Efecto sobre V1.3 de 090 -> 211:** aprobado; la prioridad no se vuelve a
  pedir al revalidar con la Orden habilitada. Queda la ambiguedad de que las
  aristas de 090 conservadas de V1.3 se solapan en el texto con "Orden ya
  habilitada" (documentado como excluyente y evaluada primero).
- **Concurrencia:** el grafo sigue siendo de un solo token. La concurrencia real
  entre el hilo tecnico y la gestion de Recepcion se dibuja con una entrada
  propia (`EVT-REP-003`, precedente de `EVT-REP-002`) y se documenta en
  128/190/046/047, BR-REP-032, BR-REP-034 y BR-REP-037; no se dibuja un fork.
- Canal de consentimiento del cliente; si una redefinicion que confirma el
  mismo Tipo y precio debe requerir nueva autorizacion (por ahora si); que
  ocurre si el cliente posterga su decision (el Detalle sigue pendiente).
- Desistir de todo con una Ejecucion activa: 305 no cancela Detalles en
  ejecucion (BR-REP-014); deben interrumpirse antes.
- FEAT-REP-002: validacion tecnica de las reparaciones diagnosticadas y estados
  PENDIENTE/CONFIRMADA/DESCARTADA (no definidos).
- FEAT-REP-009: quien puede cancelar (tambien 306), catalogo de motivos de
  desistimiento y cancelacion fuera de CLIENTE_EXTERNO. Las consecuencias
  comerciales de un anticipo (saldo a favor) se resuelven con BR-REP-038
  (devolucion de dinero obligatoria antes del fin); siguen pendientes las demas
  consecuencias, como penalidades.
- FEAT-REP-001: condiciones de uso/privacidad/disponibilidad de
  cuitonline.com antes del scraping; identificacion alternativa sin IMEI;
  estructura del checklist y estandarizacion del diagnostico; almacenamiento y
  trazabilidad de fotografias y de la seleccion de reparaciones diagnosticadas.

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
- (Resuelto en V1.3, BR-REP-019) Vinculacion de la garantia RMA: la Orden
  nueva referencia la Orden origen y cada Detalle nuevo referencia su
  Detalle origen. Siguen pendientes las reglas de garantia RMA configurable
  y de garantia vencida, y el modelo tecnico de esa relacion.
- Distribucion/acreditacion de puntaje entre multiples tecnicos que
  participaron de un mismo Detalle (ya pendiente en V1.2, ahora ademas
  interactua con multiples Ejecuciones por Detalle).
- Catalogo definitivo de motivos de cancelacion/interrupcion de
  Ejecucion.
- Garantia de reparacion post-entrega a nivel Detalle (hoy solo se
  relaciona a nivel Orden).
- Multi-moneda en precios y pagos.
- Que ocurre si la revision tecnica de un Detalle puntual
  (PROC-REP-126/127) tampoco logra definir una reparacion para ese
  Detalle en particular: a diferencia del circuito inicial
  (PROC-REP-068/069), aqui no existe todavia un camino equivalente a
  SIN_REPARACION acotado a un unico Detalle (por ejemplo, dejarlo
  indefinido, o cancelarlo puntualmente via PROC-REP-300). Que asigna la
  condicion REQUIERE_DEFINICION (PROC-REP-200 "Requiere redefinicion") y
  quien la retira (PROC-REP-127) ya esta definido; lo pendiente es
  exclusivamente este caso de borde.
- Efecto comercial de una redefinicion (PROC-REP-127) que cambia el
  precio snapshot: el nuevo total es la suma de los snapshots vigentes y
  saldo = total - pagado. Precio mayor -> saldo adicional pendiente;
  precio menor -> saldo negativo / pago excedente. SIN definir todavia:
  tratamiento del pago excedente (devolucion/reembolso, credito a favor),
  y aceptacion/aprobacion comercial del cliente ante un aumento de precio
  (presupuesto). No bloquea EXC-REP-004.
- **PENDING BUSINESS DECISION (MVP v2): paralelismo de Detalles /
  Ejecuciones.** Pregunta abierta al cliente: un mismo equipo, puede tener
  varias reparaciones trabajandose simultaneamente? Hasta tener respuesta
  se mantiene BR-REP-007 (maximo una Ejecucion activa por Orden) y
  BR-REP-018 sin cambios: no se inician varios Detalles en paralelo ni
  varias Ejecuciones simultaneas.
- Reporting por tecnico (a futuro, sin agregar nodos al Business
  Process): OR actualmente tomadas, OR trabajadas, OR liberadas, Detalles
  completados, trabajos pendientes. El historial de toma/liberacion
  (PROC-REP-180/212/213, BR-REP-018) ya deja la base de datos conceptual
  necesaria; el reporting en si y las Features de UI correspondientes
  quedan fuera de alcance de esta revision.
