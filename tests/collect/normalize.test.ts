import { describe, expect, it } from "vitest";

import { normalizeSnapshot } from "../../scripts/collect/normalize.ts";

/** The same logical repo with arrays and record keys in two different orders. */
const repoA = {
  name: "alpha",
  isFork: false,
  isArchived: false,
  isPrivate: false,
  createdAt: "2020-02-01T00:00:00Z",
  pushedAt: "2021-02-01T00:00:00Z",
  primaryLanguage: null,
  languages: { TypeScript: 900, Shell: 100 },
  stars: 1,
  forks: 0,
  releases: [
    { tag: "v2", publishedAt: "2021-02-01T00:00:00Z" },
    { tag: "v1", publishedAt: "2020-02-01T00:00:00Z" },
  ],
  stats: { commitActivity: null, codeFrequency: null, punchCard: null },
  commits: [
    { sha: "bb22222", date: "2020-03-02T00:00:00Z", message: "second", body: "", isMerge: false, parents: 1 },
    { sha: "aa11111", date: "2020-03-01T00:00:00Z", message: "first", body: "", isMerge: false, parents: 1 },
  ],
  manifests: [],
};

const repoB = {
  name: "beta",
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
  commits: [],
  manifests: [],
};

const baseMeta = {
  username: "stsgs1980",
  collectedAt: "2026-10-23T10:00:00.000Z",
  range: { from: "2019-01-01", to: "2026-10-23" },
  timezone: "Europe/Moscow",
  includePrivate: false,
  generatorVersion: "1.0.0",
  source: "api" as const,
};

describe("normalizeSnapshot", () => {
  it("is byte-stable for different input orderings of the same data", () => {
    const input1 = {
      meta: baseMeta,
      profile: { login: "u", publicRepos: 2 },
      repos: [JSON.parse(JSON.stringify(repoA)), JSON.parse(JSON.stringify(repoB))],
    };
    const input2 = {
      meta: { ...baseMeta, source: "api" },
      profile: { publicRepos: 2, login: "u" },
      repos: [JSON.parse(JSON.stringify(repoB)), JSON.parse(JSON.stringify(repoA))],
    };

    expect(JSON.stringify(normalizeSnapshot(input1))).toBe(JSON.stringify(normalizeSnapshot(input2)));
  });

  it("sorts repos by createdAt, commits by date+sha and releases by publishedAt", () => {
    const result = JSON.parse(
      JSON.stringify(
        normalizeSnapshot({
          meta: baseMeta,
          profile: { login: "u", publicRepos: 2 },
          repos: [repoA, repoB],
        }),
      ),
    );

    const [first, second] = result.repos;
    expect(first.name).toBe("beta");
    expect(second.name).toBe("alpha");
    expect(second.commits.map((c: { sha: string }) => c.sha)).toEqual(["aa11111", "bb22222"]);
    expect(second.releases.map((r: { tag: string }) => r.tag)).toEqual(["v1", "v2"]);
    expect(Object.keys(second.languages)).toEqual(["Shell", "TypeScript"]);
  });

  it("keeps null for absent statistics and does not invent 0 or []", () => {
    const result = JSON.parse(
      JSON.stringify(
        normalizeSnapshot({
          meta: baseMeta,
          profile: { login: "u" },
          repos: [
            {
              name: "gamma",
              isFork: false,
              isArchived: true,
              isPrivate: false,
              createdAt: "2019-05-05T00:00:00Z",
              pushedAt: "2019-06-05T00:00:00Z",
              primaryLanguage: "Rust",
              languages: {},
              stars: 0,
              forks: 4,
              releases: [],
              stats: {},
              commits: [],
              manifests: [],
            },
          ],
        }),
      ),
    );

    const repo = result.repos[0];
    expect(repo.stats.commitActivity).toBe(null);
    expect("commitActivity" in repo.stats).toBe(true);
    expect(repo.stats.codeFrequency).toBe(null);
    expect(repo.stats.punchCard).toBe(null);
  });
});
