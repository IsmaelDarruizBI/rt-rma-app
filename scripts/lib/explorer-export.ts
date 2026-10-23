/**
 * Exports of the route built in the interactive explorer. Pure (the browser runs this file, the tests too).
 *
 * Nothing is invented: every exported node is a real process node (a repeated visit gets a `_vN` suffix on
 * its Mermaid id, and the node keeps its real name) and every exported edge is a real process edge with its
 * real condition. The "activated by the user" connector of an independent lane is NOT an edge of the model
 * and is therefore never exported. Mermaid shapes/edge lines come from process-core.ts, the same helpers the
 * Mermaid generators use.
 */
import type { EngineGraph, ReplayResult, ThreadRec } from "./explorer-engine";
import type { ProcessNode } from "./process-model";
import { renderEdgeLine, renderNodeShape } from "./process-core";

export interface ExportNodeInfo {
  id: string;
  type: string;
  name: string;
  actorName?: string;
}

const mermaidIdOf = (thread: ThreadRec, node: string, visitNo: number): string => {
  const base = thread.id === "main" ? node : `${thread.id}_${node}`;
  return visitNo > 1 ? `${base}_v${visitNo}` : base;
};

/** Mermaid flowchart of the route (main thread, plus one subgraph per independent lane). */
export function routeToMermaid(result: ReplayResult, graph: EngineGraph, info: (id: string) => ExportNodeInfo, title: string): string {
  const lines: string[] = [`%% ${title}`, `%% Origen: ${result.origin ?? "(sin elegir)"} - recorrido exportado desde el Explorador interactivo (solo nodos y aristas reales)`, "flowchart TD"];
  for (const thread of result.threads) {
    const indent = thread.id === "main" ? "    " : "        ";
    if (thread.id !== "main") lines.push(`    subgraph ${thread.id}["Carril independiente ${thread.start} (activado por el usuario)"]`);
    thread.visits.forEach((visit) => {
      const n = info(visit.node);
      lines.push(`${indent}${renderNodeShape({ id: mermaidIdOf(thread, visit.node, visit.visitNo), type: n.type as ProcessNode["type"], name: n.name })}`);
    });
    thread.visits.forEach((visit, i) => {
      if (i === 0 || !visit.via) return;
      const prev = thread.visits[i - 1];
      const edge = graph.edgeById[visit.via.edge];
      lines.push(`${indent}${renderEdgeLine({ from: mermaidIdOf(thread, prev.node, prev.visitNo), to: mermaidIdOf(thread, visit.node, visit.visitNo), ...(edge.condition ? { condition: edge.condition } : {}) })}`);
    });
    if (thread.id !== "main") lines.push("    end");
  }
  return lines.join("\n") + "\n";
}

export interface RouteStep {
  step: number;
  thread: string;
  node: string;
  name: string;
  type: string;
  actor?: string;
  visitNo: number;
  /** How the thread got here. */
  mode: "INICIO" | "AUTOMATICO" | "DECISION" | "CICLO" | "EVENTO";
  /** Condition of the edge taken to get here (real text). */
  condition?: string;
}

const MODE_LABEL: Record<string, RouteStep["mode"]> = { AUTO: "AUTOMATICO", CHOICE: "DECISION", CYCLE: "CICLO", EVENT: "EVENTO" };

/** The ordered list of visits (nodes and the way each was reached). */
export function routeSteps(result: ReplayResult, graph: EngineGraph, info: (id: string) => ExportNodeInfo): RouteStep[] {
  const rows: { seq: number; row: Omit<RouteStep, "step"> }[] = [];
  for (const thread of result.threads) {
    for (const visit of thread.visits) {
      const n = info(visit.node);
      const edge = visit.via ? graph.edgeById[visit.via.edge] : undefined;
      rows.push({
        seq: visit.seq,
        row: {
          thread: thread.id,
          node: visit.node,
          name: n.name,
          type: n.type,
          ...(n.actorName ? { actor: n.actorName } : {}),
          visitNo: visit.visitNo,
          mode: visit.via ? MODE_LABEL[visit.via.mode] : "INICIO",
          ...(edge?.condition ? { condition: edge.condition } : {}),
        },
      });
    }
  }
  return rows.sort((a, b) => a.seq - b.seq).map((r, i) => ({ step: i + 1, ...r.row }));
}

/** Plain-text list of the nodes and decisions of the route. */
export function routeToText(result: ReplayResult, graph: EngineGraph, info: (id: string) => ExportNodeInfo, title: string): string {
  const out: string[] = [title, `Origen: ${result.origin ?? "(sin elegir)"}`, `Decisiones tomadas: ${result.decisions}`, "", "Nodos recorridos (en orden):"];
  for (const s of routeSteps(result, graph, info)) {
    const how = s.mode === "INICIO" ? "inicio" : s.mode === "DECISION" ? `decisión [${s.condition ?? ""}]` : s.mode === "AUTOMATICO" ? `automático${s.condition ? ` [${s.condition}]` : ""}` : s.mode === "CICLO" ? `ciclo confirmado${s.condition ? ` [${s.condition}]` : ""}` : `evento externo${s.condition ? ` [${s.condition}]` : ""}`;
    out.push(`${String(s.step).padStart(3, " ")}. ${s.thread === "main" ? "" : `(${s.thread}) `}${s.node} · ${s.name}${s.actor ? ` — ${s.actor}` : ""} · ${how}${s.visitNo > 1 ? ` · visita ${s.visitNo}` : ""}`);
  }
  out.push("", "Decisiones elegidas por el usuario:");
  let n = 0;
  for (const a of result.actionLog) {
    if (a.action.type !== "CHOOSE") continue;
    const edge = graph.edgeById[a.edge ?? ""];
    n++;
    out.push(`${String(n).padStart(3, " ")}. ${a.node} · ${info(a.node).name} → ${edge?.condition ?? "(sin condición)"} → ${edge?.to ?? ""}`);
  }
  if (n === 0) out.push("  (ninguna todavía)");
  return out.join("\n") + "\n";
}

/** JSON of the route: the user actions (enough to reproduce it) and the visits. */
export function routeToJson(result: ReplayResult, graph: EngineGraph, info: (id: string) => ExportNodeInfo, meta: { process: string; version: string; start: string; includeUncertain: boolean }, actions: unknown[]): string {
  return JSON.stringify({ ...meta, origin: result.origin ?? null, decisions: result.decisions, actions, steps: routeSteps(result, graph, info) }, null, 2) + "\n";
}
