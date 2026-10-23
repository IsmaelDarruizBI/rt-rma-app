/**
 * Builds the data payload embedded in the interactive route explorer.
 *
 * Everything shown by the explorer comes from here, and everything here comes from the
 * Source of Truth (process, rules, actors, features and scenarios YAML) or from the
 * viewer-only annotations in explorer-annotations.ts. No text of the process is rewritten.
 */
import { CONTEXT_EXITS, KIND_LABELS, LANE_RETURN_NODES, NODE_KINDS, NODE_SCOPES, NODE_WAITS, kindOfEdge, type ConditionScope, type DecisionKind, type Grounding } from "./explorer-annotations";
import type { GraphSpec } from "./explorer-engine";
import { buildOriginPolicy } from "./explorer-origin";
import type { FeatureModel } from "./feature-model";
import { ORIGINS, originLabel, scenarioOrigins, type Origin } from "./origin-filter";
import { edgeKey, type Actor, type BusinessRule, type ProcessModel } from "./process-model";
import type { Scenario } from "./scenario-model";

export interface ExplorerNodeInfo {
  id: string;
  type: string;
  name: string;
  description?: string;
  actor?: { id: string; name: string };
  inputs?: string[];
  outputs?: string[];
  rules: { id: string; name: string; description?: string; status?: string }[];
  features: { id: string; name: string }[];
  scenarios: string[];
  kind?: { kind: DecisionKind; grounding: Grounding; basis: string };
  scope?: { scope: ConditionScope; basis: string };
  wait?: { event: string; basis: string };
  contextExit?: { basis: string };
  laneReturn?: { basis: string };
}

export interface ExplorerEdgeInfo {
  id: string;
  from: string;
  to: string;
  condition?: string;
  /** Scenarios (any type) that traverse exactly this edge. */
  scenarios: string[];
  /** VARIANT / EXCEPTION scenarios whose trigger is exactly this edge. */
  variantTriggers: string[];
  kind?: { kind: DecisionKind; grounding: Grounding };
}

export interface ExplorerScenarioInfo {
  id: string;
  name: string;
  type: string;
  origins: Origin[] | "ALL";
  feature?: string;
}

export interface ExplorerData {
  meta: { process: ProcessModel["process"]; sources: string[] };
  graph: GraphSpec;
  nodes: Record<string, ExplorerNodeInfo>;
  edges: Record<string, ExplorerEdgeInfo>;
  scenarios: Record<string, ExplorerScenarioInfo>;
  origins: { id: Origin; label: string; hasScenarios: boolean }[];
  starts: { id: string; name: string; origin?: Origin; independent: boolean }[];
  kindLabels: typeof KIND_LABELS;
  limitations: string[];
  multiDetail: typeof MULTI_DETAIL_NOTES;
}

export const EXPLORER_LIMITATIONS = [
  "Es una herramienta de análisis funcional, no un simulador transaccional: no calcula el Saldo, el estado agregado de la Orden, las autorizaciones ni las factibilidades. Cada alternativa que se elige es una hipótesis de exploración sobre el proceso, no un hecho confirmado.",
  "El grafo es de un solo token: no representa la concurrencia real entre el hilo técnico y la gestión de Recepción. La autorización diferida del cliente (EVT-REP-003 → 046) se explora como un evento independiente que el usuario activa; no es un paso obligatorio del hilo técnico ni lo bloquea, y el modelo no codifica la precondición que lo habilita.",
  "Una Orden puede tener varios Detalles a la vez (confirmado, pendiente de autorización, pendiente de stock, completo, cancelado). El grafo no distingue Detalles: el resolver (PROC-REP-211, BR-REP-012) agrega esas situaciones y el explorador NO las calcula; solo permite recorrer cada resultado posible.",
  "Las bifurcaciones por origen que el modelo no codifica en la condición de la arista (por ejemplo PROC-REP-050 y PROC-REP-250) se resuelven con la evidencia de los Scenarios, igual que en la vista de Cliente Externo. Lo que no puede demostrarse para el origen no se excluye en silencio: se ofrece como alternativa sin evidencia, marcada como hipótesis.",
  "Los nodos compartidos con salidas rotuladas por contexto (PROC-REP-127, 128, 267 y 300) ofrecen solo la salida que corresponde al nodo de procedencia, según su descripción; las demás se listan como no ofrecidas con ese motivo.",
  "Las capacidades transversales sin nodo (Registrar pago, override de factibilidad o de estación) no son aristas del proceso y no se dibujan.",
  "Cada repetición de un ciclo legítimo (revalidación, cobro y devolución parciales, ejecuciones múltiples, continuar o liberar) es una visita nueva del mismo nodo; el avance automático se detiene antes de repetirla y pide confirmación.",
];

/** Explains, without computing any state, how an Order with several Details relates to the conditions of the graph. */
export const MULTI_DETAIL_NOTES = {
  intro:
    "Una Orden puede tener varios Detalles al mismo tiempo y cada uno en una situación distinta. El grafo es de un solo token y no distingue Detalles: las condiciones de cada nodo se leen en uno de estos tres niveles. El explorador no genera ni calcula estados de negocio: lo que se elige es siempre una hipótesis de exploración.",
  levels: [
    { label: "Resultado por Detalle", text: "Autorización del cliente, factibilidad, evaluación técnica, ejecución, cancelación y control técnico se deciden sobre un Detalle concreto (nodos 046/047, 080, 182/183, 190/200, 300, 230)." },
    { label: "Situación técnica agregada de la OR", text: "Es derivada de la situación de todos sus Detalles por el resolver de estado de Orden (PROC-REP-211, BR-REP-012); por ejemplo PENDIENTE_AUTORIZACION, PENDIENTE_RECURSOS o REQUIERE_REVISION. El explorador no la calcula." },
    { label: "Condición de cierre de todos los Detalles", text: "Las salidas «Todos terminales, existe completo» y «Todos cancelados…» de PROC-REP-211 exigen que ningún Detalle quede pendiente; recién entonces la Orden pasa al control técnico final o se cancela." },
  ],
  example:
    "DET-1 confirmado y autorizado · DET-2 pendiente de autorización · DET-3 pendiente de stock · DET-4 completo · DET-5 cancelado. Mientras convivan, el resolver puede devolver un resultado agregado distinto del de cada Detalle, y la Orden no llega al cierre.",
};

export interface ExplorerInputs {
  model: ProcessModel;
  rules: BusinessRule[];
  actors: Actor[];
  features: FeatureModel;
  scenarios: Scenario[];
  sources: string[];
}

export function buildExplorerData(inputs: ExplorerInputs): ExplorerData {
  const { model, rules, actors, features, scenarios } = inputs;
  const actorsById = new Map(actors.map((a) => [a.id, a]));
  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const origins = scenarioOrigins(scenarios);
  const policy = buildOriginPolicy(model, scenarios);

  const edgeIds = model.edges.map((e) => edgeKey(e.from, e.condition, e.to));
  if (new Set(edgeIds).size !== edgeIds.length) throw new Error("el proceso tiene aristas con la misma identidad (from + condicion + to)");

  // scenarios per edge / node
  const byEdge = new Map<string, Set<string>>();
  const byNode = new Map<string, Set<string>>();
  const triggers = new Map<string, string[]>();
  for (const s of scenarios) {
    for (const step of s.steps ?? []) {
      if (step.kind !== "PROCESS_EDGE") continue;
      const key = edgeKey(step.from, step.condition, step.to);
      if (!byEdge.has(key)) byEdge.set(key, new Set());
      byEdge.get(key)?.add(s.id);
      for (const n of [step.from, step.to]) {
        if (!byNode.has(n)) byNode.set(n, new Set());
        byNode.get(n)?.add(s.id);
      }
    }
    if (s.type !== "HAPPY_PATH" && s.trigger?.edge) {
      const key = edgeKey(s.trigger.edge.from, s.trigger.edge.condition, s.trigger.edge.to);
      triggers.set(key, [...(triggers.get(key) ?? []), s.id]);
    }
  }

  const nodes: Record<string, ExplorerNodeInfo> = {};
  for (const node of model.nodes) {
    const actor = node.actor ? actorsById.get(node.actor) : undefined;
    nodes[node.id] = {
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.description ? { description: node.description.trim() } : {}),
      ...(node.actor ? { actor: { id: node.actor, name: actor?.name ?? node.actor } } : {}),
      ...(node.inputs ? { inputs: node.inputs } : {}),
      ...(node.outputs ? { outputs: node.outputs } : {}),
      rules: (node.rules ?? []).map((id) => {
        const r = rulesById.get(id);
        return r ? { id: r.id, name: r.name, description: r.description?.trim(), status: r.status } : { id, name: "(regla no encontrada)" };
      }),
      features: features.features.filter((f) => f.process_nodes.includes(node.id)).map((f) => ({ id: f.id, name: f.name })),
      scenarios: [...(byNode.get(node.id) ?? [])],
      ...(NODE_KINDS[node.id] ? { kind: { kind: NODE_KINDS[node.id].kind, grounding: NODE_KINDS[node.id].grounding, basis: NODE_KINDS[node.id].basis } } : {}),
      ...(NODE_SCOPES[node.id] ? { scope: NODE_SCOPES[node.id] } : {}),
      ...(NODE_WAITS[node.id] ? { wait: NODE_WAITS[node.id] } : {}),
      ...(CONTEXT_EXITS.find((c) => c.node === node.id) ? { contextExit: { basis: CONTEXT_EXITS.find((c) => c.node === node.id)?.basis ?? "" } } : {}),
      ...(LANE_RETURN_NODES.find((l) => l.node === node.id) ? { laneReturn: { basis: LANE_RETURN_NODES.find((l) => l.node === node.id)?.basis ?? "" } } : {}),
    };
  }

  const edges: Record<string, ExplorerEdgeInfo> = {};
  for (const edge of model.edges) {
    const id = edgeKey(edge.from, edge.condition, edge.to);
    const kind = kindOfEdge(edge.from, edge.condition);
    edges[id] = {
      id,
      from: edge.from,
      to: edge.to,
      ...(edge.condition ? { condition: edge.condition } : {}),
      scenarios: [...(byEdge.get(id) ?? [])],
      variantTriggers: triggers.get(id) ?? [],
      ...(kind ? { kind } : {}),
    };
  }

  // Start events: nodes with no incoming edge. A start that no Happy Path begins with is an independent lane.
  const hasIncoming = new Set(model.edges.map((e) => e.to));
  const startNodes = model.nodes.filter((n) => (n.type === "event" || n.type === "start") && !hasIncoming.has(n.id));
  const hpStarts = new Set<string>();
  for (const s of scenarios.filter((x) => x.type === "HAPPY_PATH")) {
    const first = (s.steps ?? []).find((st) => st.kind === "PROCESS_EDGE");
    if (first && first.kind === "PROCESS_EDGE") hpStarts.add(first.from);
  }
  const mainStarts = startNodes.filter((n) => hpStarts.has(n.id)).map((n) => n.id);
  const independentStarts = startNodes.filter((n) => !hpStarts.has(n.id)).map((n) => n.id);

  const graph: GraphSpec = {
    nodes: model.nodes.map((n) => ({ id: n.id, type: n.type, name: n.name })),
    edges: model.edges.map((e) => ({ id: edgeKey(e.from, e.condition, e.to), from: e.from, to: e.to, ...(e.condition ? { condition: e.condition } : {}) })),
    mainStarts,
    independentStarts,
    policy: {
      statuses: policy.statuses,
      originsWithoutScenarios: policy.originsWithoutScenarios,
      startOrigins: policy.startOrigins,
      originChoiceEdges: policy.originChoiceEdges,
    },
    waits: Object.fromEntries(Object.entries(NODE_WAITS).map(([id, w]) => [id, { event: w.event }])),
    contextExits: CONTEXT_EXITS.map((c) => ({ node: c.node, entries: c.entries })),
    laneReturnNodes: LANE_RETURN_NODES.map((l) => l.node),
  };

  const scenarioInfo: Record<string, ExplorerScenarioInfo> = {};
  for (const s of scenarios) {
    scenarioInfo[s.id] = { id: s.id, name: s.name, type: s.type, origins: origins.get(s.id) ?? "ALL", ...(s.feature ? { feature: s.feature } : {}) };
  }

  return {
    meta: { process: model.process, sources: inputs.sources },
    graph,
    nodes,
    edges,
    scenarios: scenarioInfo,
    origins: ORIGINS.map((id) => ({ id, label: originLabel(id), hasScenarios: !policy.originsWithoutScenarios.includes(id) })),
    starts: startNodes.map((n) => ({
      id: n.id,
      name: n.name,
      ...(policy.startOrigins[n.id] ? { origin: policy.startOrigins[n.id] } : {}),
      independent: independentStarts.includes(n.id),
    })),
    kindLabels: KIND_LABELS,
    limitations: EXPLORER_LIMITATIONS,
    multiDetail: MULTI_DETAIL_NOTES,
  };
}
