/** Deterministic deep normalization of the snapshot: sorted keys, sorted arrays, nulls not absences. */

/** Array keys whose elements have a domain sort order, keyed for deep-walk dispatch. */
const ARRAY_SORTERS: Record<string, (a: Record<string, unknown>, b: Record<string, unknown>) => number> = {
  repos: byFields(["createdAt", "name"]),
  commits: byFields(["date", "sha"]),
  sampled: byFields(["date", "sha"]),
  releases: byFields(["publishedAt", "tag"]),
  manifests: byFields(["date", "sha"]),
  notes: byFields(["code", "message"]),
  topDirs: byFields(["path"]),
  prs: byFields(["number"]),
  issues: byFields(["number"]),
};

/**
 * Build a comparator for record fields in the given priority order.
 * @param fields - field names, most significant first
 * @returns a stable comparator over the fields
 */
function byFields(fields: string[]): (a: Record<string, unknown>, b: Record<string, unknown>) => number {
  return (a, b) => {
    for (const field of fields) {
      const av = String(a[field] ?? "");
      const bv = String(b[field] ?? "");

      if (av !== bv) {
        return av.localeCompare(bv);
      }
    }

    return 0;
  };
}

/**
 * Deep-normalize a snapshot candidate for deterministic output.
 * Every object is rebuilt with alphabetically sorted keys; known collection
 * arrays are sorted by a domain comparator; missing stats entries become null
 * (never 0 or []). The result is plain JSON-safe data.
 * @param value - any JSON-decoded snapshot candidate
 * @returns the normalized value with sorted keys throughout
 */
export function normalizeSnapshot(value: unknown): unknown {
  return walk(value, "root");
}

/**
 * Recursively normalize one value.
 * @param value - any JSON value
 * @param key - the object key this value came from ("root" at the top level)
 * @returns the normalized value
 */
function walk(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => walk(item, key));
    const sorter = ARRAY_SORTERS[key];

    return sorter !== undefined ? [...items].sort(sorter as never) : items;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (key === "stats") {
      return normalizeStats(record);
    }

    const result: Record<string, unknown> = {};

    for (const field of Object.keys(record).sort()) {
      result[field] = walk(record[field], field);
    }

    return result;
  }

  return value;
}

/**
 * Normalize the stats block: keep the three known entries present, null when
 * GitHub did not provide them, sorted keys, entries deep-walked.
 * @param record - raw stats object
 * @returns stats with all three keys present
 */
function normalizeStats(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of ["codeFrequency", "commitActivity", "punchCard"].sort()) {
    const raw = record[field];

    result[field] = raw === undefined ? null : walk(raw, field);
  }

  for (const field of Object.keys(record).sort()) {
    if (!(field in result)) {
      result[field] = walk(record[field], field);
    }
  }

  return result;
}
