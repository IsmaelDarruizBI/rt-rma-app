/**
 * Runs the generated interactive explorer in HEADLESS CHROME and checks that the page really works:
 *  - its built-in self-test (#selftest) passes at desktop and phone widths, even with name resolution disabled;
 *  - a route computed by the Node engine, restored in the page through its URL, is drawn with exactly the same
 *    visits (same boxes, same state), so the code in the page and the code under test behave identically;
 *  - an invalid link does not break the page;
 *  - the page raises no JavaScript error.
 *
 * Chrome is optional: without it (no CHROME_PATH and no standard install) the test is SKIPPED, not failed.
 *
 * Run: npm run test:interactive:v1.4 (after generate:interactive:v1.4)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Action, ReplayResult } from "./lib/explorer-engine";
import { createKit } from "./lib/explorer-testkit";
import { edgeKey } from "./lib/process-model";
import type { Scenario } from "./lib/scenario-model";

const HTML_FILE = resolve("generated/viewer/repair-management-interactive-v1.4.html");

function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((c): c is string => Boolean(c) && existsSync(c as string));
}

const chrome = findChrome();
if (!chrome) {
  console.log("\nExplorador interactivo en Chrome sin cabeza\n\n  SKIP no se encontro Chrome (defina CHROME_PATH para ejecutarlo)");
  process.exit(0);
}
if (!existsSync(HTML_FILE)) {
  console.log(`\nExplorador interactivo en Chrome sin cabeza\n\n  SKIP el HTML no existe (${HTML_FILE}); ejecute npm run generate:interactive:v1.4`);
  process.exit(0);
}

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 8).join("\n       ")}`);
  }
}

const profile = mkdtempSync(join(tmpdir(), "rt-explorer-chrome-"));
interface Dump {
  dom: string;
  stderr: string;
}
function dump(hash: string, size = "1400,900", extra: string[] = []): Dump {
  const url = pathToFileURL(HTML_FILE).href + hash;
  const r = spawnSync(
    chrome as string,
    ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=20000", "--enable-logging=stderr", "--v=0", ...extra, "--dump-dom", url],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 120000 }
  );
  assert.equal(r.error, undefined, `no se pudo ejecutar Chrome: ${r.error?.message}`);
  return { dom: r.stdout ?? "", stderr: r.stderr ?? "" };
}
const hashOf = (actions: Action[], start = "EVT-REP-001"): string => "#r=" + encodeURIComponent(Buffer.from(JSON.stringify({ s: start, u: true, a: actions }), "utf8").toString("base64"));
const boxes = (dom: string): number => (dom.match(/<g class="node [^"]*" data-key=/g) ?? []).length;
const badge = (dom: string, id: string): string => (new RegExp(`id="${id}">([^<]*)<`).exec(dom)?.[1] ?? "").trim();
const nodeIdsInDom = (dom: string): string[] => [...dom.matchAll(/<g class="node [^"]*" data-key="[^"]*" data-node="([^"]*)"/g)].map((m) => m[1]);
const noJsErrors = (d: Dump): void => {
  const bad = d.stderr.split("\n").filter((l) => /Uncaught|SyntaxError|ReferenceError|TypeError/.test(l));
  assert.deepEqual(bad, [], "la pagina no debe producir errores de JavaScript");
};

const kit = createKit();
const { scenarios, run, driveScenario, nodesOf } = kit;
const scenario = (id: string): Scenario => scenarios.find((s) => s.id === id) as Scenario;

console.log("\nExplorador interactivo en Chrome sin cabeza\n");

check("16) la autoprueba de la pagina pasa en escritorio (navegacion, historial, reversion, reinicio, exportacion, sin recursos externos)", () => {
  const d = dump("#selftest");
  const m = /<pre id="selftest-result">([^<]*)<\/pre>/.exec(d.dom);
  assert.ok(m, "la pagina publico el resultado de su autoprueba");
  const out = JSON.parse((m as RegExpExecArray)[1]) as { passed: number; failed: string[] };
  assert.deepEqual(out.failed, []);
  assert.ok(out.passed >= 15, `verificaciones aprobadas: ${out.passed}`);
  noJsErrors(d);
});

check("16) la autoprueba pasa en una pantalla angosta (responsive) y con la resolucion de nombres deshabilitada (sin red)", () => {
  const d = dump("#selftest", "480,900", ["--host-resolver-rules=MAP * ~NOTFOUND"]);
  const m = /<pre id="selftest-result">([^<]*)<\/pre>/.exec(d.dom);
  assert.ok(m);
  const out = JSON.parse((m as RegExpExecArray)[1]) as { passed: number; failed: string[] };
  assert.deepEqual(out.failed, []);
  assert.ok(out.passed >= 15);
});

/** The CE route that goes through the new nodes: saldo a favor -> 267 -> cycle -> 265 -> 280 -> 270 -> 268 -> end. */
function refundRoute(): { actions: Action[]; result: ReplayResult } {
  const hp = driveScenario(scenario("HP-REP-001"));
  const cobro = edgeKey("PROC-REP-265", "No, saldo pendiente de cobro", "PROC-REP-266");
  const at = hp.actions.findIndex((a) => a.type === "CHOOSE" && a.edge === cobro);
  assert.ok(at > 0, "HP-REP-001 pasa por el cobro de saldo pendiente");
  const actions: Action[] = [...hp.actions.slice(0, at)];
  const next = (cond: string, thread = "main"): void => {
    const p = run(actions).threads[0].pending;
    assert.ok(p, `hay una decision pendiente antes de "${cond}"`);
    const opt = p.options.find((o) => o.condition === cond);
    assert.ok(opt, `alternativa "${cond}" en ${p.node}`);
    actions.push({ type: "CHOOSE", thread, edge: opt.edge });
  };
  next("No, saldo a favor del cliente");
  actions.push({ type: "CONTINUE_CYCLE", thread: "main" });
  next("Si");
  next("Sin saldo a favor pendiente");
  return { actions, result: run(actions) };
}

check("13) la pagina dibuja exactamente el recorrido calculado por el motor, incluidos los nodos nuevos 267 y 268 y el fin", () => {
  const { actions, result } = refundRoute();
  const nodes = nodesOf(result);
  for (const n of ["PROC-REP-267", "PROC-REP-268", "EVT-REP-999"]) assert.ok(nodes.includes(n), `el motor recorre ${n}`);
  assert.equal(result.threads[0].status, "ENDED");
  const d = dump(hashOf(actions));
  assert.equal(boxes(d.dom), nodes.length, "una caja por visita");
  assert.deepEqual(nodeIdsInDom(d.dom), nodes, "las mismas visitas, en el mismo orden");
  assert.equal(badge(d.dom, "b-state"), "Fin del proceso");
  assert.match(badge(d.dom, "b-origin"), /CLIENTE_EXTERNO/);
  assert.equal(badge(d.dom, "b-decisions").startsWith(`${result.decisions} decisiones tomadas`), true, badge(d.dom, "b-decisions"));
  assert.ok(d.dom.includes("visita 2 de 3"), "265 se dibuja tres veces con su numero de visita");
  noJsErrors(d);
});

check("12) con el evento independiente activado, la pagina dibuja el hilo tecnico y el carril de Recepcion por separado", () => {
  const hp = driveScenario(scenario("HP-REP-001"));
  const upto = hp.actions.findIndex((_, i) => nodesOf(run(hp.actions.slice(0, i + 1))).includes("PROC-REP-190"));
  const actions: Action[] = [...hp.actions.slice(0, upto + 1), { type: "ACTIVATE_LANE", start: "EVT-REP-003", lane: "lane1" }];
  const r = run(actions);
  const total = r.threads.reduce((n, t) => n + t.visits.length, 0);
  const d = dump(hashOf(actions));
  assert.equal(boxes(d.dom), total);
  assert.ok(d.dom.includes("Carril independiente · EVT-REP-003"), "encabezado del carril");
  assert.ok(d.dom.includes("no es una arista del modelo"), "el conector se identifica como accion del usuario");
  assert.match(badge(d.dom, "b-state"), /Esperando decisión \(\+1 carril\)/);
  assert.ok(nodeIdsInDom(d.dom).includes("PROC-REP-046") && nodeIdsInDom(d.dom).includes("EVT-REP-003"));
  noJsErrors(d);
});

check("un enlace invalido no rompe la pagina: se parte desde el evento inicial", () => {
  const d = dump("#r=esto-no-es-un-recorrido");
  assert.equal(boxes(d.dom), 2);
  assert.equal(badge(d.dom, "b-state"), "Esperando decisión");
  noJsErrors(d);
});

check("un recorrido cuyas acciones ya no son compatibles se recorta en el primer paso invalido (no deja estados imposibles)", () => {
  const bad: Action[] = [{ type: "CHOOSE", thread: "main", edge: edgeKey("PROC-REP-010", "CLIENTE_EXTERNO", "PROC-REP-030") }, { type: "CHOOSE", thread: "main", edge: "PROC-REP-999::x::PROC-REP-000" }];
  const d = dump(hashOf(bad));
  assert.equal(boxes(d.dom), nodesOf(run(bad.slice(0, 1))).length, "solo se conserva la parte valida");
  noJsErrors(d);
});

rmSync(profile, { recursive: true, force: true });
if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: all explorer browser tests passed.");
