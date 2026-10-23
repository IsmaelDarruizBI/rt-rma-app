/**
 * Generates the "Explorador interactivo de recorridos": a self-contained HTML that lets the user BUILD a route
 * of the business process by choosing, at every fork, one of the alternatives that really exist.
 *
 *   tsx scripts/generate-interactive-viewer.ts [processFile] [rulesFile] [actorsFile] [featuresFile] [scenariosFile]
 *
 * The defaults are the V1.4 files; the output name derives from the process file
 * (repair-management-v1.4.yaml -> generated/viewer/repair-management-interactive-v1.4.html).
 *
 * YAML remains the single source of truth: this script only READS it (scripts/lib/explorer-data.ts) and never
 * writes anything but the HTML. The navigation logic (scripts/lib/explorer-engine.ts), the diagram geometry
 * (explorer-layout.ts), the exports (explorer-export.ts) and the Mermaid helpers (process-core.ts) are PURE
 * TypeScript modules: they are transpiled here and embedded, so the page runs exactly the code the tests run.
 *
 * The HTML is autocontained: no backend, no CDN, no network (the page does not even embed Mermaid: the progressive
 * diagram is drawn as SVG by scripts/viewer/explorer-client.js). It opens with a double click.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import ts from "typescript";
import { buildExplorerData } from "./lib/explorer-data";
import type { FeatureModel } from "./lib/feature-model";
import { loadYaml, type Actor, type BusinessRule, type ProcessModel } from "./lib/process-model";
import type { ScenarioModel } from "./lib/scenario-model";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const PROCESS_FILE = args[0] ?? join("business", "processes", "repair-management-v1.4.yaml");
const RULES_FILE = args[1] ?? join("business", "rules", "business-rules-v1.4.yaml");
const ACTORS_FILE = args[2] ?? join("business", "actors", "actors.yaml");
const FEATURES_FILE = args[3] ?? join("business", "features", "repair-management-features-v1.4.yaml");
const SCENARIOS_FILE = args[4] ?? join("business", "scenarios", "repair-management-scenarios-v1.4.yaml");

/** repair-management-v1.4 -> repair-management-interactive-v1.4 */
export function interactiveStem(stem: string): string {
  return stem.replace(/^(.*?)(-v\d.*)?$/, (_m, base: string, version: string | undefined) => `${base}-interactive${version ?? ""}`);
}
const OUTPUT_FILE = join("generated", "viewer", `${interactiveStem(basename(PROCESS_FILE, ".yaml"))}.html`);

/** Pure browser-safe modules, in dependency order. */
export const BROWSER_MODULES = ["process-core", "explorer-engine", "explorer-layout", "explorer-export"] as const;

/** Transpiles the pure modules to a tiny CommonJS registry and exposes them as window.ExplorerBundle. */
export function buildBrowserBundle(): string {
  const parts = BROWSER_MODULES.map((name) => {
    const source = readFileSync(join("scripts", "lib", `${name}.ts`), "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, removeComments: true },
    }).outputText;
    return `__M[${JSON.stringify(name)}] = (function (require) { var exports = {}; ${js}\n return exports; })(__req);`;
  });
  return [
    "var __M = {};",
    'function __req(p) { var n = String(p).replace(/^\\.\\//, ""); if (!__M[n]) throw new Error("módulo no empaquetado: " + p); return __M[n]; }',
    ...parts,
    'window.ExplorerBundle = { engine: __M["explorer-engine"], layout: __M["explorer-layout"], exporter: __M["explorer-export"] };',
  ].join("\n");
}

/** JSON that is safe inside a <script> element (no literal "<"). */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildHtml(dataJson: string, title: string, version: string): string {
  const css = readFileSync(join("scripts", "viewer", "explorer.css"), "utf8");
  const client = readFileSync(join("scripts", "viewer", "explorer-client.js"), "utf8");
  const bundle = buildBrowserBundle();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style id="explorer-css">
${css}
</style>
</head>
<body>
<header id="app-header">
  <div class="title">
    <div class="eyebrow">Rosario Tecno</div>
    <h1>Explorador de Recorridos V${escapeHtml(version)}</h1>
  </div>
  <div class="status">
    <span class="badge neutral" id="b-origin">Origen: sin elegir</span>
    <span class="badge" id="b-decisions">0 decisiones tomadas</span>
    <span class="badge" id="b-state">Esperando decisión</span>
  </div>
  <div class="controls">
    <button class="btn" id="btn-back" type="button" title="Deshace la última acción (atajo: Retroceso)">← Volver</button>
    <button class="btn" id="btn-reset" type="button" title="Elimina todo el recorrido y vuelve al evento inicial">↺ Reiniciar</button>
    <button class="btn" id="btn-fit" type="button" title="Encuadra todo el recorrido en la pantalla">Ajustar vista</button>
    <button class="btn" id="btn-full" type="button" title="Muestra siempre el recorrido completo en lugar de seguir el último nodo">Ver recorrido completo</button>
    <button class="btn primary" id="btn-export" type="button">Exportar ▾</button>
    <div id="export-menu">
      <button type="button" data-export="mermaid">Diagrama Mermaid (.mmd)</button>
      <button type="button" data-export="text">Lista de nodos y decisiones (.txt)</button>
      <button type="button" data-export="json">Recorrido reproducible (.json)</button>
      <button type="button" data-export="svg">Imagen vectorial (.svg)</button>
      <button type="button" data-export="png">Imagen (.png)</button>
    </div>
  </div>
</header>
<div id="layout">
  <main id="stage">
    <svg id="canvas" role="img" aria-label="Recorrido construido paso a paso"><g id="viewport"></g></svg>
    <div id="zoom-controls">
      <button class="btn" id="zoom-in" type="button" aria-label="Acercar">+</button>
      <button class="btn" id="zoom-out" type="button" aria-label="Alejar">−</button>
    </div>
    <details id="legend">
      <summary>Leyenda</summary>
      <div class="row"><svg width="38" height="8"><line x1="0" y1="4" x2="38" y2="4" class="edge-line CHOICE"/></svg> decisión elegida por el usuario</div>
      <div class="row"><svg width="38" height="8"><line x1="0" y1="4" x2="38" y2="4" class="edge-line AUTO"/></svg> transición automática</div>
      <div class="row"><svg width="38" height="8"><line x1="0" y1="4" x2="38" y2="4" class="edge-line CYCLE"/></svg> repetición de un ciclo confirmada</div>
      <div class="row"><svg width="38" height="8"><line x1="0" y1="4" x2="38" y2="4" class="edge-line EVENT"/></svg> evento externo ocurrido</div>
      <div class="row">Cada visita repetida de un nodo es una caja nueva («visita 2 de 3»). El recuadro punteado es lo que el recorrido espera ahora.</div>
    </details>
  </main>
  <aside id="sidebar">
    <section id="sec-current"></section>
    <section id="sec-history"></section>
    <section id="sec-node"></section>
    <section id="sec-lanes"></section>
    <section id="sec-settings"></section>
    <section id="sec-help"></section>
  </aside>
</div>
<script type="application/json" id="explorer-data">${dataJson}</script>
<script>
${bundle}
</script>
<script>
${client}
</script>
</body>
</html>
`;
}

function main(): void {
  const model = loadYaml<ProcessModel>(PROCESS_FILE);
  const rules = loadYaml<{ rules: BusinessRule[] }>(RULES_FILE).rules;
  const actors = loadYaml<{ actors: Actor[] }>(ACTORS_FILE).actors;
  const features = loadYaml<FeatureModel>(FEATURES_FILE);
  const scenarios = loadYaml<ScenarioModel>(SCENARIOS_FILE).scenarios;
  const sources = [PROCESS_FILE, RULES_FILE, ACTORS_FILE, FEATURES_FILE, SCENARIOS_FILE].map((p) => p.replace(/\\/g, "/"));
  const data = buildExplorerData({ model, rules, actors, features, scenarios, sources });
  const title = `Rosario Tecno — Explorador de Recorridos V${model.process.version}`;
  const html = buildHtml(embedJson(data), title, model.process.version);
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, html, "utf8");
  console.log(`Interactive route explorer generated: ${OUTPUT_FILE}`);
}

// Importable by the tests (buildBrowserBundle / buildHtml); runs only when executed as a script.
if (process.argv[1] && /generate-interactive-viewer\.(ts|js)$/.test(process.argv[1].replace(/\\/g, "/"))) main();
