/** Parse recorded package.json contents into snapshot ManifestPoint history. */
import type { ManifestPoint } from "./schema.ts";

/** A manifest snapshot at one commit, as fed by the git history walker. */
export interface ManifestSource {
  sha: string;
  date: string;
  /** package.json contents at this commit, or null when the file did not exist. */
  content: string | null;
}

/**
 * Turn git history points of package.json into ManifestPoint records.
 * Points are sorted chronologically; commits without a manifest are skipped;
 * package name lists are sorted alphabetically for deterministic output.
 * @param points - manifest sources, oldest first is not required
 * @returns manifest history sorted by date ascending
 */
export function parseManifests(points: ManifestSource[]): ManifestPoint[] {
  const manifests: ManifestPoint[] = [];

  for (const point of [...points].sort((a, b) => a.date.localeCompare(b.date) || a.sha.localeCompare(b.sha))) {
    const manifest = parseOne(point);

    if (manifest !== null) {
      manifests.push(manifest);
    }
  }

  return manifests;
}

/**
 * Parse a single manifest source into one ManifestPoint.
 * @param point - manifest source at one commit
 * @returns the manifest point, or null when the file is missing or not valid JSON
 */
function parseOne(point: ManifestSource): ManifestPoint | null {
  if (point.content === null) {
    return null;
  }

  let json: Record<string, unknown>;

  try {
    json = JSON.parse(point.content) as Record<string, unknown>;
  } catch {
    return null;
  }

  return {
    sha: point.sha,
    date: point.date,
    deps: sortedNames(json.dependencies),
    devDeps: sortedNames(json.devDependencies),
    scripts: sortedNames(json.scripts),
    engines: isRecord(json.engines) ? sortedRecord(json.engines as Record<string, unknown>) : undefined,
  };
}

/**
 * Extract and alphabetically sort package names from a manifest section.
 * @param value - raw dependencies-like section or undefined
 * @returns sorted package names
 */
function sortedNames(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).sort() : [];
}

/**
 * Whether the value is a non-array object.
 * @param value - anything
 * @returns true for record values
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Alphabetically sort an engines-like record by key.
 * @param value - raw record
 * @returns the record with sorted keys
 */
function sortedRecord(value: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key of Object.keys(value).sort()) {
    if (typeof value[key] === "string") {
      result[key] = value[key] as string;
    }
  }

  return result;
}
