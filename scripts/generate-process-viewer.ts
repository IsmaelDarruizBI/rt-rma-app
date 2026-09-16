/**
 * Generates a self-contained, interactive HTML viewer for the business
 * process: the same Mermaid diagram as generate-mermaid.ts, plus a click
 * -> detail panel resolving actor and business-rule references.
 *
 * YAML remains the single source of truth. This script only reads
 * business/processes, business/actors and business/rules and renders them;
 * it never introduces new process information.
 *
 * Mermaid is embedded inline (from node_modules/mermaid) so the generated
 * HTML also works offline, e.g. on a notebook in a meeting room with no
 * reliable network.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  buildClickDirectives,
  buildFlowchartBody,
  loadYaml,
  type Actor,
  type BusinessRule,
  type ProcessModel,
  type ProcessNode,
} from "./lib/process-model";

const PROCESS_FILE = join("business", "processes", "repair-management.yaml");
const ACTORS_FILE = join("business", "actors", "actors.yaml");
const RULES_FILE = join("business", "rules", "business-rules.yaml");
const MERMAID_LIB_FILE = join("node_modules", "mermaid", "dist", "mermaid.min.js");
const OUTPUT_FILE = join("generated", "viewer", "repair-management.html");

const CLICK_CALLBACK = "selectNode";

type ResolvedActor = { id: string; name: string } | { id: string; missing: true };
type ResolvedRule =
  | { id: string; name: string; description?: string; status?: string }
  | { id: string; missing: true };

interface ResolvedNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  actor?: ResolvedActor;
  inputs?: string[];
  outputs?: string[];
  rules?: ResolvedRule[];
}

function resolveActor(actorId: string, actorsById: Map<string, Actor>): ResolvedActor {
  const actor = actorsById.get(actorId);
  if (!actor) {
    console.warn(`Referencia de actor no encontrada: ${actorId}`);
    return { id: actorId, missing: true };
  }
  return { id: actor.id, name: actor.name };
}

function resolveRules(ruleIds: string[], rulesById: Map<string, BusinessRule>): ResolvedRule[] {
  return ruleIds.map((ruleId) => {
    const rule = rulesById.get(ruleId);
    if (!rule) {
      console.warn(`Referencia de regla no encontrada: ${ruleId}`);
      return { id: ruleId, missing: true };
    }
    return { id: rule.id, name: rule.name, description: rule.description, status: rule.status };
  });
}

function resolveNode(
  node: ProcessNode,
  actorsById: Map<string, Actor>,
  rulesById: Map<string, BusinessRule>
): ResolvedNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    description: node.description,
    actor: node.actor ? resolveActor(node.actor, actorsById) : undefined,
    inputs: node.inputs,
    outputs: node.outputs,
    rules: node.rules ? resolveRules(node.rules, rulesById) : undefined,
  };
}

/** Prevents a literal "</script" inside generated content from closing the enclosing <script> tag. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}

/** Escapes text interpolated directly into the static HTML shell (header title/badges). */
function escapeHtmlStatic(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildDiagramSource(model: ProcessModel): string {
  return [
    "flowchart TD",
    ...buildFlowchartBody(model),
    "",
    ...buildClickDirectives(model.nodes, CLICK_CALLBACK),
  ].join("\n");
}

const STYLES = `
  :root {
    color-scheme: light;
    --bg: #f4f5f7;
    --surface: #ffffff;
    --border: #e5e7eb;
    --text: #1c1f27;
    --text-muted: #6b7280;
    --text-faint: #9aa1ac;
    --accent: #4f46e5;
    --accent-soft: #eef1ff;
    --accent-soft-border: #d9dcff;
    --warning-bg: #fef2f2;
    --warning-border: #fecaca;
    --warning-text: #b91c1c;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06);
    --shadow-md: 0 4px 10px rgba(16, 24, 40, 0.08);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: -apple-system, "Segoe UI Variable", "Segoe UI", system-ui, Roboto, Arial, sans-serif;
    color: var(--text);
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }

  #app-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    z-index: 20;
  }
  #app-header .title { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  #app-header .eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--accent);
  }
  #app-header h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #app-header { flex-wrap: wrap; row-gap: 8px; }
  .search-wrap { position: relative; flex: 1 1 260px; max-width: 360px; min-width: 140px; }
  #node-search {
    width: 100%;
    font: inherit;
    font-size: 13px;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text);
    outline: none;
  }
  #node-search:focus { border-color: var(--accent); background: var(--surface); }
  #search-results {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 320px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    z-index: 30;
    padding: 4px;
  }
  #app-header .badges { display: flex; gap: 6px; flex: 0 0 auto; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid var(--accent-soft-border);
    white-space: nowrap;
  }
  .badge.neutral { background: #f3f4f6; color: var(--text-muted); border-color: var(--border); }
  .badge.status-draft { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .badge.type-activity { background: #eef2ff; color: #4338ca; border-color: #dde1ff; }
  .badge.type-decision { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
  .badge.type-event { background: #f5f3ff; color: #6d28d9; border-color: #e5deff; }
  .badge.type-start, .badge.type-end { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .field > .badge { margin-top: 6px; }

  #layout { flex: 1 1 auto; display: flex; flex-direction: row; min-height: 0; }

  #diagram-pane {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(circle, #dfe1e7 1px, transparent 1px) 0 0 / 20px 20px,
      var(--bg);
    border-right: 1px solid var(--border);
  }
  #diagram-inner {
    transform-origin: top center;
    transition: transform 0.12s ease-out;
    padding: 32px;
    width: max-content;
  }
  #diagram-inner svg { max-width: none !important; height: auto !important; }
  .node.selected > * {
    stroke: var(--accent) !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 6px rgba(79, 70, 229, 0.45));
  }
  .node.context > * { stroke: var(--accent) !important; stroke-width: 1.5px !important; }
  .node.dimmed { opacity: 0.6; transition: opacity 0.15s ease; }
  #diagram-inner.focus-mode .node.dimmed { opacity: 0.15; }
  path.edge-context { stroke: var(--accent) !important; stroke-width: 2px !important; opacity: 1 !important; }
  path.edge-dimmed { opacity: 0.7; transition: opacity 0.15s ease; }
  #diagram-inner.focus-mode path.edge-dimmed { opacity: 0.15; }

  .legend-panel {
    position: sticky;
    bottom: 12px;
    align-self: flex-start;
    margin: 12px;
    width: fit-content;
    max-width: 220px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: 6px 10px;
    font-size: 12px;
    z-index: 10;
  }
  .legend-panel summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--text-muted);
    list-style: none;
  }
  .legend-panel summary::-webkit-details-marker { display: none; }
  .legend-panel summary::before { content: "\\25b8  "; }
  .legend-panel[open] summary::before { content: "\\25be  "; }
  .legend-body { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
  .legend-item { display: flex; align-items: center; gap: 7px; color: var(--text-muted); }
  .legend-swatch {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    border: 1.5px solid var(--text-muted);
    background: var(--surface);
  }
  .legend-swatch.shape-rect { border-radius: 3px; }
  .legend-swatch.shape-diamond { width: 10px; height: 10px; border-radius: 2px; transform: rotate(45deg); }
  .legend-swatch.shape-hexagon {
    border-radius: 0;
    clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  }
  .legend-swatch.shape-circle { border-radius: 50%; }

  #toolbar {
    position: sticky;
    align-self: flex-start;
    top: 12px;
    left: 12px;
    display: inline-flex;
    gap: 2px;
    padding: 4px;
    margin: 12px;
    width: fit-content;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    border: 1px solid var(--border);
    border-radius: 999px;
    box-shadow: var(--shadow-sm);
    z-index: 10;
  }
  #toolbar button {
    font-size: 14px;
    font-weight: 600;
    min-width: 32px;
    padding: 6px 10px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text);
    border-radius: 999px;
    transition: background 0.12s ease;
  }
  #toolbar { flex-wrap: wrap; row-gap: 4px; }
  #toolbar button:hover { background: var(--accent-soft); color: var(--accent); }
  #toolbar #zoom-reset { color: var(--text-muted); font-weight: 500; font-size: 12px; }
  #toolbar .toolbar-divider { width: 1px; align-self: stretch; background: var(--border); margin: 2px 3px; }
  #toolbar .mode-btn { font-size: 11.5px; padding: 6px 10px; color: var(--text-muted); }
  #toolbar .mode-btn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  #toolbar .mode-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  #toolbar .mode-btn:disabled:hover { background: transparent; color: var(--text-muted); }

  #detail-pane {
    flex: 0 0 380px;
    max-width: 42vw;
    overflow-y: auto;
    background: var(--surface);
  }
  #detail-pane .panel-inner { padding: 20px 22px; }
  #detail-pane h2 {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 16px;
    font-weight: 700;
  }
  .field { margin-bottom: 18px; }
  .field-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin-bottom: 3px;
    font-weight: 600;
  }
  .field-value { font-size: 14.5px; line-height: 1.5; color: var(--text); }
  .field-value.big { font-size: 19px; font-weight: 650; line-height: 1.3; }
  .field-sub { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
  .field ul { margin: 4px 0 0; padding-left: 18px; }
  .field li { font-size: 14px; margin-bottom: 3px; color: var(--text); }
  .hint { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
  .warning {
    font-size: 13px;
    color: var(--warning-text);
    background: var(--warning-bg);
    border: 1px solid var(--warning-border);
    border-radius: var(--radius-sm);
    padding: 7px 10px;
  }
  .rule-card {
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 9px 11px;
    margin-bottom: 8px;
    background: #fafafe;
  }
  .rule-card.warning { background: var(--warning-bg); border-color: var(--warning-border); border-left-color: var(--warning-text); }
  .rule-id { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: 0.02em; }
  .rule-name { font-size: 14px; font-weight: 650; margin: 3px 0 4px; color: var(--text); }
  .rule-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 6px; line-height: 1.45; }
  .rule-status { font-size: 10.5px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }

  .nav-list { display: flex; flex-direction: column; gap: 6px; }
  .nav-card, .search-result {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 7px 9px;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .nav-card:hover, .nav-card:focus-visible,
  .search-result:hover, .search-result:focus-visible {
    background: var(--accent-soft);
    border-color: var(--accent-soft-border);
    outline: none;
  }
  .nav-card .nav-id, .search-result .nav-id { font-size: 11px; color: var(--text-faint); margin-top: 2px; }
  .nav-card .nav-name, .search-result .nav-name { font-size: 13.5px; font-weight: 600; color: var(--text); }
  .nav-card .nav-condition {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--accent-soft);
    border-radius: 999px;
    padding: 1px 8px;
    margin-top: 5px;
  }
  .nav-card .nav-condition-value {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--accent);
  }
  .decision-list .nav-condition { font-size: 12px; padding: 2px 10px; }
  .nav-empty { margin: 0; }
  .search-empty { padding: 8px 9px; font-size: 13px; color: var(--text-muted); }

  #diagram-pane::-webkit-scrollbar, #detail-pane::-webkit-scrollbar { width: 10px; height: 10px; }
  #diagram-pane::-webkit-scrollbar-thumb, #detail-pane::-webkit-scrollbar-thumb {
    background: #d3d5db; border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
  }

  @media (max-width: 800px) {
    #layout { flex-direction: column; }
    #diagram-pane { height: 52vh; border-right: none; border-bottom: 1px solid var(--border); }
    #detail-pane { flex: 1 1 auto; max-width: 100%; }
    #app-header .badges { flex-wrap: wrap; justify-content: flex-end; }
    .search-wrap { flex: 1 1 100%; max-width: none; order: 3; }
  }
`;

const CLIENT_SCRIPT = `
  var CURRENT_SELECTED_ID = null;

  var TYPE_LABELS = { event: "Evento", activity: "Actividad", decision: "Decision", start: "Inicio", end: "Fin" };
  var TYPE_SHAPES = { event: "shape-hexagon", activity: "shape-rect", decision: "shape-diamond", start: "shape-circle", end: "shape-circle" };

  function typeLabel(type) {
    return TYPE_LABELS[type] || type;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderList(label, items) {
    if (!items || items.length === 0) return "";
    var lis = items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
    return '<div class="field"><div class="field-label">' + label + '</div><ul>' + lis + "</ul></div>";
  }

  function renderActor(actor) {
    if (!actor) return "";
    if (actor.missing) {
      return '<div class="field"><div class="field-label">Actor</div>' +
        '<div class="warning">Actor no encontrado: ' + escapeHtml(actor.id) + "</div></div>";
    }
    return '<div class="field"><div class="field-label">Actor</div>' +
      '<div class="field-value">' + escapeHtml(actor.name) + "</div>" +
      '<div class="field-sub">' + escapeHtml(actor.id) + "</div></div>";
  }

  function renderRules(rules) {
    if (!rules || rules.length === 0) return "";
    var cards = rules.map(function (rule) {
      if (rule.missing) {
        return '<div class="rule-card warning">Regla no encontrada: ' + escapeHtml(rule.id) + "</div>";
      }
      var desc = rule.description ? '<div class="rule-desc">' + escapeHtml(rule.description) + "</div>" : "";
      var status = rule.status ? '<div class="rule-status">Status: ' + escapeHtml(rule.status) + "</div>" : "";
      return '<div class="rule-card"><div class="rule-id">' + escapeHtml(rule.id) + "</div>" +
        '<div class="rule-name">' + escapeHtml(rule.name) + "</div>" + desc + status + "</div>";
    }).join("");
    return '<div class="field"><div class="field-label">Reglas</div>' + cards + "</div>";
  }

  // --- Navigation derived from EDGES (never duplicated by hand) ----------
  // "Llega desde" and "Continua hacia" are computed straight from EDGES on
  // every render: incoming = EDGES where edge.to === nodeId, outgoing =
  // EDGES where edge.from === nodeId. Nothing about the graph is hardcoded.

  function getIncomingEdges(nodeId) {
    return EDGES.filter(function (edge) { return edge.to === nodeId; });
  }

  function getOutgoingEdges(nodeId) {
    return EDGES.filter(function (edge) { return edge.from === nodeId; });
  }

  function renderNavCard(edge, direction) {
    var otherId = direction === "in" ? edge.from : edge.to;
    var otherNode = NODES_BY_ID[otherId];
    var name = otherNode ? otherNode.name : otherId;
    var condition = edge.condition
      ? '<div class="nav-condition">Condicion: <span class="nav-condition-value">' + escapeHtml(edge.condition) + "</span></div>"
      : "";
    return '<button type="button" class="nav-card" data-nav-node="' + escapeHtml(otherId) + '">' +
      '<div class="nav-name">' + escapeHtml(name) + "</div>" +
      '<div class="nav-id">' + escapeHtml(otherId) + "</div>" +
      condition +
      "</button>";
  }

  function renderNavSection(title, edges, direction, extraListClass) {
    var emptyText = direction === "in" ? "Sin conexiones entrantes." : "Sin conexiones salientes.";
    var body = edges.length
      ? '<div class="nav-list' + (extraListClass ? " " + extraListClass : "") + '">' +
          edges.map(function (edge) { return renderNavCard(edge, direction); }).join("") +
        "</div>"
      : '<p class="hint nav-empty">' + emptyText + "</p>";
    return '<div class="field"><div class="field-label">' + title + "</div>" + body + "</div>";
  }

  function panelBody() {
    return document.querySelector("#detail-pane .panel-inner");
  }

  function renderProcessSummary() {
    var p = PROCESS_INFO;
    var html = '<h2>Proceso</h2>' +
      '<div class="field"><div class="field-value big">' + escapeHtml(p.name) + "</div></div>" +
      '<div class="field"><div class="field-label">ID</div><div class="field-value">' + escapeHtml(p.id) + "</div></div>" +
      '<div class="field"><div class="field-label">Version</div><div class="field-value">' + escapeHtml(p.version) + "</div></div>" +
      (p.status ? '<div class="field"><div class="field-label">Status</div><div class="field-value">' + escapeHtml(p.status) + "</div></div>" : "") +
      '<hr class="divider">' +
      '<p class="hint">Seleccione un nodo del proceso, o use el buscador, para ver su detalle.</p>';
    panelBody().innerHTML = html;
  }

  // Panel order: Nombre, ID+tipo, Actor, Descripcion, navegacion (Llega
  // desde / Continua hacia), Inputs, Outputs, Business Rules. Para nodos
  // decision, "Continua hacia" se muestra primero porque son sus
  // alternativas de decision.
  function renderNodeDetail(nodeId) {
    var node = NODES_BY_ID[nodeId];
    if (!node) return;

    var incoming = getIncomingEdges(nodeId);
    var outgoing = getOutgoingEdges(nodeId);
    var isDecision = node.type === "decision";

    var incomingSection = renderNavSection("Llega desde", incoming, "in");
    var outgoingSection = renderNavSection("Continua hacia", outgoing, "out", isDecision ? "decision-list" : "");
    var navigation = isDecision ? outgoingSection + incomingSection : incomingSection + outgoingSection;

    var html = "<h2>Detalle del nodo</h2>" +
      '<div class="field"><div class="field-value big">' + escapeHtml(node.name) + "</div>" +
      '<span class="badge type-' + escapeHtml(node.type) + '">' + escapeHtml(typeLabel(node.type)) + "</span></div>" +
      '<div class="field"><div class="field-label">ID</div><div class="field-value">' + escapeHtml(node.id) + "</div></div>" +
      '<hr class="divider">' +
      renderActor(node.actor) +
      (node.description ? '<div class="field"><div class="field-label">Descripcion</div><div class="field-value">' + escapeHtml(node.description) + "</div></div>" : "") +
      '<hr class="divider">' +
      navigation +
      '<hr class="divider">' +
      renderList("Inputs", node.inputs) +
      renderList("Outputs", node.outputs) +
      renderRules(node.rules);
    panelBody().innerHTML = html;
  }

  // --- Highlight of the selected node's immediate context -----------------
  // Every node/edge in the rendered SVG gets exactly one of: selected,
  // context (direct predecessor/successor) or dimmed. Predecessors and
  // successors share one "context" style on purpose (kept to a single
  // accent color throughout, per the minimal/professional look this
  // viewer aims for) - direction is still conveyed by the arrowheads and
  // by the "Llega desde" / "Continua hacia" sections themselves.

  function clearHighlights() {
    var container = document.getElementById("diagram-inner");
    var nodes = container.querySelectorAll(".node.selected, .node.context, .node.dimmed");
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove("selected", "context", "dimmed");
    var edgeEls = container.querySelectorAll("path.edge-context, path.edge-dimmed");
    for (var j = 0; j < edgeEls.length; j++) edgeEls[j].classList.remove("edge-context", "edge-dimmed");
  }

  function highlightNode(nodeId) {
    var container = document.getElementById("diagram-inner");
    clearHighlights();

    var contextIds = {};
    getIncomingEdges(nodeId).forEach(function (edge) { contextIds[edge.from] = true; });
    getOutgoingEdges(nodeId).forEach(function (edge) { contextIds[edge.to] = true; });

    var nodeEls = container.querySelectorAll(".node");
    for (var i = 0; i < nodeEls.length; i++) {
      var el = nodeEls[i];
      var id = el.getAttribute("data-id");
      if (id === nodeId) {
        el.classList.add("selected");
      } else if (contextIds[id]) {
        el.classList.add("context");
      } else {
        el.classList.add("dimmed");
      }
    }

    var edgeEls = container.querySelectorAll("path.flowchart-link");
    for (var k = 0; k < edgeEls.length; k++) {
      var edgeEl = edgeEls[k];
      var touches = edgeEl.classList.contains("LS-" + nodeId) || edgeEl.classList.contains("LE-" + nodeId);
      edgeEl.classList.add(touches ? "edge-context" : "edge-dimmed");
    }
  }

  window.selectNode = function (nodeId) {
    CURRENT_SELECTED_ID = nodeId;
    renderNodeDetail(nodeId);
    highlightNode(nodeId);
    var focusBtn = document.getElementById("mode-focus");
    if (focusBtn) focusBtn.disabled = false;
  };

  // Used by direct diagram clicks (no scrolling - the user already sees
  // the node they clicked). Search results and "Llega desde" / "Continua
  // hacia" cards use navigateToNode below instead, which also centers it.
  function navigateToNode(nodeId) {
    window.selectNode(nodeId);
    centerNodeInView(nodeId);
  }

  function wireDetailNavigation() {
    document.getElementById("detail-pane").addEventListener("click", function (event) {
      var target = event.target.closest("[data-nav-node]");
      if (!target) return;
      navigateToNode(target.getAttribute("data-nav-node"));
    });
  }

  // --- Centering -----------------------------------------------------------
  // Scrolls #diagram-pane so the given node ends up roughly centered,
  // without touching the current zoom level. getBoundingClientRect()
  // already reflects the current CSS transform scale, so the delta between
  // the node's on-screen center and the pane's center works at any zoom.
  function centerNodeInView(nodeId) {
    var pane = document.getElementById("diagram-pane");
    var target = document.querySelector('#diagram-inner [data-id="' + nodeId + '"]');
    if (!pane || !target) return;

    var paneRect = pane.getBoundingClientRect();
    var nodeRect = target.getBoundingClientRect();
    var deltaX = (nodeRect.left + nodeRect.width / 2) - (paneRect.left + paneRect.width / 2);
    var deltaY = (nodeRect.top + nodeRect.height / 2) - (paneRect.top + paneRect.height / 2);

    pane.scrollBy({ left: deltaX, top: deltaY, behavior: "smooth" });
  }

  function wireCenterButton() {
    document.getElementById("center-btn").addEventListener("click", function () {
      if (CURRENT_SELECTED_ID) centerNodeInView(CURRENT_SELECTED_ID);
    });
  }

  // --- Fullscreen ------------------------------------------------------------
  function wireFullscreen() {
    var btn = document.getElementById("fullscreen-btn");
    if (!document.documentElement.requestFullscreen) {
      btn.hidden = true;
      return;
    }
    btn.addEventListener("click", function () {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    });
    document.addEventListener("fullscreenchange", function () {
      var active = Boolean(document.fullscreenElement);
      btn.textContent = active ? "⛶ Salir de pantalla completa" : "⛶ Pantalla completa";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  // --- Modo foco -------------------------------------------------------------
  // Purely visual: reuses the same selected/context/dimmed classes that
  // highlightNode() already assigns, just intensifies the "dimmed" opacity
  // via the .focus-mode modifier class (see CSS). No new grafo, no data
  // change - only a viewing preference.
  function setFocusMode(active) {
    document.getElementById("diagram-inner").classList.toggle("focus-mode", active);
    var fullBtn = document.getElementById("mode-full");
    var focusBtn = document.getElementById("mode-focus");
    fullBtn.classList.toggle("active", !active);
    focusBtn.classList.toggle("active", active);
    fullBtn.setAttribute("aria-pressed", active ? "false" : "true");
    focusBtn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function wireFocusToggle() {
    document.getElementById("mode-full").addEventListener("click", function () { setFocusMode(false); });
    document.getElementById("mode-focus").addEventListener("click", function () {
      if (document.getElementById("mode-focus").disabled) return;
      setFocusMode(true);
    });
  }

  // --- Buscador de nodos -------------------------------------------------
  // Simple case-insensitive substring match over id/name, no fuzzy search.
  function closeSearchResults() {
    var results = document.getElementById("search-results");
    results.hidden = true;
    results.innerHTML = "";
  }

  function renderSearchResults(matches) {
    var results = document.getElementById("search-results");
    if (!matches.length) {
      results.innerHTML = '<div class="search-empty">Sin resultados.</div>';
    } else {
      results.innerHTML = matches.map(function (node) {
        return '<button type="button" class="search-result" data-nav-node="' + escapeHtml(node.id) + '">' +
          '<div class="nav-id">' + escapeHtml(node.id) + "</div>" +
          '<div class="nav-name">' + escapeHtml(node.name) + "</div>" +
          "</button>";
      }).join("");
    }
    results.hidden = false;
  }

  function wireSearch() {
    var input = document.getElementById("node-search");
    var results = document.getElementById("search-results");

    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase();
      if (!query) { closeSearchResults(); return; }
      var matches = Object.keys(NODES_BY_ID)
        .map(function (id) { return NODES_BY_ID[id]; })
        .filter(function (node) {
          return node.id.toLowerCase().indexOf(query) !== -1 || node.name.toLowerCase().indexOf(query) !== -1;
        })
        .slice(0, 20);
      renderSearchResults(matches);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        input.value = "";
        closeSearchResults();
        input.blur();
      }
    });

    // Delay so a click on a result (which also blurs the input) still
    // registers before the dropdown disappears.
    input.addEventListener("blur", function () { setTimeout(closeSearchResults, 150); });

    results.addEventListener("click", function (event) {
      var target = event.target.closest("[data-nav-node]");
      if (!target) return;
      var nodeId = target.getAttribute("data-nav-node");
      input.value = "";
      closeSearchResults();
      navigateToNode(nodeId);
    });
  }

  // --- Leyenda -------------------------------------------------------------
  // Derived from the types actually present in NODES_BY_ID - never assumes
  // "start" exists just because the schema allows it.
  function renderLegend() {
    var present = {};
    Object.keys(NODES_BY_ID).forEach(function (id) { present[NODES_BY_ID[id].type] = true; });
    var order = ["start", "event", "activity", "decision", "end"];
    var body = document.getElementById("legend-body");
    body.innerHTML = order
      .filter(function (type) { return present[type]; })
      .map(function (type) {
        var shape = TYPE_SHAPES[type] || "shape-rect";
        return '<div class="legend-item"><span class="legend-swatch ' + shape + '"></span>' + typeLabel(type) + "</div>";
      })
      .join("");
  }

  function computeInitialScale() {
    var pane = document.getElementById("diagram-pane");
    var svg = document.querySelector("#diagram-inner svg");
    if (!svg) return 1.4;
    var naturalWidth = svg.getBoundingClientRect().width;
    var paneWidth = pane.clientWidth;
    if (!naturalWidth || !paneWidth) return 1.4;
    var fit = (paneWidth * 0.6) / naturalWidth;
    return Math.min(1.8, Math.max(1.2, fit));
  }

  function initZoom(defaultScale) {
    var scale = defaultScale;
    var target = document.getElementById("diagram-inner");
    var resetBtn = document.getElementById("zoom-reset");
    function apply() {
      target.style.transform = "scale(" + scale + ")";
      resetBtn.textContent = Math.round(scale * 100) + "%";
    }
    document.getElementById("zoom-in").addEventListener("click", function () {
      scale = Math.min(scale + 0.15, 3);
      apply();
    });
    document.getElementById("zoom-out").addEventListener("click", function () {
      scale = Math.max(scale - 0.15, 0.3);
      apply();
    });
    resetBtn.addEventListener("click", function () {
      scale = defaultScale;
      apply();
    });
    apply();
  }

  document.addEventListener("DOMContentLoaded", function () {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
    mermaid.render("processDiagram", DIAGRAM_SOURCE).then(function (result) {
      var container = document.getElementById("diagram-inner");
      container.innerHTML = result.svg;
      if (result.bindFunctions) result.bindFunctions(container);
      initZoom(computeInitialScale());
    });
    renderProcessSummary();
    renderLegend();
    wireDetailNavigation();
    wireCenterButton();
    wireFullscreen();
    wireFocusToggle();
    wireSearch();
  });
`;

function buildHtml(model: ProcessModel, resolvedNodes: ResolvedNode[], mermaidLib: string): string {
  const nodesById: Record<string, ResolvedNode> = {};
  for (const node of resolvedNodes) {
    nodesById[node.id] = node;
  }

  const diagramSource = buildDiagramSource(model);
  // Passed through as-is (no derived fields) so the viewer's "Llega desde" /
  // "Continua hacia" navigation can compute incoming/outgoing edges via
  // simple edge.to === id / edge.from === id filters, entirely client-side.
  const edges = model.edges;

  return `<!--
  AUTO-GENERATED FILE.
  DO NOT EDIT MANUALLY.
  SOURCE:
  - ${PROCESS_FILE.replace(/\\/g, "/")}
  - ${ACTORS_FILE.replace(/\\/g, "/")}
  - ${RULES_FILE.replace(/\\/g, "/")}
-->
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${model.process.name} - Viewer</title>
<style>${STYLES}</style>
</head>
<body>
  <header id="app-header">
    <div class="title">
      <span class="eyebrow">Rosario Tecno · RMA</span>
      <h1>${escapeHtmlStatic(model.process.name)}</h1>
    </div>
    <div class="search-wrap">
      <input id="node-search" type="text" placeholder="Buscar nodo..." autocomplete="off" spellcheck="false">
      <div id="search-results" hidden></div>
    </div>
    <div class="badges">
      <span class="badge neutral">${escapeHtmlStatic(model.process.id)}</span>
      <span class="badge neutral">v${escapeHtmlStatic(model.process.version)}</span>
      ${model.process.status ? `<span class="badge status-${escapeHtmlStatic(model.process.status)}">${escapeHtmlStatic(model.process.status)}</span>` : ""}
    </div>
  </header>
  <div id="layout">
    <div id="diagram-pane">
      <div id="toolbar">
        <button id="zoom-out" type="button" title="Alejar">-</button>
        <button id="zoom-reset" type="button" title="Restablecer zoom">100%</button>
        <button id="zoom-in" type="button" title="Acercar">+</button>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <button id="center-btn" type="button" title="Centrar en el nodo seleccionado">Centrar</button>
        <button id="fullscreen-btn" type="button" title="Pantalla completa">⛶ Pantalla completa</button>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <button id="mode-full" type="button" class="mode-btn active" aria-pressed="true">Proceso completo</button>
        <button id="mode-focus" type="button" class="mode-btn" aria-pressed="false" disabled title="Seleccione un nodo para habilitar el modo foco">Modo foco</button>
      </div>
      <div id="diagram-inner">Cargando diagrama...</div>
      <details id="legend" class="legend-panel">
        <summary>Leyenda</summary>
        <div id="legend-body" class="legend-body"></div>
      </details>
    </div>
    <div id="detail-pane"><div class="panel-inner"></div></div>
  </div>
  <script>${mermaidLib}</script>
  <script>
    var PROCESS_INFO = ${embedJson(model.process)};
    var NODES_BY_ID = ${embedJson(nodesById)};
    var EDGES = ${embedJson(edges)};
    var DIAGRAM_SOURCE = ${embedJson(diagramSource)};
    ${CLIENT_SCRIPT}
  </script>
</body>
</html>
`;
}

function main(): void {
  const model = loadYaml<ProcessModel>(PROCESS_FILE);
  const actors = loadYaml<{ actors: Actor[] }>(ACTORS_FILE).actors;
  const rules = loadYaml<{ rules: BusinessRule[] }>(RULES_FILE).rules;

  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));

  const resolvedNodes = model.nodes.map((node) => resolveNode(node, actorsById, rulesById));
  const mermaidLib = readFileSync(MERMAID_LIB_FILE, "utf8");

  const html = buildHtml(model, resolvedNodes, mermaidLib);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, html, "utf8");

  console.log(`Process viewer generated: ${OUTPUT_FILE}`);
}

main();
