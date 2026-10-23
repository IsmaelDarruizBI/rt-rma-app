/**
 * Navigation engine of the interactive route explorer.
 *
 * It is a DETERMINISTIC REPLAY: the whole state is the ordered list of user actions
 * (choose an alternative, confirm a cycle, mark an external event as happened, activate
 * or close an independent lane). `replay()` re-walks the REAL process graph from the
 * start node applying those actions and returns every visit plus what is pending.
 * Going back, changing a past decision or resetting is therefore just truncating the
 * action list: nothing incompatible can survive, and the same actions always give the
 * same route.
 *
 * Automatic advance (what the user does NOT have to decide) follows the only available
 * exit and stops at:
 *   - a node with two or more available exits               -> DECISION,
 *   - a waiting node (outside event)                        -> EXTERNAL,
 *   - an automatic step that would REPEAT a visited node    -> CYCLE (never loops by itself),
 *   - the end node, or a node with no available exit.
 *
 * This is a tool for functional analysis, NOT a transactional simulator: it never computes
 * business state (Saldo, aggregate Order state, authorizations). Every alternative offered is
 * a real edge of the Source of Truth; the engine invents no node, edge, label or blocking.
 *
 * Pure (no runtime imports, only erased type imports): the same source is transpiled into
 * the self-contained HTML and run by scripts/test-explorer.ts.
 */
import type { Origin } from "./origin-filter";

// ----------------------------------------------------------------------------- graph model

export interface EngineNodeSpec {
  id: string;
  type: string;
  name: string;
}

export interface EngineEdgeSpec {
  /** edgeKey(from, condition, to): unique identity of the edge. */
  id: string;
  from: string;
  to: string;
  condition?: string;
}

export interface EdgeOriginInfoSpec {
  status: "HIDDEN" | "UNCONFIRMED";
  reason: string;
  detail: string;
}

export interface ContextExitSpec {
  node: string;
  entries: { from: string[]; allow: string[] }[];
}

export interface GraphSpec {
  nodes: EngineNodeSpec[];
  edges: EngineEdgeSpec[];
  /** Entry events of the main flow (e.g. EVT-REP-001, EVT-REP-002). */
  mainStarts: string[];
  /** Entry events that start an independent lane (e.g. EVT-REP-003). */
  independentStarts: string[];
  policy: {
    statuses: Record<string, Record<string, EdgeOriginInfoSpec>>;
    originsWithoutScenarios: string[];
    startOrigins: Record<string, string>;
    originChoiceEdges: Record<string, string>;
  };
  waits: Record<string, { event: string }>;
  contextExits: ContextExitSpec[];
  laneReturnNodes: string[];
}

export interface EngineGraph extends GraphSpec {
  nodeById: Record<string, EngineNodeSpec>;
  edgeById: Record<string, EngineEdgeSpec>;
  out: Record<string, EngineEdgeSpec[]>;
}

export function buildGraph(spec: GraphSpec): EngineGraph {
  const nodeById: Record<string, EngineNodeSpec> = {};
  const edgeById: Record<string, EngineEdgeSpec> = {};
  const out: Record<string, EngineEdgeSpec[]> = {};
  for (const n of spec.nodes) nodeById[n.id] = n;
  for (const e of spec.edges) {
    if (edgeById[e.id]) throw new Error(`arista duplicada: ${e.id}`);
    edgeById[e.id] = e;
    (out[e.from] ??= []).push(e);
  }
  return { ...spec, nodeById, edgeById, out };
}

// ----------------------------------------------------------------------------- actions

export type Action =
  | { type: "CHOOSE"; thread: string; edge: string }
  | { type: "CONTINUE_CYCLE"; thread: string }
  | { type: "EVENT_OCCURRED"; thread: string }
  | { type: "ACTIVATE_LANE"; start: string; lane: string }
  | { type: "CLOSE_LANE"; thread: string };

export interface EngineConfig {
  /** Start node of the main thread (one of graph.mainStarts; tests may use any node). */
  start: string;
  /**
   * Offer the alternatives that no Scenario of the origin traverses but that the model does not prove
   * foreign to it (flagged as hypothesis). When false they are listed as hidden with their reason.
   */
  includeUncertain: boolean;
  /** Test hook: fixes the origin instead of deriving it from the route. */
  forceOrigin?: Origin;
}

// ----------------------------------------------------------------------------- result model

export type ThreadStatus = "WAITING" | "ENDED" | "DEAD_END" | "RETURNED" | "CLOSED";
export type MoveMode = "AUTO" | "CHOICE" | "CYCLE" | "EVENT";

export interface VisitRec {
  /** Position inside its thread. */
  idx: number;
  thread: string;
  node: string;
  /** 1 for the first visit of this node in the thread, 2 for the second, ... */
  visitNo: number;
  /** Global chronological order (visits and actions share the counter). */
  seq: number;
  /** How the thread got here; absent for the first visit of a thread. */
  via?: { edge: string; mode: MoveMode; action?: number };
}

export interface OptionRec {
  edge: string;
  to: string;
  condition?: string;
  /** ALLOWED = proven or backed by Scenarios for this origin; UNCONFIRMED = offered as hypothesis. */
  status: "ALLOWED" | "UNCONFIRMED";
  detail?: string;
}

export interface HiddenRec {
  edge: string;
  to: string;
  condition?: string;
  reason: "ORIGIN_EXPLICIT" | "ORIGIN_EVIDENCE" | "ORIGIN_UNCONFIRMED" | "CONTEXT";
  detail: string;
}

export interface PendingRec {
  kind: "DECISION" | "CYCLE" | "EXTERNAL";
  node: string;
  options: OptionRec[];
  hidden: HiddenRec[];
  /** CYCLE: the only automatic exit, which would repeat a visited node. */
  cycleEdge?: string;
  cycleTarget?: string;
  cycleTargetVisits?: number;
  /** EXTERNAL: what the thread waits for. */
  event?: string;
}

export interface ThreadRec {
  id: string;
  start: string;
  status: ThreadStatus;
  visits: VisitRec[];
  pending?: PendingRec;
  /** DEAD_END: the alternatives that exist but are not offered, so the UI can explain why. */
  hiddenAtEnd?: HiddenRec[];
  returnedAt?: string;
  /** Lanes: index of the main visit after which the user activated it. */
  activatedAfterMainVisit?: number;
  activatedSeq?: number;
}

export interface ActionRec {
  index: number;
  action: Action;
  thread: string;
  /** Node where the thread was when the action was taken. */
  node: string;
  seq: number;
  edge?: string;
}

export interface LaneSlot {
  start: string;
  available: boolean;
  reason?: string;
}

export interface ReplayResult {
  origin?: Origin;
  threads: ThreadRec[];
  actionLog: ActionRec[];
  /** Number of actions applied; the rest (if any) was incompatible and dropped. */
  applied: number;
  rejected?: { index: number; reason: string };
  lanes: LaneSlot[];
  /** Alternatives chosen by the user (CHOOSE). */
  decisions: number;
  /** All user actions that moved a thread. */
  steps: number;
}

export const MAX_VISITS_PER_THREAD = 400;

// ----------------------------------------------------------------------------- options at a node

export interface OptionsAt {
  options: OptionRec[];
  hidden: HiddenRec[];
}

/**
 * The alternatives available when a thread is at `node`, having come from `prevNode`.
 * Nothing is dropped silently: every real exit is either an option or listed in `hidden`
 * with the reason (other origin proven by the model, no evidence for this origin, or an
 * exit labelled for another entry context).
 */
export function optionsAt(graph: EngineGraph, cfg: EngineConfig, origin: Origin | undefined, node: string, prevNode: string | undefined): OptionsAt {
  const options: OptionRec[] = [];
  const hidden: HiddenRec[] = [];
  const outs = graph.out[node] ?? [];

  let contextAllow: Set<string> | undefined;
  if (prevNode !== undefined) {
    const note = graph.contextExits.find((c) => c.node === node);
    const entry = note?.entries.find((en) => en.from.includes(prevNode));
    if (entry) contextAllow = new Set(entry.allow);
  }
  const uncertainOffered = cfg.includeUncertain;

  for (const e of outs) {
    const base = { edge: e.id, to: e.to, condition: e.condition };
    if (contextAllow && !contextAllow.has(e.condition ?? "")) {
      hidden.push({ ...base, reason: "CONTEXT", detail: `salida rotulada para otro contexto de entrada (se llego desde ${prevNode})` });
      continue;
    }
    // Before the origin of the Order is chosen nothing is filtered: the origin decision itself must be free.
    const info = origin !== undefined ? graph.policy.statuses[origin]?.[e.id] : undefined;
    if (!info) {
      options.push({ ...base, status: "ALLOWED" });
    } else if (info.status === "HIDDEN") {
      hidden.push({ ...base, reason: info.reason === "ORIGEN_POR_EVIDENCIA" ? "ORIGIN_EVIDENCE" : "ORIGIN_EXPLICIT", detail: info.detail });
    } else if (uncertainOffered) {
      options.push({ ...base, status: "UNCONFIRMED", detail: info.detail });
    } else {
      hidden.push({ ...base, reason: "ORIGIN_UNCONFIRMED", detail: info.detail });
    }
  }
  return { options, hidden };
}

// ----------------------------------------------------------------------------- replay

interface Walker {
  id: string;
  start: string;
  visits: VisitRec[];
  status: ThreadStatus;
  pending?: PendingRec;
  hiddenAtEnd?: HiddenRec[];
  returnedAt?: string;
  waitResolved: Set<number>;
  visitCount: Map<string, number>;
  activatedAfterMainVisit?: number;
  activatedSeq?: number;
}

export function replay(graph: EngineGraph, cfg: EngineConfig, actions: Action[]): ReplayResult {
  let seq = 0;
  let origin: Origin | undefined = cfg.forceOrigin ?? (graph.policy.startOrigins[cfg.start] as Origin | undefined);
  const actionLog: ActionRec[] = [];
  const walkers: Walker[] = [];

  const newWalker = (id: string, start: string): Walker => {
    const w: Walker = { id, start, visits: [], status: "WAITING", waitResolved: new Set(), visitCount: new Map() };
    walkers.push(w);
    return w;
  };

  const pushVisit = (w: Walker, node: string, via?: VisitRec["via"]): void => {
    const visitNo = (w.visitCount.get(node) ?? 0) + 1;
    w.visitCount.set(node, visitNo);
    w.visits.push({ idx: w.visits.length, thread: w.id, node, visitNo, seq: seq++, ...(via ? { via } : {}) });
  };

  const prevNodeOf = (w: Walker): string | undefined => (w.visits.length >= 2 ? w.visits[w.visits.length - 2].node : undefined);


  /** Moves the walker along an edge and keeps advancing. */
  const move = (w: Walker, edgeId: string, mode: MoveMode, action?: number): void => {
    const edge = graph.edgeById[edgeId];
    pushVisit(w, edge.to, { edge: edgeId, mode, ...(action !== undefined ? { action } : {}) });
    if (origin === undefined && graph.policy.originChoiceEdges[edgeId]) origin = graph.policy.originChoiceEdges[edgeId] as Origin;
    advance(w);
  };

  const advance = (w: Walker): void => {
    w.pending = undefined;
    w.hiddenAtEnd = undefined;
    for (let guard = 0; guard < MAX_VISITS_PER_THREAD; guard++) {
      const cur = w.visits[w.visits.length - 1];
      const node = graph.nodeById[cur.node];
      if (node.type === "end") {
        w.status = "ENDED";
        return;
      }
      if (w.id !== "main" && cur.idx > 0 && graph.laneReturnNodes.includes(cur.node)) {
        w.status = "RETURNED";
        w.returnedAt = cur.node;
        return;
      }
      const wait = graph.waits[cur.node];
      if (wait && !w.waitResolved.has(cur.idx)) {
        const { options, hidden } = optionsAt(graph, cfg, origin, cur.node, prevNodeOf(w));
        w.status = "WAITING";
        w.pending = { kind: "EXTERNAL", node: cur.node, options, hidden, event: wait.event };
        return;
      }
      const { options, hidden } = optionsAt(graph, cfg, origin, cur.node, prevNodeOf(w));
      if (options.length === 0) {
        w.status = "DEAD_END";
        w.hiddenAtEnd = hidden;
        return;
      }
      if (options.length > 1) {
        w.status = "WAITING";
        w.pending = { kind: "DECISION", node: cur.node, options, hidden };
        return;
      }
      // exactly one available exit: automatic, unless it would repeat a visited node
      const only = options[0];
      const visitedBefore = w.visitCount.get(only.to) ?? 0;
      if (visitedBefore > 0) {
        w.status = "WAITING";
        w.pending = { kind: "CYCLE", node: cur.node, options, hidden, cycleEdge: only.edge, cycleTarget: only.to, cycleTargetVisits: visitedBefore };
        return;
      }
      pushVisit(w, only.to, { edge: only.edge, mode: "AUTO" });
      if (origin === undefined && graph.policy.originChoiceEdges[only.edge]) origin = graph.policy.originChoiceEdges[only.edge] as Origin;
    }
    w.status = "DEAD_END";
  };

  const laneAvailability = (start: string): LaneSlot => {
    if (origin === undefined) return { start, available: false, reason: "Elija primero el origen de la Orden: la disponibilidad del evento depende de el." };
    const outs = graph.out[start] ?? [];
    // an independent event is offered only where the model backs it for the origin (never as a mere hypothesis)
    const backed = optionsAt(graph, cfg, origin, start, undefined).options.filter((o) => o.status === "ALLOWED");
    if (outs.length === 0) return { start, available: false, reason: "El evento no tiene salidas en el proceso." };
    if (backed.length === 0) {
      return { start, available: false, reason: `Sin evidencia para el origen ${origin}: el modelo solo lo recorre en Scenarios de otro origen (la autorizacion del cliente es propia de CLIENTE_EXTERNO).` };
    }
    return { start, available: true };
  };

  const main = newWalker("main", cfg.start);
  pushVisit(main, cfg.start);
  advance(main);

  let applied = 0;
  let rejected: ReplayResult["rejected"];
  let decisions = 0;
  let steps = 0;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const reject = (reason: string): void => {
      rejected = { index: i, reason };
    };

    if (action.type === "ACTIVATE_LANE") {
      const slot = laneAvailability(action.start);
      if (!graph.independentStarts.includes(action.start)) {
        reject(`${action.start} no es un evento independiente`);
        break;
      }
      if (!slot.available) {
        reject(slot.reason ?? "evento no disponible");
        break;
      }
      if (walkers.some((w) => w.id === action.lane)) {
        reject(`el carril ${action.lane} ya existe`);
        break;
      }
      const w = newWalker(action.lane, action.start);
      w.activatedAfterMainVisit = walkers[0].visits.length - 1;
      w.activatedSeq = seq;
      actionLog.push({ index: i, action, thread: "main", node: action.start, seq: seq++ });
      pushVisit(w, action.start);
      advance(w);
      applied++;
      steps++;
      continue;
    }

    const w = walkers.find((x) => x.id === action.thread);
    if (!w) {
      reject(`el hilo ${action.thread} no existe`);
      break;
    }
    const at = w.visits[w.visits.length - 1].node;

    if (action.type === "CLOSE_LANE") {
      if (w.id === "main" || w.status === "CLOSED") {
        reject("solo se puede cerrar un carril independiente activo");
        break;
      }
      actionLog.push({ index: i, action, thread: w.id, node: at, seq: seq++ });
      w.status = "CLOSED";
      w.pending = undefined;
      applied++;
      steps++;
      continue;
    }

    const pending = w.pending;
    if (!pending) {
      reject(`el hilo ${w.id} no espera ninguna accion (${w.status})`);
      break;
    }

    if (action.type === "CHOOSE") {
      const option = pending.kind === "DECISION" ? pending.options.find((o) => o.edge === action.edge) : undefined;
      if (!option) {
        reject(`la alternativa ${action.edge} no esta disponible en ${at}`);
        break;
      }
      actionLog.push({ index: i, action, thread: w.id, node: at, seq: seq++, edge: action.edge });
      move(w, action.edge, "CHOICE", i);
      decisions++;
    } else if (action.type === "CONTINUE_CYCLE") {
      if (pending.kind !== "CYCLE" || !pending.cycleEdge) {
        reject(`no hay un ciclo pendiente de confirmar en ${at}`);
        break;
      }
      actionLog.push({ index: i, action, thread: w.id, node: at, seq: seq++, edge: pending.cycleEdge });
      move(w, pending.cycleEdge, "CYCLE", i);
    } else {
      if (pending.kind !== "EXTERNAL") {
        reject(`no hay un evento externo pendiente en ${at}`);
        break;
      }
      actionLog.push({ index: i, action, thread: w.id, node: at, seq: seq++ });
      const resolvedAt = w.visits[w.visits.length - 1].idx;
      w.waitResolved.add(resolvedAt);
      // the user's action IS the step: a single exit is taken without asking again (even if it repeats a node)
      const { options } = optionsAt(graph, cfg, origin, at, prevNodeOf(w));
      if (options.length === 1) move(w, options[0].edge, "EVENT", i);
      else advance(w);
    }
    applied++;
    steps++;
  }

  const threads: ThreadRec[] = walkers.map((w) => ({
    id: w.id,
    start: w.start,
    status: w.status,
    visits: w.visits,
    ...(w.pending ? { pending: w.pending } : {}),
    ...(w.hiddenAtEnd ? { hiddenAtEnd: w.hiddenAtEnd } : {}),
    ...(w.returnedAt ? { returnedAt: w.returnedAt } : {}),
    ...(w.activatedAfterMainVisit !== undefined ? { activatedAfterMainVisit: w.activatedAfterMainVisit } : {}),
    ...(w.activatedSeq !== undefined ? { activatedSeq: w.activatedSeq } : {}),
  }));

  return {
    ...(origin ? { origin } : {}),
    threads,
    actionLog,
    applied,
    ...(rejected ? { rejected } : {}),
    lanes: graph.independentStarts.map((s) => laneAvailability(s)),
    decisions,
    steps,
  };
}

/** Index of the action that created the route position `actionIndex` is going back to. */
export function truncateTo(actions: Action[], keep: number): Action[] {
  return actions.slice(0, Math.max(0, keep));
}

/** Stable id for the next independent lane: lane1, lane2, ... */
export function nextLaneId(actions: Action[]): string {
  return `lane${actions.filter((a) => a.type === "ACTIVATE_LANE").length + 1}`;
}
