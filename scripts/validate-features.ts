/**
 * Validates a Feature Definition YAML file against the JSON Schema contract.
 *
 * This is structural validation only (shape of the YAML), same scope as
 * validate-process.ts: it does not confirm that process_nodes exist in
 * repair-management.yaml, that business_rules exist in
 * business-rules.yaml, or that source_process matches the real Business
 * Process. That referential/integrity validation lives in
 * validate-references.ts, which runs after this script.
 *
 * It additionally checks, locally within this file, that no Feature id is
 * declared twice.
 */
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { parse } from "yaml";
import type { FeatureDefinition, FeatureModel } from "./lib/feature-model";

const SCHEMA_FILE = "business/schemas/feature.schema.json";
const FEATURES_FILE = "business/features/repair-management-features.yaml";

function findDuplicateIds(features: FeatureDefinition[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const feature of features) {
    if (seen.has(feature.id)) {
      duplicates.add(feature.id);
    }
    seen.add(feature.id);
  }
  return [...duplicates];
}

function main(): void {
  const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf8"));
  const data = parse(readFileSync(FEATURES_FILE, "utf8")) as FeatureModel;

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  let hasErrors = false;

  if (!validate(data)) {
    hasErrors = true;
    console.error(`Validacion fallida: ${FEATURES_FILE}`);
    for (const error of validate.errors ?? []) {
      const path = error.instancePath || "(raiz)";
      console.error(`  ${path} ${error.message}`);
    }
  }

  if (Array.isArray(data.features)) {
    const duplicateIds = findDuplicateIds(data.features);
    if (duplicateIds.length > 0) {
      hasErrors = true;
      console.error(`IDs de Feature duplicados en ${FEATURES_FILE}:`);
      for (const id of duplicateIds) {
        console.error(`  ${id}`);
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`OK: ${FEATURES_FILE} es valido segun ${SCHEMA_FILE}`);
}

main();
