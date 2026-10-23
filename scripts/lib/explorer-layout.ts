/**
 * Geometry of the progressive diagram of the interactive route explorer.
 *
 * The diagram only contains what the user revealed: one box per VISIT (a node visited twice is two
 * boxes, "visita 2"), the edges taken, a ghost box for what is pending, and one extra column per
 * independent lane. Because only the chosen route is drawn it is a chain per thread, so the layout is
 * exact and cheap: no graph layout engine is needed and nothing outside the route can overlap.
 *
 * Pure (no runtime imports): the browser runs this very file and scripts/test-explorer.ts checks it.
 */
import type { MoveMode, ReplayResult, ThreadRec } from "./explorer-engine";

export const NODE_W = 236;
export const COL_GAP = 150;
export const LINE_H = 15;
export const MIN_GAP = 46;
const CHARS_PER_LINE = 31;
const LABEL_CHARS = 30;

export interface LayoutNodeInfo {
  id: string;
  type: string;
  name: string;
  actorName?: string;
}

export interface LayoutOptions {
  nodeInfo: (id: string) => LayoutNodeInfo;
  conditionOf: (edgeId: string) => string | undefined;
  /** Label of the pending ghost box; defaults are built here so the text is testable. */
  eventLabel?: (node: string) => string | undefined;
}

export interface Box {
  key: string;
  thread: string;
  idx: number;
  node: string;
  visitNo: number;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  idText: string;
  nameLines: string[];
  nameBaselines: number[];
  actorText?: string;
  actorBaseline?: number;
  visitBadge?: string;
  /** The last visit of its thread. */
  current: boolean;
  mode?: MoveMode;
}

export interface Link {
  key: string;
  thread: string;
  from: string;
  to: string;
  kind: MoveMode;
  edgeId: string;
  labelLines: string[];
  x: number;
  y1: number;
  y2: number;
  labelY: number;
}

export interface Ghost {
  thread: string;
  kind: "DECISION" | "CYCLE" | "EXTERNAL" | "DEAD_END" | "RETURNED" | "CLOSED";
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface Connector {
  thread: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelLines: string[];
}

export interface LaneHeader {
  thread: string;
  x: number;
  y: number;
  text: string;
}

export interface Layout {
  boxes: Box[];
  links: Link[];
  ghosts: Ghost[];
  connectors: Connector[];
  headers: LaneHeader[];
  bounds: { x: number; y: number; w: number; h: number };
}

/** Greedy word wrap that never changes the text (long words are split, nothing is truncated). */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let word = raw;
    while (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!line) line = word;
    else if ((line + " " + word).length <= maxChars) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

/** Vertical metrics of a box: baselines of each name line and of the actor line, and the total height. */
export function boxMetrics(nameLines: number, hasActor: boolean): { h: number; nameBaselines: number[]; actorBaseline?: number } {
  const nameBaselines = Array.from({ length: nameLines }, (_, i) => 38 + i * LINE_H);
  const last = nameBaselines[nameLines - 1];
  return hasActor ? { h: last + 16 + 12, nameBaselines, actorBaseline: last + 16 } : { h: last + 14, nameBaselines };
}

function ghostFor(thread: ThreadRec, opts: LayoutOptions): { kind: Ghost["kind"]; lines: string[] } | undefined {
  if (thread.status === "RETURNED") return { kind: "RETURNED", lines: ["Regresa al recorrido principal", `vía ${thread.returnedAt ?? ""}`] };
  if (thread.status === "CLOSED") return { kind: "CLOSED", lines: ["Carril cerrado por el usuario"] };
  if (thread.status === "DEAD_END") {
    const n = thread.hiddenAtEnd?.length ?? 0;
    return { kind: "DEAD_END", lines: ["Sin salidas demostradas", n > 0 ? `${n} alternativa${n === 1 ? "" : "s"} existen pero no se ofrecen` : "El nodo no tiene salidas"] };
  }
  const p = thread.pending;
  if (!p) return undefined;
  if (p.kind === "DECISION") return { kind: "DECISION", lines: ["¿Cómo continúa?", `${p.options.length} alternativas: elegir en el panel`] };
  if (p.kind === "CYCLE") return { kind: "CYCLE", lines: ["Ciclo detectado", `repetir → ${p.cycleTarget ?? ""} (visita ${(p.cycleTargetVisits ?? 0) + 1})`] };
  return { kind: "EXTERNAL", lines: ["Esperando un evento externo", ...wrapText(p.event ?? opts.eventLabel?.(p.node) ?? "", 34)] };
}

export function layoutRoute(result: ReplayResult, opts: LayoutOptions): Layout {
  const boxes: Box[] = [];
  const links: Link[] = [];
  const ghosts: Ghost[] = [];
  const connectors: Connector[] = [];
  const headers: LaneHeader[] = [];
  const totalVisits = new Map<string, number>();
  for (const t of result.threads) for (const v of t.visits) totalVisits.set(`${t.id}:${v.node}`, Math.max(totalVisits.get(`${t.id}:${v.node}`) ?? 0, v.visitNo));

  const mainBoxes = new Map<number, Box>();
  result.threads.forEach((thread, column) => {
    const x = column * (NODE_W + COL_GAP);
    // a lane starts level with the main box it was activated after
    let y = 0;
    if (column > 0) {
      const anchor = mainBoxes.get(thread.activatedAfterMainVisit ?? 0);
      y = (anchor?.y ?? 0) + 6;
      headers.push({ thread: thread.id, x, y: y - 26, text: `Carril independiente · ${thread.start} (activado por el usuario)` });
    }
    let prev: Box | undefined;
    thread.visits.forEach((visit, idx) => {
      const info = opts.nodeInfo(visit.node);
      const nameLines = wrapText(info.name, CHARS_PER_LINE);
      const m = boxMetrics(nameLines.length, Boolean(info.actorName));
      const h = m.h;
      const condition = visit.via ? opts.conditionOf(visit.via.edge) : undefined;
      const labelLines = condition ? wrapText(condition, LABEL_CHARS) : [];
      if (prev) {
        const gap = Math.max(MIN_GAP, 18 + labelLines.length * 14);
        const y1 = prev.y + prev.h;
        y = y1 + gap;
        links.push({
          key: `${thread.id}:${idx}`,
          thread: thread.id,
          from: prev.key,
          to: `${thread.id}:${idx}`,
          kind: visit.via?.mode ?? "AUTO",
          edgeId: visit.via?.edge ?? "",
          labelLines,
          x: x + NODE_W / 2,
          y1,
          y2: y,
          labelY: y1 + (gap - labelLines.length * 14) / 2 + 11,
        });
      }
      const count = totalVisits.get(`${thread.id}:${visit.node}`) ?? 1;
      const box: Box = {
        key: `${thread.id}:${idx}`,
        thread: thread.id,
        idx,
        node: visit.node,
        visitNo: visit.visitNo,
        type: info.type,
        x,
        y,
        w: NODE_W,
        h,
        idText: visit.node,
        nameLines,
        nameBaselines: m.nameBaselines,
        ...(info.actorName ? { actorText: info.actorName, actorBaseline: m.actorBaseline } : {}),
        ...(count > 1 ? { visitBadge: `visita ${visit.visitNo} de ${count}` } : {}),
        current: idx === thread.visits.length - 1,
        ...(visit.via ? { mode: visit.via.mode } : {}),
      };
      boxes.push(box);
      if (column === 0) mainBoxes.set(idx, box);
      prev = box;
    });
    if (prev) {
      const g = ghostFor(thread, opts);
      if (g) {
        const gh = 22 + g.lines.length * 15;
        ghosts.push({ thread: thread.id, kind: g.kind, x, y: prev.y + prev.h + 34, w: NODE_W, h: gh, lines: g.lines });
      }
    }
    if (column > 0) {
      const anchor = mainBoxes.get(thread.activatedAfterMainVisit ?? 0);
      const first = boxes.find((b) => b.thread === thread.id && b.idx === 0);
      if (anchor && first) {
        connectors.push({
          thread: thread.id,
          x1: anchor.x + anchor.w,
          y1: anchor.y + anchor.h / 2,
          x2: first.x,
          y2: first.y + first.h / 2,
          labelLines: wrapText("activado por el usuario (no es una arista del modelo)", 22),
        });
      }
    }
  });

  const xs = [...boxes.map((b) => b.x), ...boxes.map((b) => b.x + b.w), ...ghosts.map((g) => g.x + g.w)];
  const ys = [...boxes.map((b) => b.y + b.h), ...ghosts.map((g) => g.y + g.h), ...headers.map((h) => h.y)];
  const minX = Math.min(0, ...xs);
  const maxX = Math.max(NODE_W, ...xs);
  const minY = Math.min(0, ...headers.map((h) => h.y - 14));
  const maxY = Math.max(0, ...ys);
  return { boxes, links, ghosts, connectors, headers, bounds: { x: minX - 40, y: minY - 30, w: maxX - minX + 80, h: maxY - minY + 70 } };
}
