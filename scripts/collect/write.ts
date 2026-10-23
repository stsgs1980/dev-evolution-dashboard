/** Atomic, idempotent snapshot writing: latest.json and a dated file per day. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeSnapshot } from "./normalize.ts";

/** What one write call did. */
export interface WriteResult {
  /** True when at least one file was created or replaced. */
  written: boolean;
  /** collectedAt reused from the previous latest.json, when payload is unchanged. */
  reusedCollectedAt: string | null;
}

/**
 * Write the snapshot to outDir atomically and idempotently.
 * latest.json is byte-identical between reruns over the same data: when the
 * payload (ignoring meta.collectedAt) did not change, the previous timestamp is
 * reused and nothing is rewritten. The dated file <user>-<YYYY-MM-DD>.json
 * mirrors latest.json content for its own day.
 * @param outDir - target directory (created when missing)
 * @param user - GitHub username, part of the dated file name
 * @param snapshot - normalized snapshot value with the fresh collectedAt
 * @returns what was written and whether a timestamp was reused
 */
export function writeSnapshot(outDir: string, user: string, snapshot: unknown): WriteResult {
  mkdirSync(outDir, { recursive: true });

  const content = encode(snapshot);
  const latestPath = join(outDir, "latest.json");
  const previous = readJson(latestPath);

  if (previous !== null && payloadEquals(previous, snapshot)) {
    const reusedCollectedAt = collectAtOf(previous);

    if (reusedCollectedAt !== null) {
      makeSureDatedFile(outDir, user, reusedCollectedAt, content);

      return { written: false, reusedCollectedAt };
    }
  }

  writeAtomic(latestPath, content);
  writeAtomic(datedPath(outDir, user, collectAtOf(snapshot) ?? ""), content);

  return { written: true, reusedCollectedAt: null };
}

/**
 * Serialize a snapshot deterministically (normalize provides sorted keys).
 * @param value - snapshot value
 * @returns compact JSON text
 */
function encode(value: unknown): string {
  return JSON.stringify(normalizeSnapshot(value));
}

/**
 * Write a file through a temp sibling plus rename, so a crash cannot truncate it.
 * @param path - final destination
 * @param content - full file content
 * @returns void
 */
function writeAtomic(path: string, content: string): void {
  const temp = `${path}.tmp`;

  writeFileSync(temp, content, "utf8");
  renameSync(temp, path);
}

/**
 * Read a JSON file, returning null for absence and for garbage.
 * @param path - file to read
 * @returns the decoded value or null
 */
function readJson(path: string): unknown {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/**
 * Whether two snapshots are the same payload ignoring meta.collectedAt.
 * @param previous - previously written latest snapshot
 * @param next - the fresh snapshot
 * @returns true when only the collection timestamp differs
 */
function payloadEquals(previous: unknown, next: unknown): boolean {
  const a = stripCollectedAt(previous);
  const b = stripCollectedAt(next);

  return encode(a) === encode(b);
}

/**
 * Remove meta.collectedAt from a snapshot-like value for comparison.
 * @param value - snapshot-like value
 * @returns the value without meta.collectedAt
 */
function stripCollectedAt(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  const clone = JSON.parse(JSON.stringify(value)) as { meta?: Record<string, unknown> };

  delete clone.meta?.collectedAt;

  return clone;
}

/**
 * Extract meta.collectedAt from a snapshot-like value.
 * @param value - snapshot-like value
 * @returns the collectedAt string or null
 */
function collectAtOf(value: unknown): string | null {
  if (value !== null && typeof value === "object" && "meta" in value) {
    const meta = (value as { meta?: { collectedAt?: unknown } }).meta;

    if (typeof meta?.collectedAt === "string") {
      return meta.collectedAt;
    }
  }

  return null;
}

/**
 * Build the dated file path for one collection day.
 * @param outDir - target directory
 * @param user - GitHub username
 * @param collectedAt - ISO timestamp of the collection
 * @returns the full path of the dated file
 */
function datedPath(outDir: string, user: string, collectedAt: string): string {
  return join(outDir, `${user}-${collectedAt.slice(0, 10)}.json`);
}

/**
 * Write the dated file when it does not exist yet (new day after a no-op rerun).
 * @param outDir - target directory
 * @param user - GitHub username
 * @param collectedAt - reused collection timestamp
 * @param content - full file content
 * @returns void
 */
function makeSureDatedFile(outDir: string, user: string, collectedAt: string, content: string): void {
  const path = datedPath(outDir, user, collectedAt);

  if (!existsSync(path)) {
    writeAtomic(path, content);
  }
}
