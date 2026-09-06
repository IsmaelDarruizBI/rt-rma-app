/**
 * Validates a business process YAML file against the JSON Schema contract.
 *
 * This is structural validation only (shape of the YAML). It does not
 * check cross-file references (actors, rules, or edge from/to targets).
 */
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { parse } from "yaml";

const SCHEMA_FILE = "business/schemas/process.schema.json";
const PROCESS_FILE = "business/processes/repair-management.yaml";

function main(): void {
  const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf8"));
  const data = parse(readFileSync(PROCESS_FILE, "utf8"));

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    console.error(`Validacion fallida: ${PROCESS_FILE}`);
    for (const error of validate.errors ?? []) {
      const path = error.instancePath || "(raiz)";
      console.error(`  ${path} ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`OK: ${PROCESS_FILE} es valido segun ${SCHEMA_FILE}`);
}

main();
