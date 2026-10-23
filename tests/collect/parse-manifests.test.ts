import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseManifests } from "../../scripts/collect/parse-manifests.ts";

function load(version: string): string {
  return readFileSync(`tests/fixtures/manifests/${version}.package.json`, "utf8");
}

/** One manifest point per fixture, in git history order (oldest first). */
const points = [
  { sha: "aaaa111", date: "2019-05-01T10:00:00Z", content: load("v1") },
  { sha: "bbbb222", date: "2021-06-02T10:00:00Z", content: load("v2") },
  { sha: "cccc333", date: "2024-09-03T10:00:00Z", content: load("v3") },
];

describe("parseManifests", () => {
  it("builds one history point per non-null manifest", () => {
    const manifests = parseManifests(points);

    expect(manifests.map((m) => m.sha)).toEqual(["aaaa111", "bbbb222", "cccc333"]);
    expect(manifests[0]).toEqual({
      sha: "aaaa111",
      date: "2019-05-01T10:00:00Z",
      deps: ["react"],
      devDeps: [],
      scripts: [],
      engines: undefined,
    });
  });

  it("extracts deps, devDeps, scripts and engines from each manifest", () => {
    const manifests = parseManifests(points);

    expect(manifests[1]).toEqual({
      sha: "bbbb222",
      date: "2021-06-02T10:00:00Z",
      deps: ["react", "typescript"],
      devDeps: ["eslint", "vitest"],
      scripts: ["build", "test"],
      engines: undefined,
    });
    expect(manifests[2]).toEqual({
      sha: "cccc333",
      date: "2024-09-03T10:00:00Z",
      deps: ["typescript"],
      devDeps: [],
      scripts: ["build", "lint", "test"],
      engines: { node: ">=22", npm: ">=10" },
    });
  });

  it("skips commits where the manifest does not exist", () => {
    const withGaps = [...points, { sha: "dddd444", date: "2025-01-01T00:00:00Z", content: null }];

    const manifests = parseManifests(withGaps);

    expect(manifests).toHaveLength(3);
    expect(manifests.every((m) => m.sha !== "dddd444")).toBe(true);
  });

  it("sorts points chronologically and name lists alphabetically regardless of input order", () => {
    const later = { sha: "dddd444", date: "2025-01-01T00:00:00Z", content: load("v2") };
    const manifests = parseManifests([later, points[2], points[0], points[1]]);

    expect(manifests.map((m) => m.sha)).toEqual(["aaaa111", "bbbb222", "cccc333", "dddd444"]);
    expect(manifests[3].devDeps).toEqual(["eslint", "vitest"]);
  });
});
