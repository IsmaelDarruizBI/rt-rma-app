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

`repair-management.yaml` contiene actualmente la V1.2 (draft) del proceso de
Gestion de Ordenes de Reparacion de Rosario Tecno, baseline funcional final
de esta etapa de Business Process Discovery & Modeling. Sobre la V1.1,
incorpora la validacion de Estacion de Trabajo al momento de tomar una
Orden (ver "Estaciones de Trabajo" mas abajo) y sigue pendiente de
validacion funcional final con el negocio. Ver "Estados conceptuales V1.2",
"Estaciones de Trabajo", "Procesos adicionales descubiertos" y
"Pendientes" mas abajo.

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
