/**
 * Per-origin applicability of every process edge, for the interactive explorer.
 *
 * It reuses scripts/lib/origin-filter.ts (buildOriginView / scenarioOrigins) as the
 * single source of the origin logic and only RE-READS its report: nothing is
 * decided twice. For each origin, each edge falls in exactly one class:
 *
 *  - ALLOWED     the origin view keeps it (explicit or neutral with Scenario evidence).
 *  - HIDDEN      the edge condition names another origin / negates this one: proved by
 *                the model itself, so the explorer never offers it for this origin.
 *  - UNCONFIRMED the origin filter dropped it only for LACK OF EVIDENCE (the condition is
 *                origin-neutral and only Scenarios of other origins traverse it, or it
 *                became unreachable). The model does not prove that it is foreign to this
 *                origin, so the explorer reports it as uncertainty and lets the user
 *                opt in ("incluir ramas sin evidencia"), instead of excluding it silently.
 *
 * One refinement over the static origin view: an edge excluded for lack of evidence is only
 * treated as PROVEN foreign when it is an exit of an IMPLICIT ORIGIN SPLITTER -- a node whose
 * exits carry no origin in their condition but whose Scenario evidence partitions them
 * disjointly by origin (today PROC-REP-050 "Requiere comprobante" and PROC-REP-250 "Requiere
 * entrega", exactly the two cases already documented in the Cliente Externo view). There the
 * sibling exit of the SAME node is backed by the origin's own Scenarios, which is positive
 * evidence for the choice. Everywhere else "no Scenario of this origin traverses it" only says
 * that nobody modelled it (for example 068 -> 069 SIN_REPARACION, or the resolver exits), so the
 * edge stays UNCONFIRMED: offered, flagged and explained, never silently removed.
 *
 * Origins with no Scenario of their own (RT_GARANTIA_VENTA is out of MVP v2) have no
 * evidence at all: nothing can be proven for them beyond the explicit conditions.
 */
import { buildOriginView, classifyCondition, ORIGINS, scenarioOrigins, type Origin } from "./origin-filter";
import { edgeKey, type ProcessModel } from "./process-model";
import type { Scenario } from "./scenario-model";

export type EdgeOriginStatus = "HIDDEN" | "UNCONFIRMED";
export type EdgeOriginReason = "ORIGEN_EXPLICITO" | "ORIGEN_POR_EVIDENCIA" | "SIN_EVIDENCIA" | "INALCANZABLE";

export interface EdgeOriginInfo {
  status: EdgeOriginStatus;
  reason: EdgeOriginReason;
  /** Human readable evidence, e.g. 'solo la recorren HP-REP-002 (otro origen)'. */
  detail: string;
}

export interface OriginPolicy {
  /** Only the edges that are NOT plainly allowed, per origin (absent = ALLOWED). */
  statuses: Record<Origin, Record<string, EdgeOriginInfo>>;
  /** Origins with no Scenario of their own (and no generic one that is exclusively theirs). */
  originsWithoutScenarios: Origin[];
  /** Origin implied by a start event (e.g. EVT-REP-002 starts a RMA warranty). */
  startOrigins: Record<string, Origin>;
  /** Edges whose traversal DEFINES the origin of the Order (PROC-REP-010 and its origin-keyed siblings). */
  originChoiceEdges: Record<string, Origin>;
}

const isOriginName = (text: string | undefined): text is Origin => text !== undefined && (ORIGINS as readonly string[]).includes(text);

/** Origins whose Scenarios traverse each edge ("ALL" Scenarios count for every origin). */
function evidenceByEdge(scenarios: Scenario[]): Map<string, Set<Origin>> {
  const origins = scenarioOrigins(scenarios);
  const byEdge = new Map<string, Set<Origin>>();
  for (const s of scenarios) {
    const o = origins.get(s.id) ?? "ALL";
    const list: readonly Origin[] = o === "ALL" ? ORIGINS : o;
    for (const step of s.steps ?? []) {
      if (step.kind !== "PROCESS_EDGE") continue;
      const key = edgeKey(step.from, step.condition, step.to);
      if (!byEdge.has(key)) byEdge.set(key, new Set());
      list.forEach((x) => byEdge.get(key)?.add(x));
    }
  }
  return byEdge;
}

/**
 * Implicit origin splitters: nodes with two or more exits, none of whose conditions names an
 * origin, where two exits have non-empty and DISJOINT origin evidence.
 */
export function implicitOriginSplitters(model: ProcessModel, scenarios: Scenario[]): string[] {
  const evidence = evidenceByEdge(scenarios);
  const splitters: string[] = [];
  for (const node of model.nodes) {
    const outs = model.edges.filter((e) => e.from === node.id);
    if (outs.length < 2) continue;
    if (outs.some((e) => ORIGINS.some((o) => classifyCondition(e.condition, o) !== "NEUTRAL"))) continue;
    const sets = outs.map((e) => evidence.get(edgeKey(e.from, e.condition, e.to)) ?? new Set<Origin>()).filter((s) => s.size > 0);
    const disjoint = sets.some((a, i) => sets.some((b, j) => j > i && [...a].every((x) => !b.has(x))));
    if (disjoint) splitters.push(node.id);
  }
  return splitters;
}

export function buildOriginPolicy(model: ProcessModel, scenarios: Scenario[]): OriginPolicy {
  const origins = scenarioOrigins(scenarios);
  const statuses = {} as Record<Origin, Record<string, EdgeOriginInfo>>;
  const originsWithoutScenarios: Origin[] = [];
  const evidence = evidenceByEdge(scenarios);
  const splitters = new Set(implicitOriginSplitters(model, scenarios));

  for (const origin of ORIGINS) {
    const view = buildOriginView(model, scenarios, origin);
    const perEdge: Record<string, EdgeOriginInfo> = {};
    for (const excluded of view.report.excludedEdges) {
      const key = edgeKey(excluded.edge.from, excluded.edge.condition, excluded.edge.to);
      if (excluded.reason === "EXPLICIT_OTHER_ORIGIN") {
        perEdge[key] = { status: "HIDDEN", reason: "ORIGEN_EXPLICITO", detail: excluded.detail };
      } else if (excluded.reason === "SCENARIO_EVIDENCE") {
        // proven foreign only at an implicit splitter whose SIBLING exit is backed by this origin's own Scenarios
        const siblings = model.edges.filter((e) => e.from === excluded.edge.from && edgeKey(e.from, e.condition, e.to) !== key);
        const backedSibling = siblings.find((e) => evidence.get(edgeKey(e.from, e.condition, e.to))?.has(origin));
        if (splitters.has(excluded.edge.from) && backedSibling) {
          perEdge[key] = {
            status: "HIDDEN",
            reason: "ORIGEN_POR_EVIDENCIA",
            detail: `${excluded.detail}; en este nodo el origen ${origin} sigue por ${backedSibling.condition ?? backedSibling.to} (Scenarios del origen)`,
          };
        } else {
          perEdge[key] = { status: "UNCONFIRMED", reason: "SIN_EVIDENCIA", detail: excluded.detail };
        }
      } else {
        perEdge[key] = { status: "UNCONFIRMED", reason: "INALCANZABLE", detail: excluded.detail };
      }
    }
    statuses[origin] = perEdge;
    if (view.report.keptScenarios.length === 0) originsWithoutScenarios.push(origin);
  }

  // Origin implied by a start event: the single origin of the Happy Path that starts there.
  const startOrigins: Record<string, Origin> = {};
  const startsBy = new Map<string, Set<Origin>>();
  for (const s of scenarios.filter((x) => x.type === "HAPPY_PATH")) {
    const first = (s.steps ?? []).find((st) => st.kind === "PROCESS_EDGE");
    const o = origins.get(s.id);
    if (!first || first.kind !== "PROCESS_EDGE" || !o || o === "ALL") continue;
    if (!startsBy.has(first.from)) startsBy.set(first.from, new Set());
    o.forEach((x) => startsBy.get(first.from)?.add(x));
  }
  for (const [start, set] of startsBy) {
    if (set.size === 1) startOrigins[start] = [...set][0];
  }

  // Origin-defining edges: every exit of the node is keyed by exactly an origin name (PROC-REP-010, 040).
  const originChoiceEdges: Record<string, Origin> = {};
  for (const node of model.nodes) {
    const outs = model.edges.filter((e) => e.from === node.id);
    if (outs.length >= 2 && outs.every((e) => isOriginName(e.condition))) {
      for (const e of outs) originChoiceEdges[edgeKey(e.from, e.condition, e.to)] = e.condition as Origin;
    }
  }

  return { statuses, originsWithoutScenarios, startOrigins, originChoiceEdges };
}
