/** Offline validation entry point: checks a snapshot file against the schema. */
import { readFileSync } from "node:fs";

import { parseSnapshot, USAGE_VALIDATE } from "./collect/schema.ts";

/** Default file checked by `npm run data:validate`. */
const DEFAULT_FILE = "data/snapshot/latest.json";

/**
 * Validate one snapshot file: print [OK] and exit 0, or [FAIL] and exit 1.
 * @param argv - raw argument vector; an optional `--file <path>` overrides the default
 * @returns the process exit code
 */
function validate(argv: string[]): number {
  let path = DEFAULT_FILE;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") {
      const value = argv[i + 1];

      if (value === undefined) {
        process.stderr.write("[FAIL] --file expects a path\n");

        return 2;
      }

      path = value;
      i += 1;
    } else {
      process.stderr.write(`[FAIL] unknown argument: ${argv[i]}; usage: ${USAGE_VALIDATE}\n`);

      return 2;
    }
  }

  let raw: string;

  try {
    raw = readFileSync(path, "utf8");
  } catch {
    process.stderr.write(`[FAIL] ${path} not found; run 'npm run data:collect' first\n`);

    return 1;
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(`[FAIL] ${path} is not valid JSON: ${message}\n`);

    return 1;
  }

  try {
    const snapshot = parseSnapshot(decoded);

    process.stdout.write(`[OK] ${path} is valid: repos=${snapshot.repos.length}, notes=${snapshot.notes.length}\n`);

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(`[FAIL] ${path}: ${message}\n`);

    return 1;
  }
}

try {
  process.exitCode = validate(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`[FAIL] ${message}\n`);
  process.exitCode = 1;
}
