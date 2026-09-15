/**
 * Generates a self-contained, interactive HTML viewer for the business
 * process: the same Mermaid diagram as generate-mermaid.ts, plus a click
 * -> detail panel resolving actor and business-rule references.
 *
 * YAML remains the single source of truth. This script only reads
 * business/processes, business/actors and business/rules and renders them;
 * it never introduces new process information.
 *
 * It additionally reads an optional end-to-end traceability example
 * (traceability/examples/*.yaml) purely for visualization: when the node
 * it points to is selected, the viewer renders the demo cascade next to
 * the regular node detail. Those example artifacts are NOT business
 * process data and are never written back into business/processes.
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

// Proof-of-concept only (branch `test`): a single traceability example,
// not a general traceability system. See traceability/README.md.
const TRACEABILITY_EXAMPLE_FILE = join("traceability", "examples", "create-repair-order.yaml");

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

// --- Traceability example (proof of concept, branch `test` only) ---------

interface TraceabilityItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  actor?: string;
  file?: string;
  symbol?: string;
}

interface TraceabilityLink {
  from: string;
  to: string;
  relation: string;
}

interface TraceabilityModel {
  source: { node: string };
  items: TraceabilityItem[];
  links: TraceabilityLink[];
}

interface CascadeStep {
  id: string;
  type: string;
  name: string;
  description?: string;
  file?: string;
  snippet?: string;
}

function loadTraceabilityExample(filePath: string): TraceabilityModel | undefined {
  try {
    return loadYaml<TraceabilityModel>(filePath);
  } catch {
    // The example is optional: no traceability demo yet is not an error.
    return undefined;
  }
}

/**
 * Extracts the source of a top-level `def <symbolName>(...):` Python
 * function: from its `def` line up to (but not including) the next
 * non-indented, non-blank line, or end of file. First skips past the
 * signature by tracking parenthesis depth, since a PEP 8 multi-line
 * signature commonly closes with `)` back at column 0 - which would
 * otherwise look like the end of the function. Best-effort and
 * intentionally simple: good enough for the small, hand-written demo file
 * this reads from.
 */
function extractFunctionSnippet(filePath: string, symbolName: string): string | undefined {
  let source: string;
  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }

  const lines = source.split("\n");
  const startIndex = lines.findIndex((line) => line.startsWith(`def ${symbolName}(`));
  if (startIndex === -1) return undefined;

  let parenDepth = 0;
  let signatureEnd = startIndex;
  for (let i = startIndex; i < lines.length; i++) {
    for (const char of lines[i]) {
      if (char === "(") parenDepth++;
      if (char === ")") parenDepth--;
    }
    if (parenDepth <= 0) {
      signatureEnd = i;
      break;
    }
  }

  let endIndex = lines.length;
  for (let i = signatureEnd + 1; i < lines.length; i++) {
    const line = lines[i];
    const isIndentedOrBlank = line.trim() === "" || line.startsWith(" ") || line.startsWith("\t");
    if (!isIndentedOrBlank) {
      endIndex = i;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trimEnd();
}

/**
 * Builds, per source business-process-node id, the full cascade to show in
 * the "Trazabilidad E2E - DEMO" panel section: the process node itself
 * followed by each linked traceability item, in link order. Assumes a
 * single linear chain per source, which is all this proof of concept needs;
 * a future many-to-many traceability system would replace this.
 */
function buildTraceabilityCascades(
  model: ProcessModel,
  traceability: TraceabilityModel | undefined
): Record<string, CascadeStep[]> {
  if (!traceability) return {};

  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const itemsById = new Map(traceability.items.map((item) => [item.id, item]));
  const nextByFrom = new Map(traceability.links.map((link) => [link.from, link.to]));

  const sourceId = traceability.source.node;
  const sourceNode = nodesById.get(sourceId);
  if (!sourceNode) {
    console.warn(`Traceability demo: nodo de origen no encontrado en el proceso: ${sourceId}`);
    return {};
  }

  const cascade: CascadeStep[] = [
    {
      id: sourceNode.id,
      type: "business_process",
      name: sourceNode.name,
      description: sourceNode.description,
    },
  ];

  const visited = new Set<string>([sourceId]);
  let currentId = sourceId;
  for (;;) {
    const nextId = nextByFrom.get(currentId);
    if (!nextId || visited.has(nextId)) break;

    const item = itemsById.get(nextId);
    if (!item) {
      console.warn(`Traceability demo: item no encontrado: ${nextId}`);
      break;
    }

    const snippet =
      item.type === "code" && item.file && item.symbol
        ? extractFunctionSnippet(item.file, item.symbol)
        : undefined;

    cascade.push({
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      file: item.file,
      snippet,
    });

    visited.add(nextId);
    currentId = nextId;
  }

  return { [sourceId]: cascade };
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
  #toolbar button:hover { background: var(--accent-soft); color: var(--accent); }
  #toolbar #zoom-reset { color: var(--text-muted); font-weight: 500; font-size: 12px; }

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

  .badge.demo { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
  .cascade-section h2 { display: flex; align-items: center; gap: 8px; }
  .cascade-step {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    background: #fafafe;
  }
  .cascade-type {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
  }
  .cascade-id { font-size: 11px; color: var(--text-faint); margin-top: 1px; }
  .cascade-name { font-size: 14px; font-weight: 650; margin-top: 4px; color: var(--text); }
  .cascade-desc { font-size: 12.5px; color: var(--text-muted); margin-top: 4px; line-height: 1.45; }
  .cascade-file { font-size: 11.5px; color: var(--text-muted); margin-top: 6px; font-family: ui-monospace, Consolas, monospace; }
  .cascade-arrow { text-align: center; color: var(--text-faint); font-size: 14px; margin: 4px 0; }
  .cascade-code {
    margin: 8px 0 0;
    padding: 8px 10px;
    background: #101322;
    color: #e2e4f0;
    border-radius: var(--radius-sm);
    font-size: 11.5px;
    line-height: 1.5;
    overflow-x: auto;
    font-family: ui-monospace, Consolas, monospace;
    white-space: pre;
  }

  #diagram-pane::-webkit-scrollbar, #detail-pane::-webkit-scrollbar { width: 10px; height: 10px; }
  #diagram-pane::-webkit-scrollbar-thumb, #detail-pane::-webkit-scrollbar-thumb {
    background: #d3d5db; border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
  }

  @media (max-width: 800px) {
    #layout { flex-direction: column; }
    #diagram-pane { height: 52vh; border-right: none; border-bottom: 1px solid var(--border); }
    #detail-pane { flex: 1 1 auto; max-width: 100%; }
    #app-header .badges { flex-wrap: wrap; justify-content: flex-end; }
  }
`;

const CLIENT_SCRIPT = `
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

  function panelBody() {
    return document.querySelector("#detail-pane .panel-inner");
  }

  var CASCADE_TYPE_LABELS = {
    business_process: "Business Process",
    feature: "Feature",
    user_story: "User Story",
    system_action: "System Action",
    functional_requirement: "Functional Requirement",
    technical_requirement: "Technical Requirement",
    task: "Task",
    code: "Code"
  };

  function renderCascadeStep(step, isLast) {
    var label = CASCADE_TYPE_LABELS[step.type] || step.type;
    var html = '<div class="cascade-step">' +
      '<div class="cascade-type">' + escapeHtml(label) + "</div>" +
      '<div class="cascade-id">' + escapeHtml(step.id) + "</div>" +
      '<div class="cascade-name">' + escapeHtml(step.name) + "</div>" +
      (step.description ? '<div class="cascade-desc">' + escapeHtml(step.description) + "</div>" : "") +
      (step.file ? '<div class="cascade-file">' + escapeHtml(step.file) + "</div>" : "") +
      (step.snippet ? '<pre class="cascade-code"><code>' + escapeHtml(step.snippet) + "</code></pre>" : "") +
      "</div>";
    return html + (isLast ? "" : '<div class="cascade-arrow">&#8595;</div>');
  }

  function renderTraceabilityCascade(cascade) {
    var steps = cascade.map(function (step, index) {
      return renderCascadeStep(step, index === cascade.length - 1);
    }).join("");
    return '<hr class="divider">' +
      '<div class="cascade-section">' +
      '<h2>Trazabilidad E2E <span class="badge demo">DEMO</span></h2>' +
      '<p class="hint">Ejemplo de trazabilidad de punta a punta a partir de este nodo. ' +
      "No es una especificacion funcional ni una arquitectura tecnica aprobada.</p>" +
      steps +
      "</div>";
  }

  function renderProcessSummary() {
    var p = PROCESS_INFO;
    var html = '<h2>Proceso</h2>' +
      '<div class="field"><div class="field-value big">' + escapeHtml(p.name) + "</div></div>" +
      '<div class="field"><div class="field-label">ID</div><div class="field-value">' + escapeHtml(p.id) + "</div></div>" +
      '<div class="field"><div class="field-label">Version</div><div class="field-value">' + escapeHtml(p.version) + "</div></div>" +
      (p.status ? '<div class="field"><div class="field-label">Status</div><div class="field-value">' + escapeHtml(p.status) + "</div></div>" : "") +
      '<hr class="divider">' +
      '<p class="hint">Seleccione un nodo del proceso para ver su detalle.</p>';
    panelBody().innerHTML = html;
  }

  function renderNodeDetail(nodeId) {
    var node = NODES_BY_ID[nodeId];
    if (!node) return;
    var html = "<h2>Detalle del nodo</h2>" +
      '<div class="field"><div class="field-value big">' + escapeHtml(node.name) + "</div>" +
      '<span class="badge type-' + escapeHtml(node.type) + '">' + escapeHtml(node.type) + "</span></div>" +
      '<div class="field"><div class="field-label">ID</div><div class="field-value">' + escapeHtml(node.id) + "</div></div>" +
      '<hr class="divider">' +
      renderActor(node.actor) +
      (node.description ? '<div class="field"><div class="field-label">Descripcion</div><div class="field-value">' + escapeHtml(node.description) + "</div></div>" : "") +
      renderList("Inputs", node.inputs) +
      renderList("Outputs", node.outputs) +
      renderRules(node.rules);
    var cascade = TRACEABILITY_BY_SOURCE[nodeId];
    if (cascade) {
      html += renderTraceabilityCascade(cascade);
    }
    panelBody().innerHTML = html;
  }

  function highlightNode(nodeId) {
    var previous = document.querySelectorAll("#diagram-inner .node.selected");
    for (var i = 0; i < previous.length; i++) previous[i].classList.remove("selected");
    var current = document.getElementById("diagram-inner").querySelector('[id^="flowchart-' + nodeId + '-"]');
    if (current) current.classList.add("selected");
  }

  window.selectNode = function (nodeId) {
    renderNodeDetail(nodeId);
    highlightNode(nodeId);
  };

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
  });
`;

function buildHtml(
  model: ProcessModel,
  resolvedNodes: ResolvedNode[],
  mermaidLib: string,
  traceabilityCascades: Record<string, CascadeStep[]>
): string {
  const nodesById: Record<string, ResolvedNode> = {};
  for (const node of resolvedNodes) {
    nodesById[node.id] = node;
  }

  const diagramSource = buildDiagramSource(model);
  const hasTraceabilityDemo = Object.keys(traceabilityCascades).length > 0;

  return `<!--
  AUTO-GENERATED FILE.
  DO NOT EDIT MANUALLY.
  SOURCE:
  - ${PROCESS_FILE.replace(/\\/g, "/")}
  - ${ACTORS_FILE.replace(/\\/g, "/")}
  - ${RULES_FILE.replace(/\\/g, "/")}
  ${hasTraceabilityDemo ? `- ${TRACEABILITY_EXAMPLE_FILE.replace(/\\/g, "/")} (trazabilidad E2E, proof of concept)` : ""}
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
      </div>
      <div id="diagram-inner">Cargando diagrama...</div>
    </div>
    <div id="detail-pane"><div class="panel-inner"></div></div>
  </div>
  <script>${mermaidLib}</script>
  <script>
    var PROCESS_INFO = ${embedJson(model.process)};
    var NODES_BY_ID = ${embedJson(nodesById)};
    var DIAGRAM_SOURCE = ${embedJson(diagramSource)};
    var TRACEABILITY_BY_SOURCE = ${embedJson(traceabilityCascades)};
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

  const traceabilityExample = loadTraceabilityExample(TRACEABILITY_EXAMPLE_FILE);
  const traceabilityCascades = buildTraceabilityCascades(model, traceabilityExample);

  const html = buildHtml(model, resolvedNodes, mermaidLib, traceabilityCascades);

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, html, "utf8");

  console.log(`Process viewer generated: ${OUTPUT_FILE}`);
}

main();
