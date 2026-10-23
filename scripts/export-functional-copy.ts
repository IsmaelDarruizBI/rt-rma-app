/**
 * DC02: generates the functional copy of business/ for a consuming repository
 * (rt-rma-mvp) from an exact commit of this repository, the single source of
 * truth. The copy is the content of that commit, never of the working tree,
 * plus a manifest (business/FUNCTIONAL_SOURCE.json) that identifies the
 * source commit and the SHA-256 of every file. scripts/verify-functional-copy.mjs
 * checks a copy against its manifest (and, optionally, against the commit).
 *
 * Usage:
 *   npm run export:functional-copy -- --to <dir> [--commit <ref>] [--allow-dirty]
 *
 * <dir> is the root of the consuming repository: the copy is written to
 * <dir>/business/, replacing what is there (files that are not in the commit
 * are removed). By default it refuses to export while business/ has
 * uncommitted changes, so the copy always matches a reviewed commit.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST = "FUNCTIONAL_SOURCE.json";
export const SOURCE_DIR = "business";

export interface FunctionalManifest {
  notice: string;
  generated_by: string;
  source_repository: string;
  source_commit: string;
  source_ref: string;
  generated_at: string;
  files: { path: string; bytes: number; sha256: string }[];
}

function git(args: string[], cwd: string): Buffer {
  return execFileSync("git", args, { cwd, maxBuffer: 256 * 1024 * 1024 });
}

/** SHA-256 of a file's text with line endings normalized to LF (a checkout may convert them). */
export function contentHash(content: Buffer): string {
  return createHash("sha256").update(content.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function exportFunctionalCopy(options: { to: string; commit?: string; allowDirty?: boolean; repo?: string }): FunctionalManifest {
  const repo = options.repo ?? process.cwd();
  const ref = options.commit ?? "HEAD";
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`], repo).toString().trim();
  if (!options.allowDirty) {
    const dirty = git(["status", "--porcelain", "--", SOURCE_DIR], repo).toString().trim();
    if (dirty) throw new Error(`${SOURCE_DIR}/ tiene cambios sin commitear; la copia debe salir de un commit revisado:\n${dirty}`);
  }
  let origin = "";
  try {
    origin = git(["remote", "get-url", "origin"], repo).toString().trim();
  } catch {
    origin = "(sin remote origin)";
  }
  const paths = git(["ls-tree", "-r", "--name-only", commit, "--", SOURCE_DIR], repo).toString().split("\n").filter(Boolean);
  if (paths.length === 0) throw new Error(`el commit ${commit} no tiene ${SOURCE_DIR}/`);

  const target = join(options.to, SOURCE_DIR);
  const keep = new Set(paths.map((p) => join(options.to, p)));
  for (const existing of walk(target)) if (!keep.has(existing)) rmSync(existing);

  const files: FunctionalManifest["files"] = [];
  for (const path of paths) {
    const content = git(["show", `${commit}:${path}`], repo);
    const out = join(options.to, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
    files.push({ path: relative(SOURCE_DIR, path).replace(/\\/g, "/"), bytes: content.length, sha256: contentHash(content) });
  }
  const manifest: FunctionalManifest = {
    notice: "Copia GENERADA de la definicion funcional. No editar a mano: los cambios se hacen en el repositorio de origen y se vuelve a generar la copia (DC02).",
    generated_by: "rt-rma-app/scripts/export-functional-copy.ts",
    source_repository: origin,
    source_commit: commit,
    source_ref: ref,
    generated_at: new Date().toISOString(),
    files,
  };
  writeFileSync(join(target, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const to = arg("to");
  if (!to) {
    console.error("Uso: npm run export:functional-copy -- --to <dir> [--commit <ref>] [--allow-dirty]");
    process.exit(2);
  }
  try {
    const manifest = exportFunctionalCopy({ to, commit: arg("commit"), allowDirty: process.argv.includes("--allow-dirty") });
    console.log(`OK: ${manifest.files.length} archivos de ${SOURCE_DIR}/ del commit ${manifest.source_commit} copiados a ${join(to, SOURCE_DIR)} con ${MANIFEST}.`);
  } catch (error) {
    console.error(`ERROR: ${(error as Error).message}`);
    process.exit(1);
  }
}
