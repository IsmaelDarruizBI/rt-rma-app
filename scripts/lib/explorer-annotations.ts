/**
 * Viewer-only metadata for the interactive route explorer.
 *
 * IMPORTANT: this is NOT part of the Source of Truth. The YAML (process, rules,
 * features, scenarios) is never changed by it. Each entry below only ANNOTATES
 * how the explorer presents a node that already exists in the process, and says
 * WHERE in the Source of Truth the annotation is grounded (`basis`) and whether
 * that grounding is explicit in the text/actor of the node (DOCUMENTADA) or is a
 * reading made by the viewer (INFERIDA). A node without an annotation is shown as
 * "hipotesis de exploracion": the explorer never claims more than it can verify.
 *
 * scripts/test-explorer.ts checks every reference here against the real model, so
 * a renamed node or condition makes the test fail instead of silently drifting.
 *
 * Pure data + pure functions: no runtime imports, safe for Node and the browser.
 */

/** Kind of branching, as asked for by the explorer: what is deciding the alternative. */
export type DecisionKind =
  | "HUMANA" // a person (operator, technician, customer, coordinator) decides and registers it
  | "SISTEMA" // a validation / calculation evaluated by the system
  | "DERIVADA" // derived from the state of the Details / the Order (resolver, custody, evaluation)
  | "DATO_ORDEN" // depends on a datum of the Order itself (its origin)
  | "EXTERNA"; // waits for an event that happens outside the process thread

export type Grounding = "DOCUMENTADA" | "INFERIDA";

export interface NodeKindNote {
  kind: DecisionKind;
  grounding: Grounding;
  /** Where the Source of Truth supports it (node text, actor, rule). */
  basis: string;
  /** Optional per-alternative override, keyed by the exact edge condition. */
  edgeKinds?: Record<string, DecisionKind>;
}

/** Scope of a condition in an Order with several Details. */
export type ConditionScope = "DETALLE" | "ORDEN" | "CIERRE";

export interface NodeScopeNote {
  scope: ConditionScope;
  basis: string;
}

export interface WaitNote {
  /** What must happen outside the thread for the Order to move on (taken from the node text). */
  event: string;
  basis: string;
}

/**
 * Shared nodes whose exits are labelled per entry context (same idiom as PROC-REP-270):
 * which exit applies depends on the node the thread came from. `entries[].from` are the
 * predecessor nodes; `allow` the exact exit conditions that apply when entering from them.
 * Entries from a predecessor not listed here leave all exits available (flagged as hypothesis).
 */
export interface ContextExitNote {
  node: string;
  entries: { from: string[]; allow: string[] }[];
  basis: string;
}

const T = (kind: DecisionKind, grounding: Grounding, basis: string, edgeKinds?: Record<string, DecisionKind>): NodeKindNote => ({
  kind,
  grounding,
  basis,
  ...(edgeKinds ? { edgeKinds } : {}),
});

export const NODE_KINDS: Record<string, NodeKindNote> = {
  "PROC-REP-010": T("DATO_ORDEN", "DOCUMENTADA", "El nodo describe los cuatro origenes de la Orden: es un dato de la Orden, no una accion del operador."),
  "PROC-REP-040": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden."),
  "PROC-REP-045": T("HUMANA", "INFERIDA", "Distingue si Recepcion ya conoce los Detalles al ingreso."),
  "PROC-REP-046": T("HUMANA", "DOCUMENTADA", "Recepcion registra la decision del cliente por Detalle; si el cliente no respondio no hay decision que registrar y la solicitud queda sin resolver.", {
    "Solicitud sin resolver, Detalles siguen pendientes de autorizacion": "EXTERNA",
  }),
  "PROC-REP-047": T("HUMANA", "DOCUMENTADA", "Enruta unicamente el resultado comercial registrado en PROC-REP-046, con tres decisiones del cliente: acepta trabajos, rechaza algunos Detalles o rechaza todos los trabajos."),
  "PROC-REP-056": T("HUMANA", "DOCUMENTADA", "Recepcion registra si el cliente continua con la revision tecnica o desiste cuando todavia no hay Detalles (BR-REP-027, BR-REP-031)."),
  "PROC-REP-050": T("DATO_ORDEN", "DOCUMENTADA", "El texto define que origenes requieren comprobante de recepcion (el modelo no lo codifica en la condicion)."),
  "PROC-REP-055": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden."),
  "PROC-REP-060": T("DERIVADA", "INFERIDA", "Nodo del sistema que enruta segun si los Detalles ya estan definidos o la Orden sigue en revision."),
  "PROC-REP-068": T("HUMANA", "INFERIDA", "El tecnico concluye si, tras la revision, se pudo definir la reparacion."),
  "PROC-REP-070": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden."),
  "PROC-REP-075": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden."),
  "PROC-REP-090": T("DERIVADA", "DOCUMENTADA", "Pregunta agregada a nivel Orden sobre el hito historico de habilitacion y si existe un Detalle trabajable."),
  "PROC-REP-110": T("HUMANA", "DOCUMENTADA", "Es 'Si' cuando el Coordinador autoriza el override del Detalle (BR-REP-003)."),
  "PROC-REP-127": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden y con el contexto de la redefinicion."),
  "PROC-REP-128": T("DATO_ORDEN", "DOCUMENTADA", "Las salidas estan rotuladas con el origen de la Orden y con el contexto del alta."),
  "PROC-REP-170": T("SISTEMA", "DOCUMENTADA", "Nodo del sistema (cola de trabajo); las cancelaciones son acciones explicitas de un usuario aun sin actor definido por negocio.", {
    "Cancelar Detalle": "HUMANA",
    "Cancelar Orden": "HUMANA",
  }),
  "PROC-REP-172": T("SISTEMA", "DOCUMENTADA", "Nodo del sistema: valida la sesion y la estacion de trabajo."),
  "PROC-REP-174": T("SISTEMA", "DOCUMENTADA", "Evalua la compatibilidad de la estacion con el Tipo de Reparacion del Detalle."),
  "PROC-REP-178": T("HUMANA", "DOCUMENTADA", "Un usuario autorizado decide si fuerza la continuidad."),
  "PROC-REP-182": T("DERIVADA", "DOCUMENTADA", "Enruta segun el estado de la evaluacion tecnica de la definicion vigente del Detalle (BR-REP-035)."),
  "PROC-REP-183": T("HUMANA", "DOCUMENTADA", "Lo evalua el tecnico (ACT-TECH)."),
  "PROC-REP-184": T("HUMANA", "INFERIDA", "El tecnico puede detectar cero, una o varias reparaciones adicionales (BR-REP-036).", {
    "Hay Detalles pendientes de factibilidad (origen distinto de CLIENTE_EXTERNO)": "DATO_ORDEN",
  }),
  "PROC-REP-185": T("SISTEMA", "DOCUMENTADA", "Nodo del sistema: reserva insumos; la reserva puede fallar."),
  "PROC-REP-190": T("HUMANA", "DOCUMENTADA", "Lo ejecuta el tecnico (ACT-TECH), que puede detectar una reparacion adicional."),
  "PROC-REP-200": T("HUMANA", "DOCUMENTADA", "El tecnico (ACT-TECH) registra el resultado real de la Ejecucion."),
  "PROC-REP-211": T("DERIVADA", "DOCUMENTADA", "Invoca el resolver centralizado de estado de Orden (BR-REP-012): el resultado se deriva del estado de los Detalles y de los hitos; tambien es el enrutamiento interno posterior a la decision del cliente."),
  "PROC-REP-212": T("HUMANA", "DOCUMENTADA", "La decision de continuar o liberar la Orden es una accion explicita del tecnico (BR-REP-018)."),
  "PROC-REP-230": T("HUMANA", "INFERIDA", "Resultado del control tecnico, granular por Detalle."),
  "PROC-REP-250": T("DATO_ORDEN", "DOCUMENTADA", "El texto define que origenes requieren entrega a cliente (el modelo no lo codifica en la condicion)."),
  "PROC-REP-265": T("SISTEMA", "DOCUMENTADA", "El sistema calcula el Saldo = Total final - Pagos recibidos + Devoluciones realizadas (BR-REP-017, BR-REP-038)."),
  "PROC-REP-267": T("DERIVADA", "DOCUMENTADA", "La salida depende del contexto de entrada (validar entrega o validar fin de Orden), segun el texto del nodo."),
  "PROC-REP-268": T("SISTEMA", "DOCUMENTADA", "Verificacion del sistema previa al fin: hay o no saldo a favor pendiente de devolver (BR-REP-038)."),
  "PROC-REP-271": T("HUMANA", "DOCUMENTADA", "Recepcion determina que ocurrio con la custodia y lo registra (BR-REP-033)."),
  "PROC-REP-300": T("HUMANA", "INFERIDA", "Cancelacion de un Detalle; la salida depende del contexto (durante la evaluacion tecnica o fuera de ella)."),
  "PROC-REP-306": T("DERIVADA", "DOCUMENTADA", "La salida se deriva del estado de la custodia del equipo segun el comprobante de recepcion (BR-REP-033)."),
};

export const NODE_SCOPES: Record<string, NodeScopeNote> = {
  "PROC-REP-046": { scope: "DETALLE", basis: "La decision del cliente es por Detalle y definicion vigente (BR-REP-028)." },
  "PROC-REP-047": { scope: "DETALLE", basis: "La decision del cliente es por Detalle y definicion vigente (BR-REP-028)." },
  "PROC-REP-090": { scope: "ORDEN", basis: "Pregunta agregada a nivel Orden: al menos un Detalle trabajable." },
  "PROC-REP-120": { scope: "ORDEN", basis: "Estado agregado PENDIENTE_RECURSOS derivado de la situacion de los Detalles." },
  "PROC-REP-125": { scope: "ORDEN", basis: "Estado agregado REQUIERE_REVISION derivado de la situacion de los Detalles." },
  "PROC-REP-126": { scope: "DETALLE", basis: "Acotada a un unico Detalle existente marcado REQUIERE_DEFINICION." },
  "PROC-REP-127": { scope: "DETALLE", basis: "Acotada a actualizar un Detalle ya existente." },
  "PROC-REP-128": { scope: "DETALLE", basis: "Crea un Detalle nuevo detectado por el tecnico." },
  "PROC-REP-129": { scope: "ORDEN", basis: "Estado agregado PENDIENTE_AUTORIZACION derivado de la situacion de los Detalles." },
  "PROC-REP-174": { scope: "DETALLE", basis: "Evalua la estacion contra el Detalle seleccionado." },
  "PROC-REP-178": { scope: "DETALLE", basis: "Fuerza la continuidad de un Detalle en particular." },
  "PROC-REP-182": { scope: "DETALLE", basis: "Evalua el Detalle seleccionado." },
  "PROC-REP-183": { scope: "DETALLE", basis: "Evalua un Detalle diagnosticado por Recepcion." },
  "PROC-REP-211": { scope: "ORDEN", basis: "Resolver centralizado de estado de Orden (BR-REP-012); sus salidas 'Todos terminales' y 'Todos cancelados' son condiciones de cierre de todos los Detalles." },
  "PROC-REP-212": { scope: "ORDEN", basis: "Decision sobre la toma de la Orden." },
  "PROC-REP-230": { scope: "DETALLE", basis: "El control es granular por Detalle aunque ocurra en un unico paso a nivel Orden." },
  "PROC-REP-235": { scope: "DETALLE", basis: "Identifica los Detalles especificos a retrabajar." },
  "PROC-REP-300": { scope: "DETALLE", basis: "Cancela un Detalle." },
};

/** Waiting states: the thread stops until something outside it happens. */
export const NODE_WAITS: Record<string, WaitNote> = {
  "PROC-REP-120": { event: "Cambia la disponibilidad de recursos o se autoriza el override del Detalle", basis: "Espera de recursos: deja de aplicar cuando cualquier Detalle se vuelve trabajable." },
  "PROC-REP-125": { event: "El tecnico realiza la revision tecnica del Detalle", basis: "Espera de revision tecnica, analoga a PROC-REP-120." },
  "PROC-REP-129": { event: "Recepcion obtiene la respuesta de autorizacion del cliente", basis: "Espera de autorizacion del cliente, analoga a PROC-REP-120 y PROC-REP-125." },
  "PROC-REP-266": { event: "Se registra uno o mas Pagos adicionales (BR-REP-017-A)", basis: "La entrega queda bloqueada hasta que se registren Pagos que salden la diferencia." },
};

export const CONTEXT_EXITS: ContextExitNote[] = [
  {
    node: "PROC-REP-127",
    basis: "PROC-REP-127: la redefinicion nace del resultado de PROC-REP-126 (post-ejecucion) o de la evaluacion tecnica previa PROC-REP-183.",
    entries: [
      { from: ["PROC-REP-183"], allow: ["Redefinicion durante la evaluacion tecnica"] },
      {
        from: ["PROC-REP-126"],
        allow: ["Redefinicion posterior a una Ejecucion, CLIENTE_EXTERNO", "Redefinicion posterior a una Ejecucion, origen distinto de CLIENTE_EXTERNO"],
      },
    ],
  },
  {
    node: "PROC-REP-128",
    basis: "PROC-REP-128: el alta nace de la ejecucion (PROC-REP-190) o de la evaluacion tecnica (PROC-REP-184).",
    entries: [
      { from: ["PROC-REP-184"], allow: ["Alta durante la evaluacion tecnica"] },
      {
        from: ["PROC-REP-190"],
        allow: ["Alta durante la ejecucion, CLIENTE_EXTERNO", "Alta durante la ejecucion, origen distinto de CLIENTE_EXTERNO"],
      },
    ],
  },
  {
    node: "PROC-REP-300",
    basis: "PROC-REP-300: el descarte llega desde PROC-REP-183; la cancelacion fuera de la evaluacion llega desde PROC-REP-047 o PROC-REP-170.",
    entries: [
      { from: ["PROC-REP-183"], allow: ["Descarte durante la evaluacion tecnica"] },
      { from: ["PROC-REP-047", "PROC-REP-170"], allow: ["Cancelacion fuera de la evaluacion tecnica"] },
    ],
  },
  {
    node: "PROC-REP-267",
    basis: "PROC-REP-267: salidas excluyentes segun desde donde se llego (validar entrega desde PROC-REP-265, validar fin de Orden desde PROC-REP-268).",
    entries: [
      { from: ["PROC-REP-265"], allow: ["Devolucion registrada, validar entrega"] },
      { from: ["PROC-REP-268"], allow: ["Devolucion registrada, validar fin de Orden"] },
    ],
  },
];

/**
 * Nodes where an independent lane hands control back to the main thread. The lane runs through the
 * consultation (046/047) -- the same nodes the main thread may have visited -- and ends where its
 * outcome is taken over by the rest of the process.
 */
export const LANE_RETURN_NODES: { node: string; basis: string }[] = [
  { node: "PROC-REP-211", basis: "El carril de autorizacion diferida de Recepcion vuelve al resolver de estado de Orden (BR-REP-037; PROC-REP-129)." },
  { node: "PROC-REP-080", basis: "Un Detalle autorizado ('Acepta, requiere factibilidad') pasa a la evaluacion de factibilidad, que sigue el hilo tecnico (PROC-REP-047)." },
];

/** Kind of an alternative: the per-edge override of the node note, else the node kind, else undefined (= hypothesis). */
export function kindOfEdge(nodeId: string, condition: string | undefined): { kind: DecisionKind; grounding: Grounding } | undefined {
  const note = NODE_KINDS[nodeId];
  if (!note) return undefined;
  const override = condition !== undefined ? note.edgeKinds?.[condition] : undefined;
  return { kind: override ?? note.kind, grounding: note.grounding };
}

export const KIND_LABELS: Record<DecisionKind | "ESCENARIO" | "SIN_CLASIFICAR", { label: string; hint: string }> = {
  HUMANA: { label: "Decisión humana", hint: "Una persona (operador, técnico, cliente o coordinador) decide y el resultado se registra." },
  SISTEMA: { label: "Validación del sistema", hint: "Condición evaluada por el sistema. Elegir esta alternativa es explorar un resultado posible, NO una acción que el operador pueda forzar." },
  DERIVADA: { label: "Condición derivada de estados", hint: "Decisión automática del sistema, no del cliente ni del operador: se deriva del estado de los Detalles o de la Orden y de sus hitos (por ejemplo, el resolver). El viewer no calcula ese estado: es una hipótesis de exploración." },
  DATO_ORDEN: { label: "Dato de la Orden", hint: "Depende de un dato propio de la Orden (por ejemplo, su origen), no de una elección libre del operador." },
  EXTERNA: { label: "Evento externo", hint: "El hilo espera algo que ocurre fuera de él (por ejemplo, un pago o la respuesta del cliente)." },
  ESCENARIO: { label: "Alternativa de escenario", hint: "Esta alternativa es el punto de entrada de una variante o excepción modelada en los Scenarios." },
  SIN_CLASIFICAR: { label: "Hipótesis de exploración", hint: "El viewer no puede verificar con la información disponible quién o qué decide esta alternativa: se muestra como hipótesis, no como un hecho confirmado." },
};
