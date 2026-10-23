import { describe, expect, it } from "vitest";

import { SnapshotSchema, parseSnapshot } from "../../scripts/collect/schema.ts";

/** Valid minimal snapshot used as the base of every schema test case. */
const validSnapshot = {
  meta: {
    username: "stsgs1980",
    collectedAt: "2026-10-23T10:00:00.000Z",
    range: { from: "2019-01-01", to: "2026-10-23" },
    timezone: "Europe/Moscow",
    includePrivate: false,
    generatorVersion: "1.0.0",
    source: "api+git",
  },
  profile: {
    login: "stsgs1980",
    name: null,
    company: null,
    bio: null,
    blog: null,
    location: null,
    createdAt: "2018-03-01T00:00:00Z",
    publicRepos: 50,
    followers: 3,
    following: 5,
  },
  repos: [],
  events: { prs: { totalCount: 12 }, issues: { totalCount: 3 } },
  notes: [],
};

describe("SnapshotSchema", () => {
  it("accepts a valid snapshot", () => {
    expect(SnapshotSchema.parse(validSnapshot)).toBeTruthy();
  });

  it("rejects a snapshot with a missing required field and points at it", () => {
    const broken = JSON.parse(JSON.stringify(validSnapshot)) as Record<string, unknown>;
    delete (broken.meta as Record<string, unknown>).username;

    const result = SnapshotSchema.safeParse(broken);

    expect(result.success).toBe(false);
    if (!result.success) {
      const text = JSON.stringify(result.error.issues);
      expect(text).toContain("meta");
      expect(text).toContain("username");
    }
  });

  it("rejects 0 instead of null for missing statistics", () => {
    const broken = JSON.parse(JSON.stringify(validSnapshot));
    broken.repos = [
      {
        name: "repo",
        isFork: false,
        isArchived: false,
        isPrivate: false,
        createdAt: "2020-01-01T00:00:00Z",
        pushedAt: "2021-01-01T00:00:00Z",
        primaryLanguage: null,
        languages: {},
        stars: 0,
        forks: 0,
        releases: [],
        stats: { commitActivity: 0, codeFrequency: null, punchCard: null },
        commits: [],
        manifests: [],
      },
    ];

    const result = SnapshotSchema.safeParse(broken);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("commitActivity");
    }
  });

  it("rejects an unknown source value", () => {
    const broken = JSON.parse(JSON.stringify(validSnapshot));
    broken.meta.source = "magic";

    expect(SnapshotSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects truncated commits without count and sampled", () => {
    const broken = JSON.parse(JSON.stringify(validSnapshot));
    broken.repos = [
      {
        name: "repo",
        isFork: false,
        isArchived: false,
        isPrivate: false,
        createdAt: "2020-01-01T00:00:00Z",
        pushedAt: "2021-01-01T00:00:00Z",
        primaryLanguage: null,
        languages: {},
        stars: 0,
        forks: 0,
        releases: [],
        stats: { commitActivity: null, codeFrequency: null, punchCard: null },
        commits: { truncated: true },
        manifests: [],
      },
    ];

    expect(SnapshotSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects private repos that keep their real name", () => {
    const broken = JSON.parse(JSON.stringify(validSnapshot));
    broken.meta.includePrivate = true;
    broken.repos = [
      {
        name: "secret-project",
        isFork: false,
        isArchived: false,
        isPrivate: true,
        createdAt: "2020-01-01T00:00:00Z",
        pushedAt: "2021-01-01T00:00:00Z",
        primaryLanguage: null,
        languages: {},
        stars: 0,
        forks: 0,
        releases: [],
        stats: { commitActivity: null, codeFrequency: null, punchCard: null },
        commits: [],
        manifests: [],
      },
    ];

    const result = SnapshotSchema.safeParse(broken);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("private-");
    }
  });
});

describe("parseSnapshot", () => {
  it("returns the parsed value on valid input", () => {
    expect(parseSnapshot(validSnapshot).meta.username).toBe("stsgs1980");
  });

  it("throws with a field path message on broken input", () => {
    expect(() => parseSnapshot({ meta: {} })).toThrow(/meta/);
  });
});
