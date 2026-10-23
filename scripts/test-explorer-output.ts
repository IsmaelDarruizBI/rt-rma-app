/**
 * Tests of what the interactive route explorer PRODUCES: the progressive diagram geometry, the exports
 * (Mermaid, list, JSON) and the generated, self-contained HTML. The navigation logic itself is tested in
 * scripts/test-explorer.ts; the page running in a real browser in scripts/test-explorer-browser.ts.
 *
 * Run: npm run test:interactive:v1.4   (the HTML checks need npm run generate:interactive:v1.4 first)
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildBrowserBundle, interactiveStem } from "./generate-interactive-viewer";
import { routeToJson, routeToMermaid, routeToText } from "./lib/explorer-export";
import type { Action, ReplayResult } from "./lib/explorer-engine";
import { COL_GAP, layoutRoute, MIN_GAP, NODE_W, wrapText } from "./lib/explorer-layout";
import { ACTORS_FILE, createKit, FEATURES_FILE, PROCESS_FILE, RULES_FILE, SCENARIOS_FILE } from "./lib/explorer-testkit";
import { edgeKey as edgeKeyCore, renderEdgeLine as renderEdgeLineCore, renderNodeShape as renderNodeShapeCore } from "./lib/process-core";
import { buildFlowchartBody, edgeKey, renderEdgeLine, renderNodeShape, type ProcessNode } from "./lib/process-model";
import type { Scenario } from "./lib/scenario-model";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 10).join("\n       ")}`);
  }
}

const kit = createKit();
const { model, scenarios, data, graph, run, nodesOf, driveScenario, randomWalk } = kit;
const scenario = (id: string): Scenario => scenarios.find((s) => s.id === id) as Scenario;

const nodeInfoOf = (id: string) => ({ id, type: data.nodes[id].type, name: data.nodes[id].name, actorName: data.nodes[id].actor?.name });
const layoutOf = (r: ReplayResult) => layoutRoute(r, { nodeInfo: nodeInfoOf, conditionOf: (e) => data.edges[e]?.condition });
type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** HP-REP-001 stopped while the technical thread is executing, with the Reception lane activated. */
function routeWithLane(): { actions: Action[]; result: ReplayResult } {
  const hp = driveScenario(scenario("HP-REP-001"));
  const upto = hp.actions.findIndex((_, i) => nodesOf(run(hp.actions.slice(0, i + 1))).includes("PROC-REP-190"));
  const actions: Action[] = [...hp.actions.slice(0, upto + 1), { type: "ACTIVATE_LANE", start: "EVT-REP-003", lane: "lane1" }];
  return { actions, result: run(actions) };
}

console.log("\nExplorador interactivo: diagrama progresivo y exportaciones\n");

// ----------------------------------------------------------------------------- layout
check("el diagrama contiene exactamente una caja por visita, sin superposiciones, con una flecha entre visitas consecutivas", () => {
  const results: ReplayResult[] = [];
  for (let seed = 1; seed <= 40; seed++) results.push(randomWalk(seed, seed % 2 === 0, 120).result);
  results.push(driveScenario(scenario("HP-REP-001")).result);
  results.push(routeWithLane().result);
  for (const r of results) {
    const l = layoutOf(r);
    assert.equal(l.boxes.length, r.threads.reduce((n, t) => n + t.visits.length, 0), "una caja por visita");
    for (let i = 0; i < l.boxes.length; i++) {
      for (let j = i + 1; j < l.boxes.length; j++) assert.ok(!overlaps(l.boxes[i], l.boxes[j]), `cajas superpuestas ${l.boxes[i].key} / ${l.boxes[j].key}`);
    }
    for (const t of r.threads) {
      const boxes = l.boxes.filter((b) => b.thread === t.id);
      boxes.forEach((b, i) => {
        assert.equal(b.node, t.visits[i].node);
        if (i > 0) assert.ok(b.y - (boxes[i - 1].y + boxes[i - 1].h) >= MIN_GAP, "separacion minima entre cajas consecutivas");
        // the text always fits inside the box
        const last = b.actorBaseline ?? b.nameBaselines[b.nameBaselines.length - 1];
        assert.ok(last + 4 <= b.h, `el texto de ${b.key} cabe en la caja`);
      });
      assert.equal(l.links.filter((k) => k.thread === t.id).length, Math.max(0, boxes.length - 1), "una flecha entre cada par de visitas consecutivas");
    }
    for (const k of l.links) {
      assert.ok(k.y2 > k.y1, "las flechas avanzan hacia abajo");
      assert.ok(k.labelLines.length === 0 || (k.labelY - 12 >= k.y1 - 1 && k.labelY + k.labelLines.length * 14 <= k.y2 + 4), "la etiqueta de la condicion cabe entre las dos cajas");
      const real = data.edges[k.edgeId];
      assert.ok(real, "cada flecha es una arista real");
      assert.equal(k.labelLines.join(" "), (real.condition ?? "").split(/\s+/).filter(Boolean).join(" "), "la etiqueta es la condicion real, sin recortar");
    }
    for (const g of l.ghosts) for (const b of l.boxes) assert.ok(!overlaps(g, b), "el recuadro pendiente no tapa una caja");
    for (const b of l.boxes) {
      assert.ok(b.x >= l.bounds.x && b.x + b.w <= l.bounds.x + l.bounds.w && b.y >= l.bounds.y && b.y + b.h <= l.bounds.y + l.bounds.h, "todo cabe en los limites");
    }
  }
});

check("un carril independiente ocupa su propia columna, a la altura de su activacion, unido por un conector que no es una arista", () => {
  const l = layoutOf(routeWithLane().result);
  assert.equal(l.headers.length, 1);
  assert.equal(l.connectors.length, 1);
  assert.ok(l.boxes.filter((b) => b.thread === "lane1").every((b) => b.x === NODE_W + COL_GAP), "columna propia");
  assert.match(l.connectors[0].labelLines.join(" "), /no es una arista del modelo/);
  assert.ok(l.links.every((k) => k.edgeId !== ""), "los conectores no se mezclan con las aristas reales");
});

check("las visitas repetidas de un nodo se distinguen en el diagrama (visita n de m)", () => {
  const l = layoutOf(driveScenario(scenario("VAR-REP-031")).result);
  assert.deepEqual(l.boxes.filter((b) => b.node === "PROC-REP-265").map((b) => b.visitBadge), ["visita 1 de 3", "visita 2 de 3", "visita 3 de 3"]);
  assert.ok(l.boxes.filter((b) => b.node === "PROC-REP-300").every((b) => b.visitBadge === undefined), "un nodo visitado una sola vez no lleva insignia");
});

check("el ajuste de texto no altera nada: ni recorta ni inventa palabras", () => {
  for (const n of model.nodes) for (const width of [20, 31, 40]) assert.equal(wrapText(n.name, width).join("").replace(/\s+/g, ""), n.name.replace(/\s+/g, ""));
  for (const e of model.edges) if (e.condition) assert.equal(wrapText(e.condition, 30).join("").replace(/\s+/g, ""), e.condition.replace(/\s+/g, ""));
});

// ----------------------------------------------------------------------------- exports
check("15) ningun recorrido exportado contiene nodos o aristas inventados (Mermaid, lista y JSON)", () => {
  const unmermaid = (id: string): string => id.replace(/^lane\d+_/, "").replace(/_v\d+$/, "");
  const samples: ReplayResult[] = [];
  for (let seed = 1; seed <= 40; seed++) samples.push(randomWalk(seed, seed % 2 === 0, 140).result);
  for (const id of ["HP-REP-001", "HP-REP-002", "HP-REP-003", "VAR-REP-030", "VAR-REP-031", "VAR-REP-032"]) samples.push(driveScenario(scenario(id)).result);
  samples.push(routeWithLane().result);
  for (const r of samples) {
    const mmd = routeToMermaid(r, graph, nodeInfoOf, "t");
    const visits = r.threads.reduce((n, t) => n + t.visits.length, 0);
    const nodeLines = mmd.split("\n").filter((l) => /^\s*[A-Za-z0-9_-]+(\[|\(|\{)/.test(l));
    const edgeLines = mmd.split("\n").filter((l) => /-->/.test(l));
    assert.equal(nodeLines.length, visits, "un nodo por visita");
    assert.equal(edgeLines.length, visits - r.threads.length, "una arista por transicion");
    for (const l of nodeLines) {
      const m = /^\s*([A-Za-z0-9_-]+)(?:\[|\(\(\(|\(\[|\{\{|\{)"(.*)"(?:\]|\)\)\)|\]\)|\}\}|\})\s*$/.exec(l);
      assert.ok(m, `linea de nodo ilegible: ${l}`);
      const real = model.nodes.find((n) => n.id === unmermaid((m as RegExpExecArray)[1]));
      assert.ok(real, `nodo inventado: ${l}`);
      assert.equal((m as RegExpExecArray)[2], real?.name.replace(/"/g, "'"), "el nombre es el real");
    }
    for (const l of edgeLines) {
      const m = /^\s*([A-Za-z0-9_-]+) -->(?:\|(.*)\|)? ([A-Za-z0-9_-]+)\s*$/.exec(l);
      assert.ok(m, `linea de arista ilegible: ${l}`);
      const [, from, cond, to] = m as RegExpExecArray;
      const real = model.edges.find((e) => e.from === unmermaid(from) && e.to === unmermaid(to) && (e.condition ?? "").replace(/"/g, "'") === (cond ?? ""));
      assert.ok(real, `arista inventada: ${l}`);
    }
    assert.ok(!/no es una arista/.test(mmd.replace(/%%[^\n]*/g, "")), "el conector del carril no se exporta como arista");
    const text = routeToText(r, graph, nodeInfoOf, "t");
    for (const t of r.threads) for (const v of t.visits) assert.ok(text.includes(v.node), `la lista incluye ${v.node}`);
    assert.equal((text.match(/^ *\d+\. PROC-REP-\d+ · .* → .* → /gm) ?? []).length, r.decisions, "una linea por decision elegida");
    const json = JSON.parse(routeToJson(r, graph, nodeInfoOf, { process: "PROC-REP", version: "1.4", start: "EVT-REP-001", includeUncertain: true }, [])) as { steps: { node: string }[]; decisions: number };
    assert.equal(json.steps.length, visits);
    assert.equal(json.decisions, r.decisions);
    for (const st of json.steps) assert.ok(model.nodes.some((n) => n.id === st.node));
  }
});

check("el Mermaid exportado reutiliza los helpers del generador: mismas formas de nodo y de arista", () => {
  assert.equal(renderNodeShapeCore, renderNodeShape, "process-model reexporta process-core");
  assert.equal(renderEdgeLineCore, renderEdgeLine);
  assert.equal(edgeKeyCore, edgeKey);
  const mmd = routeToMermaid(driveScenario(scenario("HP-REP-002")).result, graph, nodeInfoOf, "t");
  for (const n of ["PROC-REP-010", "PROC-REP-250", "EVT-REP-999"]) assert.ok(mmd.includes(renderNodeShape(model.nodes.find((x) => x.id === n) as ProcessNode)), `forma de ${n}`);
  assert.ok(mmd.includes(renderEdgeLine({ from: "PROC-REP-250", to: "PROC-REP-290", condition: "No" })));
});

// ----------------------------------------------------------------------------- generated HTML
console.log("\nHTML generado\n");
const HTML_FILE = "generated/viewer/repair-management-interactive-v1.4.html";
if (!existsSync(HTML_FILE)) {
  console.log(`  SKIP el HTML no existe (${HTML_FILE}); ejecute npm run generate:interactive:v1.4`);
} else {
  const html = readFileSync(HTML_FILE, "utf8");
  const client = readFileSync("scripts/viewer/explorer-client.js", "utf8");

  check("16) el HTML es autocontenido: sin backend, sin CDN y sin recursos externos", () => {
    assert.ok(!/<script[^>]+\ssrc=/i.test(html), "ningun <script src>");
    assert.ok(!/<link[^>]+\shref=/i.test(html), "ningun <link href>");
    assert.ok(!/@import/i.test(html), "ningun @import");
    assert.ok(!/<(img|iframe|audio|video|source|embed|object)[^>]+\ssrc=/i.test(html), "ningun recurso incrustado remoto");
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|importScripts|sendBeacon)\b/.test(client), "el cliente no hace pedidos de red");
    // the embedded data block is DESCRIPTIVE text of the Source of Truth (a node text mentions a website); only code can load resources
    const code = html.replace(/<script type="application\/json" id="explorer-data">[\s\S]*?<\/script>/, "");
    const urls = (code.match(/https?:\/\/[^\s"'<>)]+/g) ?? []).filter((u) => !/^https?:\/\/(www\.)?w3\.org\//.test(u));
    assert.deepEqual([...new Set(urls)], [], "sin URLs externas en el codigo (solo el namespace SVG)");
    assert.ok(!/<a\s[^>]*href=["']https?:/i.test(client), "el cliente no genera enlaces externos: los textos del modelo se muestran como texto");
    assert.ok(!/mermaidAPI|mermaid\.initialize|window\.mermaid/.test(html), "no embebe la libreria Mermaid: el diagrama es SVG propio");
    assert.ok(html.length < 2_000_000, `tamano razonable (${html.length} bytes), sin librerias pesadas`);
  });

  check("el HTML esta actualizado respecto del Source of Truth y del codigo del explorador", () => {
    const m = /<script type="application\/json" id="explorer-data">([\s\S]*?)<\/script>/.exec(html);
    assert.ok(m, "bloque de datos");
    const embedded = JSON.parse((m as RegExpExecArray)[1]) as typeof data;
    assert.deepEqual(embedded.meta.sources, [PROCESS_FILE, RULES_FILE, ACTORS_FILE, FEATURES_FILE, SCENARIOS_FILE], "declara sus cinco fuentes");
    const expected = JSON.parse(JSON.stringify({ ...data, meta: { ...data.meta, sources: embedded.meta.sources } }));
    assert.deepEqual(embedded, expected, "los datos embebidos son los del Source of Truth actual");
    assert.ok(html.includes(buildBrowserBundle()), "contiene el motor, el layout y los exportadores actuales");
    assert.ok(html.includes(client), "contiene el cliente actual");
    assert.ok(html.includes(readFileSync("scripts/viewer/explorer.css", "utf8")), "contiene los estilos actuales");
    assert.match(html, /<title>Rosario Tecno — Explorador de Recorridos V1\.4<\/title>/);
  });

  check("el HTML tiene los controles pedidos: origen, decisiones, estado, volver, reiniciar, ajustar, recorrido completo, exportar, zoom y paneles", () => {
    for (const id of ["b-origin", "b-decisions", "b-state", "btn-back", "btn-reset", "btn-fit", "btn-full", "btn-export", "zoom-in", "zoom-out", "sec-current", "sec-history", "sec-node", "sec-lanes", "sec-settings", "sec-help"]) {
      assert.ok(html.includes(`id="${id}"`), id);
    }
    for (const kind of ["mermaid", "text", "json", "svg", "png"]) assert.ok(html.includes(`data-export="${kind}"`), `exportar ${kind}`);
    assert.match(html, /@media \(max-width: 900px\)/, "responsive");
    assert.ok(html.includes("Rosario Tecno") && html.includes("Explorador de Recorridos V1.4"));
  });

  check("el JavaScript del cliente y del motor es sintacticamente valido", () => {
    assert.doesNotThrow(() => new Function(client));
    assert.doesNotThrow(() => new Function(buildBrowserBundle()));
  });
}

check("17) los viewers existentes no presentan regresiones: sus salidas se conservan y el explorador no las pisa", () => {
  for (const f of ["generated/viewer/repair-management-v1.4.html", "generated/viewer/repair-management-cliente-externo-v1.4.html", "generated/mermaid/repair-management-v1.4.mmd", "generated/mermaid/repair-management-cliente-externo-v1.4.mmd"]) {
    assert.ok(existsSync(f), `${f} sigue existiendo`);
  }
  // the shared Mermaid body is still exactly what the existing generator wrote
  const mmd = readFileSync("generated/mermaid/repair-management-v1.4.mmd", "utf8");
  for (const line of buildFlowchartBody(model)) assert.ok(line === "" || mmd.includes(line), `el .mmd general contiene: ${line}`);
  assert.equal(interactiveStem("repair-management-v1.4"), "repair-management-interactive-v1.4");
  assert.equal(interactiveStem("repair-management"), "repair-management-interactive");
  assert.ok(!readFileSync("generated/viewer/repair-management-v1.4.html", "utf8").includes("explorer-data"), "el viewer general no cambio");
});

if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: all explorer output tests passed.");
