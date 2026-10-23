/**
 * Dependency-free tests for the DC02 functional copy: export from a commit,
 * verify, and prove the verifier detects manual edits, additions, removals,
 * a wrong commit and a commit that is not in the source repository.
 *
 * Run: npm run test:functional-copy
 *
 * Works only in temporary directories; it never touches a consuming repository.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportFunctionalCopy, MANIFEST, type FunctionalManifest } from "./export-functional-copy";
// @ts-expect-error - plain ESM module without type declarations (it must run without tsx in the consuming repository)
import { verifyFunctionalCopy } from "./verify-functional-copy.mjs";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  OK   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${(error as Error).message.split("\n").slice(0, 6).join("\n       ")}`);
  }
}

const repo = process.cwd();
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
const fresh = (): { dir: string; manifest: FunctionalManifest } => {
  const dir = mkdtempSync(join(tmpdir(), "rt-rma-copia-"));
  return { dir, manifest: exportFunctionalCopy({ to: dir, commit: "HEAD", allowDirty: true }) };
};
const verify = (dir: string, opts: Record<string, string> = {}): string[] => verifyFunctionalCopy(dir, opts) as string[];
const tracked = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", "business"], { cwd: repo }).toString().split("\n").filter(Boolean);

console.log("\nDC02 - copia funcional generada con el hash del commit de origen\n");

check("la copia de HEAD contiene exactamente business/ del commit, con el manifiesto del commit de origen", () => {
  const { dir, manifest } = fresh();
  assert.equal(manifest.source_commit, head);
  assert.equal(manifest.files.length, tracked.length);
  assert.ok(manifest.files.some((f) => f.path === "processes/repair-management-v1.4.yaml"));
  assert.deepEqual(verify(dir), []);
  assert.deepEqual(verify(dir, { sourceRepo: repo, expectCommit: head }), [], "procedencia verificada contra el repositorio de origen");
  rmSync(dir, { recursive: true });
});

check("una edicion manual se detecta, pero un cambio solo de fin de linea no", () => {
  const { dir } = fresh();
  const file = join(dir, "business/rules/business-rules-v1.4.yaml");
  writeFileSync(file, readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
  assert.deepEqual(verify(dir), [], "CRLF de un checkout de Windows no cuenta como edicion");
  appendFileSync(file, "# cambio a mano\r\n");
  assert.ok(verify(dir).some((p) => p.includes("business-rules-v1.4.yaml fue modificado a mano")));
  rmSync(dir, { recursive: true });
});

check("un archivo agregado o borrado a mano se detecta", () => {
  const { dir } = fresh();
  writeFileSync(join(dir, "business/rules/regla-local.yaml"), "rules: []\n");
  assert.ok(verify(dir).some((p) => p.includes("regla-local.yaml no figura en el manifiesto")));
  unlinkSync(join(dir, "business/rules/regla-local.yaml"));
  unlinkSync(join(dir, "business/actors/actors.yaml"));
  assert.ok(verify(dir).some((p) => p.includes("falta business/actors/actors.yaml")));
  rmSync(dir, { recursive: true });
});

check("se detectan un commit esperado distinto, un commit inexistente en el origen y la falta de manifiesto", () => {
  const { dir, manifest } = fresh();
  assert.ok(verify(dir, { expectCommit: "0".repeat(40) }).some((p) => p.includes("se esperaba")));
  writeFileSync(join(dir, "business", MANIFEST), JSON.stringify({ ...manifest, source_commit: "f".repeat(40) }));
  assert.ok(verify(dir, { sourceRepo: repo }).some((p) => p.includes("no existe en el repositorio de origen")));
  unlinkSync(join(dir, "business", MANIFEST));
  assert.ok(verify(dir)[0].includes("no es una copia generada"));
  rmSync(dir, { recursive: true });
});

check("volver a exportar sobre una copia existente elimina lo que el commit no tiene y queda verificable", () => {
  const { dir } = fresh();
  writeFileSync(join(dir, "business/sobrante.yaml"), "x: 1\n");
  exportFunctionalCopy({ to: dir, commit: "HEAD", allowDirty: true });
  assert.deepEqual(verify(dir), []);
  rmSync(dir, { recursive: true });
});

check("sin --allow-dirty, la exportacion se niega si business/ tiene cambios sin commitear", () => {
  const dirty = execFileSync("git", ["status", "--porcelain", "--", "business"], { cwd: repo }).toString().trim();
  const dir = mkdtempSync(join(tmpdir(), "rt-rma-copia-"));
  if (dirty) assert.throws(() => exportFunctionalCopy({ to: dir }), /cambios sin commitear/);
  else assert.doesNotThrow(() => exportFunctionalCopy({ to: dir }));
  rmSync(dir, { recursive: true });
});

if (failures > 0) {
  console.log(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nOK: DC02 - todas las verificaciones de la copia funcional pasaron.");
