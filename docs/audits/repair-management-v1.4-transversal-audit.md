# Auditoria funcional transversal - PROC-REP V1.4 (draft local, sin commit)

- Alcance: `business/processes/repair-management-v1.4.yaml` (70 nodos, 130 aristas), `business/rules/business-rules-v1.4.yaml` (37 reglas), `business/features/repair-management-features-v1.4.yaml` (9 Features), `business/scenarios/repair-management-scenarios-v1.4.yaml` (37 Scenarios), `business/actors/actors.yaml`, `docs/discovery/README.md`, `scripts/test-scenarios.ts` y los generadores.
- Estado auditado: el workspace REAL (incluye los cambios sin commit de V1.4); no se asumio que lo publicado en GitHub lo represente.
- Esta auditoria NO modifica el Source of Truth ni implementa correcciones. Las propuestas son minimas y quedan para decidir en conjunto.
- Metodo: lectura integral de nodos, aristas, reglas, Features y Scenarios; scripts de analisis sobre el modelo parseado (aristas no recorridas, referencias, actores, trazabilidad); recorrido de los tres Happy Paths arista por arista; combinacion de variantes y casos limite contra las reglas citadas; revision del README contra el YAML y de los Scenarios y tests contra las reglas y el grafo (ambas con subagentes de lectura; todo hallazgo se verifico contra el YAML antes de incluirlo).

## Resumen ejecutivo

**Veredicto: NOT READY.** V1.4 es consistente en su nucleo (ingreso, autorizacion por Detalle, evaluacion tecnica, independencia operativa, custodia) y las validaciones pasan, pero se demostro un recorrido legitimo del cliente externo que no tiene salida valida (cierre comercial con saldo a favor) y tres contradicciones funcionales de severidad alta. Ninguna de las cuatro exige una regla de negocio nueva para quedar resuelta documentalmente, salvo la politica de saldo a favor (decision de negocio).

| Severidad | Cantidad | IDs |
|---|---|---|
| BLOCKER | 1 | AUD-V14-001 (corregido, ver el hallazgo) |
| HIGH | 3 | AUD-V14-002 (corregido), 003 (corregido), 004 |
| MEDIUM | 9 | AUD-V14-005 a 011, 017 y 018 |
| LOW | 5 | AUD-V14-012 a 016 |
| Total | 18 | |

Riesgos principales:

1. **Cierre comercial sin salida con saldo a favor** (001): senas/anticipos mayores al Total Cobrable dejan la Orden entre `PROC-REP-265` y `266` indefinidamente. **Corregido (ver AUD-V14-001).**
2. **Carril de autorizacion diferida con huecos** (002, 003, 004, 005): la independencia operativa aprobada se cumple para el hilo tecnico, pero el carril de Recepcion (`EVT-REP-003 -> 046 -> 047`) tiene una salida invalida cuando la Orden no tiene Detalles, no admite resultados mixtos, choca con la prohibicion textual de cancelar con una Ejecucion activa y no liga la solicitud a la version de la definicion.
3. **Verificacion mayormente textual** (008, 018): cerca de la mitad de las aserciones de los tests V1.4 son expresiones regulares sobre prosa y una quinta parte compara el YAML consigo mismo; los Scenarios no declaran sus prerrequisitos, por lo que las combinaciones de variantes no son ejecutables.

Lo que SI esta bien (verificado): ningun camino llega a `PROC-REP-185` sin pasar por `PROC-REP-182`; `PROC-REP-220` solo se alcanza desde `PROC-REP-211 [Todos terminales, existe completo]`; el hilo tecnico (`184 -> 182 -> 174 -> 185 -> 190`, `128 -> 190`) no pasa por `046/047`; los HP de RT_INTERNO y RMA no incorporan cobros, notificaciones ni comprobantes de Cliente Externo; la precedencia del resolver, el hito historico de habilitacion y las bifurcaciones de custodia son coherentes entre nodos, reglas y Scenarios.

## Hallazgos

### AUD-V14-001 - BLOCKER - Saldo a favor del cliente deja la Orden sin salida comercial (RESUELTO)

- **Proceso / Feature:** cierre comercial (FEAT-REP-007) y cancelaciones (FEAT-REP-009), origen CLIENTE_EXTERNO.
- **Nodos / reglas / escenarios:** `PROC-REP-265`, `266`, `280`, `270`, `069`, `300`, `305`; BR-REP-017 (A y B), BR-REP-016, BR-REP-014, BR-REP-010. Ningun Scenario cubre el caso (HP-REP-001 solo recorre `265 [No] -> 266 -> 265 [Si]` con Saldo > 0).
- **Descripcion:** el gate de entrega aprueba solo con "Saldo = 0 o cortesia total" y `266` exige "Pagos adicionales que salden la diferencia". BR-REP-017 (A) permite registrar sena/anticipo "en cualquier momento desde que la Orden existe". Si el Total Pagado supera el Total Cobrable (el Saldo es negativo) ninguna capacidad definida lo lleva a 0: un Pago solo aumenta el Total Pagado, una cortesia reduce el Total Cobrable y empeora el Saldo, y los reembolsos estan "explicitamente pendientes" (BR-REP-014).
- **Ejemplo reproducible:** (a) el cliente deja una sena de $5.000 al ingreso; la revision tecnica no define reparacion (`068 [No] -> 069`, SIN_REPARACION, Subtotal = 0, BR-REP-010); `250 [Si] -> 260 -> 265`: Saldo = 0 - 5.000. (b) DET-001 $10.000 y DET-002 $5.000, sena $12.000; el cliente rechaza DET-002 (`047 -> 300`) y DET-001 se completa: Total Cobrable $10.000, Saldo = -2.000.
- **Resultado esperado:** una salida definida para Saldo < 0 (aplicacion, reembolso o devolucion con constancia), o un gate "Saldo <= 0 con liquidacion registrada".
- **Resultado actual:** `265 [No] -> 266 -> 265 [Revalidar]` sin forma de cumplir la condicion; `280` y `270` no se alcanzan; el equipo no puede entregarse.
- **Impacto operativo:** el equipo queda retenido y la Orden en un ciclo sin fin; en el ejemplo (a) afecta a todo ingreso con sena que termina sin reparacion.
- **Correccion minima propuesta:** definir en BR-REP-017/PROC-REP-265 el tratamiento del Saldo negativo (incluido SIN_REPARACION y cancelacion parcial) como capacidad transversal analoga a Registrar Pago, sin tocar el resto del cierre.
- **Clasificacion:** requiere decision de negocio (politica de saldo a favor); la inconsistencia es demostrable en el modelo actual (condicion de entrega insatisfacible), por eso no se trata como mera decision comercial pendiente.

**Estado actual: RESUELTO** (correccion aplicada sobre el borrador V1.4, sin commit). Los puntos anteriores describen el hallazgo tal como fue auditado.

- **Decision de negocio aprobada:** si la OR tiene dinero a favor del cliente, es obligatorio registrar la devolucion de dinero antes de permitir la entrega o el cierre comercial; haber identificado el saldo a favor no habilita ninguna de las dos cosas. Formula: `Saldo = Total final de la OR - Pagos recibidos + Devoluciones realizadas`. Saldo > 0: cobro pendiente (circuito existente); Saldo = 0: continua; Saldo < 0: devolucion de dinero (parcial: el remanente sigue pendiente; total: Saldo = 0 y se revalida la entrega).
- **Correccion aplicada (minima):** `PROC-REP-265` pasa a tres salidas excluyentes ("Si"; "No, saldo pendiente de cobro" -> `266`; "No, saldo a favor del cliente" -> `267`), de modo que el circuito de cobro solo atiende Saldo > 0. Nodo nuevo `PROC-REP-267` (ACT-RECEP, FEAT-REP-007): registra la devolucion como movimiento distinto del Pago (id unico, OR, importe positivo, medio, usuario, fecha/hora, referencia y motivo), con historial completo, sin pago negativo, sin modificar los pagos originales, sin sobredevolucion ni doble imputacion. Nodo nuevo `PROC-REP-268` (decision, FEAT-REP-008): verificacion previa al fin y **unica** entrada a `EVT-REP-999`; las salidas `270 -> EVT-REP-999`, `211/306/271 [Sin equipo bajo custodia] -> EVT-REP-999` ahora pasan por `268`. `267` rotula su salida por contexto ("validar entrega" -> `265`; "validar fin de Orden" -> `268`), el mismo idioma que `270`.
- **Nodos y reglas afectados:** nodos `265`, `266`, `280`, `270`, `211`, `271` (texto o aristas), `267` y `268` (nuevos); `069` queda **sin cambios** (su ruta `069 -> 250 -> 260 -> 265` ya alcanzaba la validacion). Reglas: BR-REP-038 (nueva: formula, registro minimo, historial, casos, origenes sin circuito comercial, pendientes), BR-REP-017 (parrafo V1.4 con la formula y el tratamiento de Saldo < 0, texto V1.3 conservado), BR-REP-033 y BR-REP-034 (el fin pasa por `268`); BR-REP-014 conserva su texto V1.3 congelado y BR-REP-038 documenta su relacion. Features: FEAT-REP-007 (posee `267`, declara BR-REP-038) y FEAT-REP-008 (posee `268`, declara BR-REP-038). El modelo pasa de 70 a 72 nodos, de 130 a 135 aristas, de 37 a 38 reglas y de 37 a 43 Scenarios.
- **Escenarios que lo demuestran:** VAR-REP-030 (BLOCKER: revision SIN_REPARACION con anticipo de $5.000, Saldo -5.000, la entrega queda bloqueada, devolucion de $5.000, Saldo 0, devolucion fisica y fin); VAR-REP-031 (varios Detalles COMPLETO y CANCELADO, solo se devuelve el excedente en dos devoluciones parciales, rechazo de sobredevolucion y de reingreso); VAR-REP-032 (cancelacion con anticipo y equipo en custodia: la devolucion fisica no sustituye a la de dinero); VAR-REP-033 (desistimiento con sena y sin equipo); VAR-REP-034 (saldo cero sin devolucion); VAR-REP-035 (origen sin circuito comercial: sin cobros ni devoluciones). HP-REP-001 conserva el cobro de Saldo > 0.
- **Resultado de la validacion:** `npm run validate`, `validate:v1.3` (128 verificaciones) y `validate:v1.4` (268 verificaciones, incluida la nueva `scripts/test-commercial-closure.ts`) pasan; `generate:v1.4` y `generate:cliente-externo:v1.4` regeneran los artefactos con los generadores oficiales y el visor de Cliente Externo renderiza los 67 nodos de su vista (incluidos `267` y `268`); `npx tsc --noEmit` y `git diff --check` sin errores; V1.2/V1.3 intactos. La prueba nueva comprueba que ningun camino llega al fin sin pasar por `268`, que `265` tiene tres salidas excluyentes, que todo ciclo entre `265/266/267/268` exige un pago o una devolucion real (sin ciclos vacios), que las cancelaciones nunca alcanzan la entrega comercial y reproduce los Scenarios con dinero recalculando el Saldo paso a paso con la formula aprobada; se verifico que falla ante dos mutaciones del grafo.
- **Riesgos residuales (decisiones de negocio y limites, no bloquean la salida):** (1) quien puede registrar devoluciones y el catalogo de medios de devolucion siguen pendientes (hoy el nodo `267` es de Recepcion); (2) plazo o abandono si el cliente no retira el dinero: la Orden permanece en `267` hasta que se registre una devolucion real, sin salida automatica; (3) devoluciones posteriores a ENTREGADA; (4) un saldo a favor en origenes sin circuito comercial no esta definido (documentado como pendiente funcional; `268` siempre responde "sin saldo a favor"); (5) una cortesia total sobre una Orden con pagos recibidos deja Saldo < 0 y se devuelve, consecuencia directa de la formula aprobada que conviene confirmar con negocio; (6) con un grafo de un solo token, la alcanzabilidad topologica pura cruza los contextos de `267` (los tests usan un recorrido que respeta la salida rotulada); (7) un pago o devolucion registrado entre `280` y `268` lo detecta la verificacion previa al fin, pero el comprobante final no se regenera (no modelado); (8) el modelo es documental: la formula se verifica con un oracle de pruebas, no con codigo de producto.

### AUD-V14-002 - HIGH - "Sin respuesta" del cliente con la Orden sin Detalles lleva al resolver a un estado sin salida (RESUELTO)

- **Proceso / Feature:** FEAT-REP-002 (autorizacion) y FEAT-REP-003/009 (resolver).
- **Nodos / reglas / escenarios:** `PROC-REP-055 -> 046 -> 047`, arista `047 -> 211 [Sin respuesta del cliente, Detalles siguen pendientes]`, `PROC-REP-211`; BR-REP-013 (SIN_DETALLES), BR-REP-037; VAR-REP-001/004/007 (consulta de aceptacion de la revision), VAR-REP-027.
- **Descripcion:** `047` es compartido por la consulta de aceptacion de la revision tecnica (Orden EN_REVISION, `cantidad_detalles = 0`) y por la autorizacion de Detalles. La nueva salida "Sin respuesta" va a `211`, pero BR-REP-013 establece que el resolver "nunca llega a invocarse mientras cantidad_detalles = 0" y `211` no tiene salida para SIN_DETALLES (sus aristas: 270, 271, 999, 220, 212, 170, 129, 120, 125, 190, 050, 080).
- **Ejemplo reproducible:** Recepcion consulta si el cliente acepta ingresar el equipo para diagnostico (`055 -> 046`), sin respuesta: `047 -> 211` con cero Detalles.
- **Resultado esperado:** una espera propia de la consulta de revision (analoga a `129`) o una salida valida; el resolver no se invoca con cero Detalles.
- **Resultado actual:** el recorrido existe en el grafo y el resolver devuelve el caso defensivo SIN_DETALLES, para el que no hay arista.
- **Impacto operativo:** Orden huerfana en REQUERIMIENTO/EN_REVISION; el equipo todavia no fue recibido (el comprobante se emite despues de la decision), pero la Orden no tiene siguiente paso definido ni forma de reintentar.
- **Correccion minima propuesta:** acotar la salida a la existencia de Detalles pendientes o agregar el reintento de la consulta de revision; es una correccion de grafo/documentacion sin regla nueva (el plazo de espera sigue como decision pendiente).
- **Clasificacion:** corregible documentalmente.

**Estado actual: RESUELTO** (iteracion 10, "simplificacion de PROC-REP-045 y PROC-REP-047"; borrador V1.4 sin commit). Los puntos anteriores describen el hallazgo tal como fue auditado.

- **Correccion aplicada:** una Orden sin Detalles ya NO consulta al cliente por Detalle. `PROC-REP-055` (CLIENTE_EXTERNO) pasa a `PROC-REP-056` (nodo nuevo, ACT-RECEP), que solo registra si el cliente continua con la revision tecnica ("Acepta la revision tecnica" -> `050`) o desiste ("Desiste sin Detalles" -> `306`, via propia de esa etapa, separada de la autorizacion por Detalle). La OR espera la revision y el diagnostico de RT (`060/065/068/075`) y recien con los Detalles definidos Recepcion consulta al cliente (`046/047`). Ademas `PROC-REP-047` perdio "Sin respuesta del cliente": la falta de respuesta es ahora `046 -> 211 [Solicitud sin resolver, Detalles siguen pendientes de autorizacion]`, una arista que solo existe con Detalles, sin decision ficticia en 047.
- **Nodos, aristas y reglas afectados:** nodos `055` (arista), `056` (nuevo), `046`, `047`, `050`, `045`, `070`, `211` y `306` (texto o aristas); `055 -> 046`, `047 -> 306` y `047 -> 211 [Sin respuesta]` eliminadas; BR-REP-027, BR-REP-028, BR-REP-030, BR-REP-031, BR-REP-034 y BR-REP-037 actualizadas (ninguna regla nueva); FEAT-REP-002 posee `056` y FEAT-REP-009 conserva `306`.
- **Demostrado por:** VAR-REP-001 (sin Detalles: `045 -> 055 -> 056 -> 050 -> 060 -> 065 -> 068 -> 075 -> 046 -> 047 -> 211 -> 080`, la consulta por Detalle recien despues de `075`), VAR-REP-004 (`055 -> 056 -> 306`) y VAR-REP-027 (sin respuesta: `211 -> 129 -> 046 -> 211`, sin pasar por 047); `scripts/test-customer-decision.ts` comprueba que desde `056`, sin Detalles, no se alcanzan `046/047/129/090/211` y que `046` solo se invoca desde `070/075/127/129/EVT-REP-003`.
- **Riesgos residuales:** plazo y escalacion si el cliente no decide en `056` o no responde en `046` (decision de negocio pendiente); el canal de consentimiento sigue pendiente.

### AUD-V14-003 - HIGH - Autorizacion parcial en una misma consulta: los Detalles autorizados no pasan por factibilidad en una Orden ya habilitada (RESUELTO)

- **Proceso / Feature:** FEAT-REP-002 y FEAT-REP-003.
- **Nodos / reglas / escenarios:** `PROC-REP-047`, `300`, `211`, `080`, `090`; BR-REP-028, BR-REP-032, BR-REP-034, BR-REP-037 (condicion 5); VAR-REP-005 y VAR-REP-013 (parcial antes de habilitar), VAR-REP-011 (solo rechazo).
- **Descripcion:** `047` emite un unico resultado por consulta: "Acepta ..." (todo) o "Rechaza algunos Detalles" (solo `-> 300`). El texto de `047` dice que los demas "se conservan", pero no hay arista que lleve a los autorizados a `080`. Antes de habilitar la Orden `211` los reencamina (`211 -> 080 [Comprobante emitido, factibilidad pendiente]`, VAR-REP-013); con la Orden ya habilitada `211` no tiene esa salida y el Detalle autorizado nunca recibe su evaluacion de factibilidad.
- **Ejemplo reproducible:** OR habilitada con adicionales DET-002 y DET-003 pendientes; el cliente autoriza DET-002 y rechaza DET-003 en la misma consulta: `047 -> 300 -> 211`. DET-002 no tiene BLOQUEADO_POR_RECURSOS porque `080` no corrio, el resolver lo considera trabajable y se selecciona; la falta de stock recien aparece al reservar (`185 -> 186`).
- **Resultado esperado:** BR-REP-032 y BR-REP-028: "si se autoriza, pasa por factibilidad (PROC-REP-080) antes de ser ejecutable".
- **Resultado actual:** la factibilidad se sustituye por el intento de reserva; no se emite la advertencia de faltante ni se ofrece el override en su circuito natural.
- **Impacto operativo:** puede iniciarse (o fallar al iniciar) una ejecucion sobre un Detalle cuya factibilidad nunca se evaluo; el README lo documenta como "se evalua al reseleccionarlos", lo que contradice la regla citada.
- **Correccion minima propuesta:** representar el resultado mixto (autoriza unos y rechaza otros) con ambas salidas (`300` y `080`) o agregar la salida "Orden ya habilitada, factibilidad pendiente" en `211`.
- **Variante del mismo hueco:** autoriza unos Detalles y deja otros sin respuesta en la misma consulta (tampoco hay salida de `047`); dos adicionales (VAR-REP-022) resueltos luego con decisiones distintas no tienen recorrido que los resuelva.
- **Clasificacion:** corregible documentalmente (sin regla nueva); el README actual formula el hueco como comportamiento aceptado, por lo que conviene confirmarlo con negocio.

**Estado actual: RESUELTO** para las rutas de la decision del cliente (iteracion 10; borrador V1.4 sin commit). Los puntos anteriores describen el hallazgo tal como fue auditado.

- **Correccion aplicada:** `PROC-REP-047` tiene tres decisiones y las tres vuelven a `PROC-REP-211` (`047 -> 211`, `047 -> 300 -> 211`, `047 -> 305 -> 211`). La salida `211 -> 080 [Comprobante emitido, factibilidad pendiente]` aplica ahora tambien con la Orden YA habilitada y se evalua antes de las salidas por estado (`080` solo consulta disponibilidad: no reserva, no interrumpe la Ejecucion vigente ni libera la toma, y vuelve a `211` por `090 [Orden ya habilitada]`). Asi un Detalle autorizado en una autorizacion parcial o diferida nunca omite su factibilidad, la factibilidad sigue siendo del sistema y no una decision de Recepcion o del cliente.
- **Nodos, aristas y reglas afectados:** `211` (texto), `047` y `046` (aristas), BR-REP-034 (enrutamiento interno y precedencia de la salida), BR-REP-028 y BR-REP-037; BR-REP-012 (resolver) no cambia.
- **Demostrado por:** VAR-REP-036 (nuevo: `047 [Rechaza algunos] -> 300 -> 211 -> 080 -> 090 -> 211 -> 190`, con DET-002 autorizado y DET-003 rechazado en una OR habilitada y DET-001 en ejecucion), VAR-REP-010/012/008 (`047 -> 211 -> 080`) y `scripts/test-customer-decision.ts`.
- **Variantes del mismo hueco:** "autoriza unos y deja otros sin respuesta en la misma consulta" se registra como "Acepta trabajos" para los Detalles respondidos, y los demas siguen PENDIENTE_AUTORIZACION sin bloquear (a confirmar con negocio); varias altas resueltas luego con decisiones distintas se registran por Detalle (046/047 es por Detalle y definicion vigente).
- **Riesgos residuales:** la precedencia de la salida "factibilidad pendiente" frente a las salidas por estado esta documentada (BR-REP-034, `211`) pero el modelo no calcula el estado; si negocio prefiere un nodo de enrutamiento dedicado en lugar de reutilizar `211`, es un cambio de grafo acotado.

### AUD-V14-004 - HIGH - BR-REP-014 prohibe cancelar con una Ejecucion activa; el carril de Recepcion y VAR-REP-011 lo hacen

- **Proceso / Feature:** FEAT-REP-009 y FEAT-REP-002.
- **Nodos / reglas / escenarios:** `PROC-REP-300`, `305`, `047`, `EVT-REP-003`; BR-REP-014, BR-REP-030, BR-REP-037; VAR-REP-011 (caso G aprobado), VAR-REP-009.
- **Descripcion:** BR-REP-014 dice que la cancelacion "de un Detalle o de los Detalles no terminales de una Orden no puede ejecutarse mientras exista una Ejecucion activa"; `PROC-REP-305` repite la prohibicion a nivel Orden, mientras que `PROC-REP-300` la formula "sin Ejecucion activa sobre ese Detalle" y BR-REP-014 cierra con "solo puede cancelarse estando PENDIENTE y sin Ejecucion activa (nunca EN_PROCESO)". Hay dos lecturas (por Detalle / por Orden). VAR-REP-011 y la regla de independencia aprobada exigen la primera; `047 [Rechaza todos los trabajos pendientes] -> 305` solo es coherente con la primera si ademas se resuelve el caso "desistir de todo con la Ejecucion activa".
- **Ejemplo reproducible:** DET-001 EN_PROCESO; el cliente rechaza el adicional DET-002 (VAR-REP-011): `EVT-REP-003 -> 046 -> 047 -> 300 -> 211 -> 190`. Variante: el cliente desiste de todo mientras DET-001 se ejecuta: `047 -> 305` (cancelacion de la Orden con Ejecucion activa).
- **Resultado esperado:** una sola lectura inequivoca y, para `305`, una regla de que ocurre con la Ejecucion en curso (interrumpirla antes, o excluir ese Detalle).
- **Resultado actual:** el texto literal de BR-REP-014 contradice VAR-REP-011; `305` no tiene mecanismo para interrumpir la Ejecucion y el carril independiente no avisa al tecnico.
- **Impacto operativo:** implementaciones distintas bloquearian o permitirian el rechazo; en el desistimiento total el trabajo en curso sigue sin que nadie lo detenga.
- **Correccion minima propuesta:** aclarar BR-REP-014 (precondicion por Detalle, sin tocar la regla comercial) y definir el tratamiento del desistimiento total con Ejecucion activa.
- **Clasificacion:** la aclaracion es documental; el desistimiento total con Ejecucion activa requiere decision de negocio (ya figura como pendiente en el README).

### AUD-V14-005 - MEDIUM - La solicitud de autorizacion no esta ligada a la version de la definicion ni a cancelaciones concurrentes

- **Nodos / reglas / escenarios:** `PROC-REP-128`, `127`, `046/047`, `EVT-REP-003`; BR-REP-028, BR-REP-029, BR-REP-036, BR-REP-037; VAR-REP-019, VAR-REP-025, VAR-REP-020.
- **Descripcion:** BR-REP-029 dice que la autorizacion se evalua sobre la "definicion vigente" y que una redefinicion la invalida; pero al separar la creacion de la solicitud de su resolucion (BR-REP-037) pueden coexistir una consulta en curso sobre la version v1 y una redefinicion tecnica a v2. Ninguna regla indica que la solicitud queda ligada a la version con que se creo, que una decision registrada sobre una version reemplazada no vale, ni que ocurre con una consulta en curso cuando el Detalle se cancela por descarte tecnico.
- **Ejemplo reproducible:** DET-002 PENDIENTE_AUTORIZACION (v1); Recepcion consulta al cliente por v1; el tecnico redefine DET-002 a v2 (`183 [REQUIERE_REDEFINICION] -> 127`); Recepcion registra "AUTORIZA" despues.
- **Resultado esperado:** la decision de v1 no habilita v2 y la consulta se rehace.
- **Resultado actual:** deducible de BR-REP-029 pero no explicito; el grafo no tiene un estado de consulta en curso.
- **Impacto operativo:** riesgo de ejecutar una definicion nunca autorizada si la implementacion registra la decision sobre el Detalle y no sobre la version.
- **Correccion minima propuesta:** explicitar en BR-REP-029/037 que la solicitud y la decision referencian la version evaluada y que una decision sobre una version no vigente se descarta.
- **Clasificacion:** documental (consecuencia de reglas ya aprobadas); el modelo tecnico de versiones sigue como decision posterior.

### AUD-V14-006 - MEDIUM - La confirmacion de custodia fisica no tiene nodo, actor ni momento

- **Nodos / reglas / escenarios:** `PROC-REP-060`, `211`, `306`, `271`, `270`; BR-REP-031, BR-REP-033; HP-REP-001 (no la exhibe), VAR-REP-004/006/007/015/018.
- **Descripcion:** la custodia "se confirma" cuando el comprobante se entrega y el equipo se recibe, pero se modelo como un registro de `060` (nodo del Sistema) sin actor que confirme ni punto del proceso. Las condiciones de `211` y `306` ("equipo bajo custodia", "sin equipo bajo custodia", "custodia sin confirmar") dependen de un dato cuyo productor no esta definido. HP-REP-001 pasa por `060` pero no muestra la confirmacion del intercambio fisico.
- **Resultado esperado:** quien y cuando confirma (o descarta) la recepcion fisica, con usuario, fecha/hora y referencia (BR-REP-033).
- **Resultado actual:** el resolver puede quedar siempre en "custodia sin confirmar" si nadie registra la confirmacion; solo `271` la regulariza al cancelar.
- **Impacto operativo:** cancelaciones que pasan por `271` innecesariamente; ambiguedad sobre responsabilidad del ingreso fisico.
- **Correccion minima propuesta:** documentar actor y momento de la confirmacion como parte de `060` o de `270`/Recepcion sin agregar estados.
- **Clasificacion:** requiere decision de negocio (quien confirma).

### AUD-V14-007 - MEDIUM - Trazabilidad Feature <-> nodo <-> regla incompleta

- **Evidencia (script sobre el modelo):** BR-REP-007 (una sola Ejecucion activa por Orden) y BR-REP-016 estan declaradas por Features pero ningun nodo las cita (`190` y `185` no referencian BR-REP-007); BR-REP-007 y BR-REP-011 no son citadas por ningun Scenario; 22 nodos funcionales no tienen reglas (entre ellos `140`, `150`, `170`, `174`, `190`, `250`); BR-REP-032 la citan nodos de FEAT-REP-005 sin que FEAT-REP-005 la declare. Trece reglas no figuran en `rules[]` de ningun Scenario (los Happy Paths no declaran `rules[]`, por lo que parte de esa ausencia es del formato).
- **Impacto:** el generador emite dos advertencias (FEAT-REP-005/BR-REP-007, FEAT-REP-007/BR-REP-016) que ningun validador convierte en error; la invariante del Caso E ("no se inicia una segunda ejecucion") queda sin ancla en un nodo.
- Los Scenarios que esperan `active_take_and_priority_kept` o `second_simultaneous_execution_started = false` (VAR-REP-010, 020, 022, 023, 025) no citan BR-REP-018 ni BR-REP-007, y ningun test V1.4 lee BR-REP-018.
- **Correccion minima propuesta:** citar BR-REP-007 en `185/190` y revisar las reglas de los nodos sin reglas.
- **Clasificacion:** documental.

### AUD-V14-008 - MEDIUM - Los tests comprueban en gran medida prosa, no comportamiento

- **Evidencia (clasificacion heuristica del bloque V1.4 de `scripts/test-scenarios.ts`, 51 tests y unas 600 aserciones):** cerca del 43 % son expresiones regulares sobre descripciones de nodos y reglas (240 `assert.match`); un 16 % son estructurales sobre el grafo; un 15 % comprueban el orden de los pasos de un Scenario; un 21 % comparan `facts/expected` del YAML con un literal escrito en el test (circular: no toca el grafo ni las reglas); 10 de los 51 tests no tienen ninguna aserción de grafo o de pasos y 6 son 100 % regex. De 250 entradas `expected` de los Scenarios, 77 no son nombradas por ningun test. No existe un modelo ejecutable del resolver ni de las propiedades derivadas.
- **Invariantes verificadas solo por texto (pasarian con un grafo equivocado):** la precedencia del resolver (5 > 6 > 7), el conjunto de bloqueos y los casos A a L de BR-REP-012; que la toma solo se cierra cuando no hay Detalles trabajables y una consulta pendiente no la libera; que un Detalle PENDIENTE_AUTORIZACION nunca es ejecutable (los puntos de entrada `070/055/075` se comprueban con `includes`, de modo que una arista extra que evite `046/047` no fallaria); la semantica de custodia de BR-REP-033; la aplicacion inmediata e idempotente del resultado de `183`; la revalidacion de BR-REP-029; que control final, cobro y entrega no se adelantan (solo se verifica que `220` tenga una unica entrada); y la ejecucion unica (el grafo es de un solo token y solo la respalda una igualdad circular).
- **Sin test alguno:** BR-REP-003 (override: vigencia tras `127`, stock negativo, ACT-COORD, factibilidad parcial; solo se comprueba que EXC-REP-002 cite la regla), BR-REP-007 y BR-REP-018.
- **Tests debiles:** el de `applies_to` acepta cualquier Happy Path (deja pasar VAR-REP-023); el titulo de un test dice "cinco entradas (...128)" y otro comprueba lo contrario; la regex de BR-REP-029 pasa aunque la regla conserve la clausula obsoleta `182 -> 127`; las exclusiones de mecanismo y de SIN_REPARACION congelan aristas que ningun Scenario puede recorrer.
- **Impacto:** los tests pasan aunque el grafo contradiga la regla; cualquier cambio de redaccion los rompe sin que cambie el comportamiento.
- **Correccion minima propuesta:** agregar un modelo de referencia ejecutable del resolver (tabla de decision) y tests de propiedades por Detalle; el resto puede mantenerse como verificacion documental.
- **Clasificacion:** tecnico/documental.

### AUD-V14-009 - MEDIUM - Recorridos legitimos de Cliente Externo sin Scenario

- **Evidencia (aristas no recorridas por ningun Scenario):** `068 [No] -> 069 -> 250` (SIN_REPARACION), `172` sesion/estacion invalida, `174 [No] -> 176 -> 178 -> 179 -> 185` (override de estacion), `212 [Si]/[No] -> 181/213` (continuar/liberar y cambio de tecnico), `200 [Requiere redefinicion] -> 210`, `271 -> fin`, `306 -> 270/271`, `170 -> 300/305`. No hay escenario para anticipos, cancelacion con pagos, autorizacion mixta, dos adicionales con decisiones distintas, ni todas las causas de bloqueo a la vez (REQUIERE_REVISION + PENDIENTE_AUTORIZACION + PENDIENTE_RECURSOS solo se verifica como regla). Los nodos `025`, `069`, `176`, `178`, `179`, `212`, `213` no son recorridos por ningun Scenario.
- Exclusiones deliberadas por tests (no son omisiones): los tests impiden que un VARIANT/EXCEPTION recorra `069` (CAND-REP-010/017 pendientes), el mecanismo `211 -> 212/170` y `212 -> 181/213`, y cualquier mencion de RT_GARANTIA_VENTA. Consecuencia: el lazo de retrabajo (`235 -> 211 -> 170 -> 172 -> 180`) y la devolucion a la cola de EXC-REP-005 no pueden recorrerse en un Scenario.
- El override de factibilidad (BR-REP-003) esta declarado como capacidad transversal pero solo se dibuja el circuito `100 -> 110 -> 130 -> 140`; las claves `expected` de EXC-REP-002 que describen el override con factibilidad parcial no tienen camino ni test. Para un Detalle agregado o autorizado despues de la primera habilitacion `090 -> 211` no pasa por `100/110`: no se emite la advertencia de faltante.
- **Impacto:** los casos AUD-V14-001, 002 y 003 pasaron inadvertidos precisamente porque no tienen Scenario.
- **Correccion minima propuesta:** agregar los Scenarios que correspondan una vez decididas las correcciones; los mecanismos de cola/estacion pueden seguir como mecanismos documentados.
- **Clasificacion:** documental.

### AUD-V14-010 - MEDIUM - Reglas congeladas con texto desactualizado respecto de V1.4

- **Evidencia:** los tests exigen que BR-REP-001 a 019 sean identicas a V1.3 (salvo 012 y 019). Consecuencias: BR-REP-018 enumera las causas de cierre automatico de la toma sin PENDIENTE_AUTORIZACION (V1.4 la cierra en ese caso, segun `129`, `211` y BR-REP-034/037); BR-REP-003 dice "Recepcion vuelve a elegir el mismo Tipo" en `127`, ahora a cargo del tecnico; BR-REP-014 se contradice con AUD-V14-004.
- **Impacto:** un implementador que lea solo la regla obtiene una conducta distinta a la del proceso.
- **Correccion minima propuesta:** permitir la actualizacion documental de esas reglas en V1.4 (ajustando el test de identidad) o dejar una nota de precedencia explicita.
- **Clasificacion:** documental.

### AUD-V14-011 - MEDIUM - Un Detalle que requiere revision solo se revisa cuando ningun otro Detalle es trabajable

- **Nodos / reglas / escenarios:** `PROC-REP-211 -> 125 -> 126 -> 127`; BR-REP-012 (REQUIERE_REVISION con precedencia 5), VAR-REP-029, EXC-REP-004.
- **Descripcion:** la revision tecnica puntual (`126`) solo se alcanza desde `125`, y `125` solo cuando no queda ningun Detalle trabajable. La independencia aprobada garantiza que el Detalle ejecutable no espera al que requiere revision, pero el inverso queda ordenado: el Detalle que requiere redefinicion no avanza hasta que los demas terminen o se bloqueen.
- **Impacto:** el tiempo de resolucion de un trabajo depende del resto; si ademas hay un Detalle pendiente de autorizacion, el orden de espera no esta definido.
- **Clasificacion:** decision pendiente de negocio (no contradice la regla aprobada); se registra como observacion.

### AUD-V14-012 - LOW - Texto desactualizado dentro del propio YAML

- `PROC-REP-046` lista `PROC-REP-128` y `PROC-REP-184` como puntos de entrada a `046` y habla de "cuatro puntos"; ninguna arista de 128/184 llega a 046 y las entradas reales son seis (070, 055, 075, 127, 129, EVT-REP-003).
- `PROC-REP-211` conserva "Todos cancelados, equipo recibido" en su descripcion; la condicion actual es "equipo bajo custodia".
- BR-REP-037 afirma que "ninguna arista del hilo tecnico pasa obligatoriamente por 046/047"; es cierto para el hilo tecnico estricto (`181 -> ... -> 211`), pero `075 -> 046` (tecnico) y `127 -> 046 [Redefinicion posterior a una Ejecucion]` si pasan por la consulta. La frase debe acotarse.
- BR-REP-029 mantiene el pendiente "que ocurre si el cliente posterga su decision", ya modelado con `047 -> 211 [Sin respuesta ...]`.
- BR-REP-029 conserva la clausula "(PROC-REP-182 -> PROC-REP-127 ...)": `182` solo tiene las salidas `174` y `183`; la redefinicion tecnica sale de `183`.
- La descripcion de `PROC-REP-211` y VAR-REP-005 siguen nombrando las salidas "Orden sin habilitar"; las condiciones reales son "Antes del comprobante de recepcion" y "Comprobante emitido, factibilidad pendiente". La cabecera de `business-rules-v1.4.yaml` dice que V1.4 "SOLO agrega BR-REP-020 a BR-REP-034" (existen 035-037 y BR-REP-019 difiere de V1.3) y la de `repair-management-scenarios-v1.4.yaml` lista hasta VAR-REP-014 y afirma que los demas son identicos a V1.3 (hay 15 Scenarios nuevos mas).
- La cabecera de `repair-management-scenarios-v1.4.yaml` (lineas 22-31) sigue describiendo la iteracion de autorizacion: "comprobante entregado = equipo recibido" y VAR-REP-010/011 como "el tecnico agrega un Detalle y el cliente lo autoriza/rechaza"; hoy la custodia exige confirmacion del intercambio y esos Scenarios son la gestion de Recepcion por `EVT-REP-003` (el alta es VAR-REP-026).

### AUD-V14-013 - LOW - README: documentacion historica presentada como vigente

El README contiene afirmaciones de iteraciones anteriores sin etiqueta de obsoletas. Las mas relevantes (numeros de linea del README actual): L1729-1739 y L1760-1763 (seccion "Pendientes", describen el desvio `211 -> 212 -> 181` y la ambiguedad de `090`, ya resueltos); L1243-1245 (describe `306 -> fin [Equipo no recibido]`, arista que no existe; hoy son tres salidas); L1206-1215 (tabla "cuatro puntos", fila `127 -> 046` de la iteracion 1); L1458 (afirma que no hay nodos ni aristas nuevos de custodia, contradicho por `271` en la misma seccion); L1773-1774 (`FEAT-REP-002: estados PENDIENTE/CONFIRMADA/DESCARTADA no definidos`, ya modelados como evaluacion en `182/183/184`); L1280-1281, L1476 y L1482-1485 (VAR-REP-010/011 descritos con el alta `128`, que ahora esta en VAR-REP-026); L1299 y L1399 (encabezados "iteracion 4/5" sobre contenido de la iteracion 9). El texto previo a la seccion V1.4 describe V1.3 con encabezado correcto.

### AUD-V14-014 - LOW - Bifurcaciones por origen que el modelo no codifica

`PROC-REP-050` ("No - Detalles definidos", "No - aun en revision"), `PROC-REP-250` ("No") y `PROC-REP-045` ("Si"/"No") dependen del origen pero sus condiciones no lo nombran; la regla de que toda garantia RMA pasa por revision (BR-REP-019, "ya no existe 045 Si -> 070") tampoco esta forzada por el grafo (`040 [RMA_GARANTIA_REPARACION] -> 045 -> 070` existe). El viewer por origen debio apoyarse en evidencia de Scenarios para excluirlas (lista en el panel "Proceso" del viewer). RT_GARANTIA_VENTA (`025`) no tiene ningun Scenario, conforme al alcance MVP v2.

### AUD-V14-015 - LOW - Responsabilidades a confirmar frente a la matriz aprobada

`PROC-REP-069` (SIN_REPARACION, conclusion tecnica de la revision) lo registra ACT-RECEP mientras `075` (definicion tras la misma revision) paso a ACT-TECH; `PROC-REP-220` (control tecnico) esta a cargo de ACT-RECEP por BR-REP-008. Son coherentes con las reglas vigentes, pero la matriz aprobada no las menciona. Los nodos `300`, `305` y `306` no tienen actor por decision documentada (quien puede cancelar sigue pendiente).

### AUD-V14-016 - LOW - Elementos sin trazabilidad o con etiqueta imprecisa

`EVT-REP-003` (y los demas eventos) no pertenecen a ninguna Feature ni cita reglas en el modelo; el unico enlace es textual (BR-REP-037). `EVT-REP-999` es el final comun de ENTREGADA, CANCELADA, SIN_REPARACION y la devolucion a Gestion RT, sin marcar el estado terminal. VAR-REP-023 declara `applies_to: HP-REP-001` aunque se titula "origen distinto de CLIENTE_EXTERNO". BR-REP-012 usa "ejecutable" y "trabajable" casi como sinonimos en los casos J/K/L, mientras que BR-REP-037 los distingue (elegible / habilitado / terminal). Los "Caso A-G" de los Scenarios (VAR-REP-011, 026, 028, 029) colisionan con las letras A-L de BR-REP-012 (por ejemplo "Caso B" nombra tres cosas distintas) y el resultado del resolver es un `fact` en VAR-REP-012/014 pero un `expected` en VAR-REP-010/014. VAR-REP-021 declara `applies_to: HP-REP-001` aunque su Detalle es REVISION_TECNICA (el HP-REP-001 lo evalua en `183`), y los 7 pasos de VAR-REP-016 coinciden con un tramo de HP-REP-001 (una variante sin divergencia).

### AUD-V14-017 - MEDIUM - Desistimiento durante la revision tecnica (equipo ya recibido, cero Detalles) sin recorrido; aristas de custodia de `306` inalcanzables

- **Nodos / reglas / escenarios:** `PROC-REP-306`, `047`, `055`, `060`, `065`, `068`, `069`; BR-REP-027, BR-REP-031, BR-REP-033; VAR-REP-004 (solo la rama `306 -> EVT-REP-999`).
- **Descripcion:** `306` solo se alcanza desde `047 [Desiste sin Detalles]`, y con cero Detalles `046` solo se entra desde `055`, antes del comprobante (`050/060`). Por BR-REP-031 y BR-REP-033 la custodia comienza con el comprobante entregado, de modo que en `306` el equipo nunca puede estar bajo custodia ni "sin confirmar": `306 -> 270` y `306 -> 271` no tienen recorrido. El caso real que esas aristas pretendian cubrir (el cliente desiste durante la revision tecnica, ya con el equipo en el taller y cero Detalles) no tiene ningun camino: desde `065/068` solo existe `068 [No] -> 069`.
- **Ejemplo reproducible:** `055 -> 046 -> 047 [Acepta] -> 050 -> 060 -> 065`; el cliente avisa que no quiere continuar. No hay arista de cancelacion.
- **Resultado esperado:** un punto de desistimiento durante la revision con la bifurcacion de custodia, o la eliminacion de las aristas inalcanzables.
- **Resultado actual:** el README lo registra como pendiente ("queda disponible si se agrega un punto de desistimiento durante la revision"), pero el test de V1.4 congela las aristas muertas.
- **Impacto operativo:** un recorrido legitimo de Cliente Externo queda sin resolucion y el documento sugiere una cobertura que no existe.
- **Correccion minima propuesta:** decidir si el desistimiento durante la revision se modela (reutilizando `306` y `271`) o si se retiran las aristas; sin regla nueva.
- **Clasificacion:** decision de negocio (hasta cuando puede desistir el cliente), con ajuste documental.

### AUD-V14-018 - MEDIUM - Scenarios sin prerrequisitos formales: las variantes no son combinables y varias expectativas no tienen camino

- **Evidencia (script sobre los Scenarios):** ningun Scenario usa el campo `dependencies`. VAR-REP-007 y 013 comienzan en `075 -> 046` y presuponen el ingreso de VAR-REP-001 (`045 [No] -> 055 -> 060 -> 065 -> 068 -> 075`), que su `applies_to` (HP-REP-001, con Detalles conocidos) no recorre; VAR-REP-008 y 009 comienzan en `211 -> 125` y necesitan una Ejecucion previa con `200 [Requiere redefinicion]`, que ningun Scenario recorre; VAR-REP-012/014/015/027/028/029 tambien comienzan a mitad de flujo. VAR-REP-023 declara `applies_to: HP-REP-001` siendo de otro origen. Algunas expectativas no tienen soporte en los pasos: VAR-REP-017 menciona el mecanismo `212` y `take_released = false`, VAR-REP-018 dice "uno por uno" y muestra solo el ultimo descarte, VAR-REP-019 espera la reevaluacion de factibilidad tras una autorizacion que su camino no recorre, y VAR-REP-005 espera "comprobante solo con los autorizados" sin pasar por `060`. VAR-REP-001 describe un recorrido que ya incluye `046/047` sin nombrarlos ni citar BR-REP-028/031.
- **Impacto:** la combinacion de variantes (por ejemplo AUD-V14-003 o 005) no se puede ejecutar ni verificar, y un lector no distingue lo recorrido de lo supuesto.
- **Correccion minima propuesta:** declarar `dependencies` entre Scenarios, corregir los `applies_to` y mover a prosa (o retirar) las expectativas sin camino.
- **Clasificacion:** documental.

## Auditoria de los Happy Paths

| HP | Origen | Resultado |
|---|---|---|
| HP-REP-001 | CLIENTE_EXTERNO | 40 aristas y 1 accion funcional, continuas de `EVT-REP-001` a `EVT-REP-999`. Cubre identificacion, OR creada antes del diagnostico, diagnostico/fotos/observaciones (032), definicion preliminar (070), autorizacion (046/047), comprobante (050/060), factibilidad (080), primera habilitacion (090/140), prioridad (150), cola/toma (170/172/180), seleccion y confirmacion tecnica (181-184), estacion (174), reserva (185), ejecucion (190/200/210), control final (220/230), puntaje (245), listo (240), notificacion (260), pago final (FUNCTIONAL_ACTION) con revalidacion (265/266), comprobante final (280), entrega (270). Observaciones: la confirmacion de custodia fisica no es un paso (006); no se muestran anticipos ni saldo a favor (001). |
| HP-REP-002 | RT_INTERNO | 32 pasos continuos. No incorpora `046/047`, comprobante (`050 [No - Detalles definidos]`), `260`, `265/266`, `280` ni cobros: `250 [No] -> 290 -> 270` (devolucion a Gestion RT). Pasa por la evaluacion tecnica (`183`) porque `070` es diagnostico de Recepcion. El estado terminal de la Orden RT_INTERNO sigue pendiente (texto de `270`). |
| HP-REP-003 | RMA_GARANTIA_REPARACION | 34 pasos continuos. Vinculacion con la OR original (`EVT-REP-002 -> 035`), revision tecnica obligatoria (`045 [No] -> 055 -> 050 -> 060 -> 065 -> 068 -> 075`), `075` a cargo del tecnico, origen REVISION_TECNICA sin segunda confirmacion (`182 [No requiere ...]`), `265 [Si]` por NO_COBRABLE, comprobante final y devolucion. Observacion 014: `045 [Si]` sigue siendo alcanzable para RMA en el grafo. RT_GARANTIA_VENTA (`025`) existe en el grafo y no tiene Scenarios. |

## Independencia operativa (regla aprobada)

| Contexto | Resultado | Evidencia | Naturaleza de la limitacion |
|---|---|---|---|
| Alta durante la evaluacion | Cumple | `184 -> 182 -> 174 -> 185 -> 190`; VAR-REP-020/022 sin `046/047` | Si hay adicional de otro origen el original se retoma tras `080 -> 090 -> 211 -> 212 -> 181`: pasos del sistema y decision explicita del tecnico, sin espera del cliente (limitacion grafica) |
| Alta durante la ejecucion | Cumple | `128 -> 190 [Alta durante la ejecucion, CLIENTE_EXTERNO]`; VAR-REP-026 | - |
| Autorizacion diferida (EVT-REP-003) | Cumple en el hilo tecnico | `EVT-REP-003 -> 046 -> 047 -> 080 -> 090 -> 211 -> 190`; VAR-REP-010 | Un solo token; huecos del carril: AUD-V14-003, 004, 005 |
| Consulta sin respuesta | Cumple con Detalles; defecto con cero Detalles | VAR-REP-027; AUD-V14-002 | Dependencia funcional demostrada (002) |
| Redefinicion | Cumple | `183 -> 127 -> 184 -> 211`; VAR-REP-019/025; el Detalle redefinido queda pendiente de autorizacion y no bloquea a los demas | Riesgo de version (005) |
| Cancelacion parcial | Contradiccion textual | VAR-REP-011 vs BR-REP-014 | AUD-V14-004 |
| Insuficiencia de stock | Cumple | VAR-REP-028; override como capacidad transversal (BR-REP-003) | El grafo solo dibuja el override del circuito `100 -> 110 -> 130` |
| Revision pendiente | Cumple (el ejecutable no espera) | VAR-REP-029 | Orden inverso: AUD-V14-011 |
| Control final | Cumple | `220` solo desde `211 [Todos terminales, existe completo]`; VAR-REP-026/028/029 no alcanzan `220` | - |

## Consistencia de responsabilidades

Verificada contra la matriz aprobada: ACT-RECEP en `030/032/035/040/046/069/070/220/235/260/271`; ACT-TECH en `065/075/126/127/128/180/181/183/190/200/213`; ACT-SYSTEM en las validaciones y transiciones automaticas; ACT-COORD en `130/150/179`; ACT-ADMIN en `270`; decisiones sin actor. No se encontro ningun nodo, Feature ni regla vigente que haga registrar a Recepcion una redefinicion o un alta tecnica; los textos que aun lo dicen estan en reglas congeladas (AUD-V14-010). Observaciones de matriz: AUD-V14-015.

## Consistencia de estados y dimensiones

Las dimensiones se mantienen separadas en las reglas: estado de workflow de la OR (hitos, no segunda fuente de verdad), situacion tecnica agregada (BR-REP-012, solo derivada), estado operativo del Detalle (PENDIENTE, EN_PROCESO, COMPLETO, CANCELADO), bloqueos individuales (BLOQUEADO_POR_RECURSOS, REQUIERE_DEFINICION, PENDIENTE_AUTORIZACION derivado), confirmacion tecnica y autorizacion comercial por definicion, hito historico de habilitacion, toma, ejecucion activa, custodia y pago/entrega. Observaciones: `EN_REPARACION`, `HABILITADA`, etc. no figuran como efecto declarado de ningun nodo (solo texto); la custodia carece de actor de confirmacion (006); BR-REP-012 mezcla el vocabulario "ejecutable"/"trabajable" (016). La precedencia aprobada del resolver no fue modificada por ninguna regla posterior.

## Matriz de cobertura

**Happy Paths y variantes.**

| Tema | Cobertura |
|---|---|
| Ingreso con / sin diagnostico | HP-REP-001/002, VAR-REP-001/002 |
| Revision tecnica inicial y definicion posterior | HP-REP-003, VAR-REP-001, VAR-REP-007 |
| Confirmado / descartado / redefinido | VAR-REP-016, 017, 018, 019 |
| Adicionales 0..N | VAR-REP-020, 022, 023, 024, 025, 026 |
| Autorizacion parcial | VAR-REP-005, 013 (antes de habilitar). **Habilitada: sin cobertura (003)** |
| Cliente sin respuesta | VAR-REP-027. **Sin Detalles: sin cobertura (002)** |
| Varios Detalles con distinta situacion | VAR-REP-014, 026, 028, 029 |
| Recursos insuficientes / override / reserva fallida | EXC-REP-001, 002, 003, VAR-REP-028; override de estacion sin cobertura |
| Interrupcion de ejecucion | VAR-REP-003 |
| Cambio de tecnico / liberar la OR | **Sin cobertura (`212`, `213`)** |
| Cancelacion de uno o todos los Detalles | VAR-REP-004, 005, 006, 007, 009, 011, 013, 017, 018 |
| OR con cero Detalles | VAR-REP-004 (306) |
| Custodia sin confirmar / devolucion | VAR-REP-015, 007, 018; `271 -> fin` y `306 -> 270/271` sin cobertura |
| Rechazo de control y retrabajo | EXC-REP-005 |
| Pagos parciales y anticipos | HP-REP-001 (pago final y revalidacion); **anticipos y saldo a favor sin cobertura (001)** |
| SIN_REPARACION (`069`) | **Sin cobertura (excluida por un test)** |
| Desistimiento durante la revision tecnica (cero Detalles, equipo recibido) | **Sin recorrido (017)** |

**Excepciones:** EXC-REP-001 (recursos en espera), 002 (override), 003 (reserva fallida), 004 (revision posterior, otros origenes), 005 (rechazo de control).

**Casos limite pedidos (1-15).**

| # | Caso | Resultado |
|---|---|---|
| 1 | El unico Detalle se descarta y se agrega otro | VAR-REP-024; la Orden no finaliza |
| 2 | Un Detalle COMPLETO mientras otro espera autorizacion | VAR-REP-026; no hay control final |
| 3 | Un Detalle EN_PROCESO mientras Recepcion autoriza otro | VAR-REP-010 |
| 4 | Ningun Detalle disponible, varios motivos | VAR-REP-014 (dos causas) y BR-REP-012 caso I; tres causas solo como regla |
| 5 | Un Detalle de Recepcion intenta ejecutarse sin confirmacion | Imposible por grafo (`182` es la unica entrada a `174`); test estructural, sin Scenario |
| 6 | La definicion cambia despues de autorizada | VAR-REP-008, 019, 025; riesgo de version: AUD-V14-005 |
| 7 | Un adicional se rechaza mientras otro se ejecuta | VAR-REP-011; contradice BR-REP-014 (004) |
| 8 | Una OR cancelada conserva equipo bajo custodia | VAR-REP-007, 018 |
| 9 | La custodia permanece sin confirmar | VAR-REP-015 (regularizacion por `271`) |
| 10 | Ejecucion interrumpida con movimientos de inventario | VAR-REP-003 (`200 -> 210`) |
| 11 | Falla la reserva despues de superar factibilidad | EXC-REP-003 (`185 -> 186`) |
| 12 | Cancelar un Detalle con ejecucion activa | Contradiccion textual y desistimiento total sin mecanismo (004) |
| 13 | Un tecnico libera una OR con trabajos pendientes | `212/213` sin Scenario; prioridad conservada por `213 -> 170` |
| 14 | Se autoriza un trabajo adicional con la OR ya habilitada | VAR-REP-010 (hito `090 -> 211`); mixto: AUD-V14-003 |
| 15 | Todos terminales pero faltan obligaciones de entrega o pago | HP-REP-001 (`265/266`); saldo a favor sin salida (001) |
| 16 | Consulta sin respuesta con cero Detalles (surgido de la auditoria) | AUD-V14-002 |
| 17 | Ejecucion activa que nadie cierra (tecnico ausente) | Decision pendiente (ver abajo) |

**Reglas transversales:** BR-REP-012 (VAR-REP-014/026/028/029 y casos A-L solo en prosa), BR-REP-035 (VAR-REP-016/021, HP), BR-REP-036 (VAR-REP-017 a 025), BR-REP-037 (VAR-REP-010/011/020/022/026/027/028/029), BR-REP-033 (VAR-REP-004/006/007/015/018), BR-REP-034 (VAR-REP-010/013/019 y HP). Sin Scenario: BR-REP-007, 011, 016, 017 (solo accion en HP-REP-001), 009, 010.

## Pendientes funcionales (decisiones no tomadas, distintas de las inconsistencias demostradas)

1. Politica de saldo a favor / reembolsos y su relacion con cancelacion y SIN_REPARACION (origen de AUD-V14-001; BR-REP-014 la deja explicitamente pendiente).
2. Plazo y escalacion de una solicitud de autorizacion sin respuesta (hoy la Orden queda en `129` o con el Detalle pendiente sin limite).
3. Quien puede cancelar un Detalle o una Orden (`300`, `305`, `306` sin actor) y catalogo de motivos (incluido DIAGNOSTICO_DESCARTADO).
4. Desistimiento total del cliente con una Ejecucion activa (AUD-V14-004).
5. Quien confirma la recepcion fisica y cuando (AUD-V14-006); cuanto tiempo se mantiene en custodia un equipo de una Orden CANCELADA que nadie retira.
6. Estado terminal de la Orden RT_INTERNO y marca del estado final en `EVT-REP-999`.
7. Ejecucion activa que nadie cierra (tecnico ausente): BR-REP-007 y BR-REP-011 bloquean la toma y no hay cierre forzado.
8. Orden de resolucion de un Detalle que requiere revision cuando hay otros trabajables (AUD-V14-011).
9. Modelo tecnico de versiones de la definicion (AUD-V14-005) y canal de consentimiento.
10. Distribucion del puntaje entre tecnicos (BR-REP-009) y alcance de RT_GARANTIA_VENTA (fuera de MVP v2).

## Limitaciones de la auditoria

- **Verificado mediante tests y scripts ejecutados:** integridad del grafo (IDs unicos, aristas validas, nodos alcanzables, sin nodos sin salida), exactitud de las aristas de los Scenarios, referencias Feature/regla/nodo/actor, aristas y nodos sin recorrer por ningun Scenario, conteo de aserciones de los tests, y las validaciones listadas en el informe final.
- **Demostrado por lectura de reglas y grafo:** AUD-V14-001 a 004 (condiciones de aristas y texto de reglas citadas), 006, 007, 010 y 011.
- **Inferido a partir de documentacion:** el riesgo de version de AUD-V14-005, el impacto operativo estimado de cada hallazgo y el estado de la implementacion futura; no existe un modelo ejecutable del resolver ni del modelo de datos contra el que ejecutar los casos.
- No se audito el codigo del producto ni el MVP, ni se ejecuto el flujo contra datos. El viewer por origen se verifico por generacion, tests sobre el HTML y render en un navegador sin cabeza.
- Los numeros de linea del README corresponden al estado auditado y cambian si el README se edita.

## Anexo - Viewer exclusivo de Cliente Externo

- HTML: `generated/viewer/repair-management-cliente-externo-v1.4.html` (autocontenido: Mermaid embebido, sin servidor ni red). Mermaid: `generated/mermaid/repair-management-cliente-externo-v1.4.mmd`.
- Regenerar: `npm run generate:cliente-externo:v1.4` (valida V1.4, genera Mermaid y HTML y ejecuta `npm run test:cliente-externo:v1.4`). Los scripts generales aceptan `--origin=<ORIGEN>`; sin ese flag generan exactamente lo de siempre (se verifico que los artefactos de V1.2, V1.3 y V1.4 generales no cambian).
- Contenido: 65 de 70 nodos, 110 de 130 aristas y 32 de 37 Scenarios. Todos son nodos, aristas y Scenarios reales de V1.4; la vista no agrega nada.
- Criterio de filtrado (`scripts/lib/origin-filter.ts`): se quita una arista si (1) su condicion nombra otro origen o niega CLIENTE_EXTERNO (12 aristas), (2) su condicion es neutra pero solo la recorren Scenarios de otro origen (7: `020 -> 040`, `EVT-REP-002 -> 035`, `035 -> 040`, `050 [No - Detalles definidos] -> 080`, `050 [No - aun en revision] -> 065`, `250 [No] -> 290`, `290 -> 270`) o (3) queda inalcanzable (1: `025 -> 040`). Nodos excluidos: `EVT-REP-002`, `020`, `025`, `035`, `290`. Scenarios excluidos: HP-REP-002, HP-REP-003, VAR-REP-002, EXC-REP-004 (otros origenes) y VAR-REP-023 (recorre `184 -> 080` de otro origen).
- Se conservan los nodos compartidos (`010`, `040`, `050`, `070`, `075`, `127`, `128`, `184`, `270`, ...) con las salidas aplicables, el carril de autorizacion diferida (`EVT-REP-003 -> 046`, punteado), `129`, `047 [Sin respuesta ...]`, y la custodia y devolucion (`060`, `211/306 -> 270/271/fin`, `300`, `305`, `306`). Los ciclos reales (cola/estacion, continuar/liberar, espera de recursos, cobro y retrabajo) se conservan.
- Interfaz: titulo "Rosario Tecno — Flujo de Reparaciones | Cliente Externo V1.4", zoom, desplazamiento, "Ajustar a pantalla" (tambien al abrir), busqueda por ID o nombre, formas distintas para actividades, decisiones, eventos y finales, actor en cada nodo, condiciones en las aristas, panel de detalle con reglas, selector de Features y de Scenarios (resalta el HP y las variantes; HP-REP-001 resalta 40 aristas), y panel "Proceso" con lo excluido y sus motivos y los limites de la representacion.
- Verificacion: 14 tests (`scripts/test-origin-view.ts`) sobre el filtro y los artefactos generados; render comprobado en un navegador sin cabeza (65 nodos y 110 aristas dibujados, sin errores de Mermaid).
- Limites informados en el propio viewer: un solo token (el carril de Recepcion no implica una espera del tecnico pero no muestra concurrencia real); las capacidades transversales sin nodo (pago, override) solo aparecen en los pasos de los Scenarios; el mecanismo continuar/liberar no tiene Scenario; las bifurcaciones por origen no codificadas en la arista se resolvieron con evidencia de Scenarios (AUD-V14-014); una consulta con resultado mixto no tiene arista propia (AUD-V14-003).
