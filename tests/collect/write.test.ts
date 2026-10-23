import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeSnapshot } from "../../scripts/collect/write.ts";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();

    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function tempOut(): string {
  const dir = mkdtempSync(join(tmpdir(), "write-snapshot-"));
  dirs.push(dir);

  return dir;
}

function makeSnapshot(collectedAt: string, commitShas: string[]): Record<string, unknown> {
  return {
    meta: {
      username: "u",
      collectedAt,
      range: { from: "2019-01-01", to: "2026-10-23" },
      timezone: "Europe/Moscow",
      includePrivate: false,
      generatorVersion: "1.0.0",
      source: "api",
    },
    repos: commitShas.map((sha) => ({ commits: [{ sha, date: "2020-01-01T00:00:00Z" }] })),
  };
}

describe("writeSnapshot", () => {
  it("writes latest.json and the dated file with normalized stable content", () => {
    const out = tempOut();
    const result = writeSnapshot(out, "u", makeSnapshot("2026-10-23T10:00:00.000Z", ["aa11111"]));

    expect(result.written).toBe(true);
    const latest = readFileSync(join(out, "latest.json"), "utf8");
    const dated = readFileSync(join(out, "u-2026-10-23.json"), "utf8");
    expect(latest).toBe(dated);
    expect(latest).toContain('"username":"u"');
    expect(latest).toContain('"sha":"aa11111"');
  });

  it("is a no-op for a rerun that only changes collectedAt (byte-identical runs)", () => {
    const out = tempOut();
    writeSnapshot(out, "u", makeSnapshot("2026-10-23T10:00:00.000Z", ["aa11111"]));
    const before = readFileSync(join(out, "latest.json"), "utf8");

    const result = writeSnapshot(out, "u", makeSnapshot("2026-10-23T12:30:00.000Z", ["aa11111"]));

    expect(result.written).toBe(false);
    expect(result.reusedCollectedAt).toBe("2026-10-23T10:00:00.000Z");
    expect(readFileSync(join(out, "latest.json"), "utf8")).toBe(before);
  });

  it("rewrites when the payload actually changed", () => {
    const out = tempOut();
    writeSnapshot(out, "u", makeSnapshot("2026-10-23T10:00:00.000Z", ["aa11111"]));

    const result = writeSnapshot(out, "u", makeSnapshot("2026-10-23T12:30:00.000Z", ["bb22222"]));

    expect(result.written).toBe(true);
    expect(readFileSync(join(out, "latest.json"), "utf8")).toContain("bb22222");
    expect(readFileSync(join(out, "u-2026-10-23.json"), "utf8")).toContain("bb22222");
  });

  it("keeps the existing latest.json untouched when nothing was written before", () => {
    const out = tempOut();
    expect(existsSync(join(out, "latest.json"))).toBe(false);

    expect(writeSnapshot(out, "u", makeSnapshot("2026-10-23T10:00:00.000Z", ["aa11111"])).written).toBe(true);
  });
});
