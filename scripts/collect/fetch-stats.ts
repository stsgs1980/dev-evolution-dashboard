/** Per-repository statistics endpoints (202-aware) and the releases and languages lists. */
import type { Octokit } from "octokit";

import type { RepoCandidate } from "./fetch-repos.ts";
import { fetchWithBackoff } from "./github-client.ts";

/** Ordered numeric arrays behind RepoSnapshot.stats. */
export interface StatsCandidate {
  commitActivity: number[] | null;
  codeFrequency: [number, number, number][] | null;
  punchCard: [number, number, number][] | null;
}

/** Loose release record before schema normalization. */
export interface ReleaseCandidate {
  tag: string;
  publishedAt: string;
}

/** Everything statistics produced for one repository. */
export interface StatsResult {
  stats: StatsCandidate;
  releases: ReleaseCandidate[];
  languages: Record<string, number>;
  /** Warnings for the snapshot notes, e.g. an endpoint that kept returning 202. */
  warnings: string[];
}

/**
 * Collect all statistics, releases and languages of one repository.
 * Stats endpoints may answer 202 (GitHub is counting) - the backoff loop
 * retries, then reports null and appends a note.
 * @param octokit - configured client
 * @param repo - repository candidate with owner and name
 * @param allowStats - false in anonymous mode to preserve the 60/h quota
 * @returns statistics, releases, languages and warnings
 */
export async function collectStats(octokit: Octokit, repo: RepoCandidate, allowStats: boolean): Promise<StatsResult> {
  const notes: string[] = [];

  if (!allowStats) {
    return {
      stats: { commitActivity: null, codeFrequency: null, punchCard: null },
      releases: [],
      languages: {},
      warnings: [...notes, "stats endpoints skipped in anonymous mode to preserve the 60/h quota"],
    };
  }

  const commitActivity = await fetchNumberArray(octokit, repo, "stats/commit_activity", "commit_activity", notes);
  const codeFrequency = await fetchTuples(octokit, repo, "stats/code_frequency", "code_frequency", notes);
  const punchCard = await fetchTuples(octokit, repo, "stats/punch_card", "punch_card", notes);
  const releases = await fetchReleases(octokit, repo);
  const languages = await fetchLanguages(octokit, repo);

  return { stats: { commitActivity, codeFrequency, punchCard }, releases, languages, warnings: notes };
}

/**
 * Fetch a stats endpoint whose body is an array of plain numbers.
 * @param octokit - configured client
 * @param repo - repository candidate
 * @param suffix - endpoint path suffix, for example `stats/commit_activity`
 * @param label - short label for the note when backoff runs out
 * @returns the numeric array or null after backoff exhaustion
 */
async function fetchNumberArray(
  octokit: Octokit,
  repo: RepoCandidate,
  suffix: string,
  label: string,
  warnings: string[],
): Promise<number[] | null> {
  const outcome = await polledRequest<unknown>(octokit, `GET /repos/{owner}/{repo}/${suffix}`, repo);

  if (outcome.value === null) {
    noteBackoff(warnings, outcome.gaveUp, label);

    return null;
  }

  if (!Array.isArray(outcome.value)) {
    return null;
  }

  return outcome.value.filter((item): item is number => typeof item === "number");
}

/**
 * Fetch a stats endpoint whose body is an array of numeric triples.
 * @param octokit - configured client
 * @param repo - repository candidate
 * @param suffix - endpoint path suffix, for example `stats/punch_card`
 * @param label - short label for the note when backoff runs out
 * @returns numeric triples or null after backoff exhaustion
 */
async function fetchTuples(
  octokit: Octokit,
  repo: RepoCandidate,
  suffix: string,
  label: string,
  warnings: string[],
): Promise<[number, number, number][] | null> {
  const outcome = await polledRequest<unknown>(octokit, `GET /repos/{owner}/{repo}/${suffix}`, repo);

  if (outcome.value === null) {
    noteBackoff(warnings, outcome.gaveUp, label);

    return null;
  }

  if (!Array.isArray(outcome.value)) {
    return null;
  }

  const tuples: [number, number, number][] = [];

  for (const item of outcome.value) {
    if (Array.isArray(item) && item.length === 3 && item.every((part) => typeof part === "number")) {
      tuples.push(item as [number, number, number]);
    }
  }

  return tuples;
}

/**
 * Fetch the releases list of a repository as tag plus publish date.
 * @param octokit - configured client
 * @param repo - repository candidate
 * @returns sorted-later releases normalized by the snapshot writer
 */
async function fetchReleases(octokit: Octokit, repo: RepoCandidate): Promise<ReleaseCandidate[]> {
  const items = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: repo.owner,
    repo: repo.name,
    per_page: 100,
  });

  const releases: ReleaseCandidate[] = [];

  for (const item of items) {
    if (item === null || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const tag = typeof record.tag_name === "string" ? record.tag_name : "";
    const publishedAt = typeof record.published_at === "string" ? record.published_at : "";

    if (tag !== "") {
      releases.push({ tag, publishedAt });
    }
  }

  return releases;
}

/**
 * Fetch the language byte distribution of a repository.
 * @param octokit - configured client
 * @param repo - repository candidate
 * @returns language name to byte count, keys left to the normalizer
 */
async function fetchLanguages(octokit: Octokit, repo: RepoCandidate): Promise<Record<string, number>> {
  try {
    const response = await octokit.rest.repos.listLanguages({ owner: repo.owner, repo: repo.name });
    const languages: Record<string, number> = {};
    const data = response.data as unknown as Record<string, unknown>;

    for (const [language, bytes] of Object.entries(data)) {
      if (typeof bytes === "number") {
        languages[language] = bytes;
      }
    }

    return languages;
  } catch {
    return {};
  }
}

/**
 * One stats request wrapped into the 202-aware retry loop, never throwing.
 * @param octokit - configured client
 * @param route - request route string
 * @param repo - repository candidate for the owner and repo fields
 * @returns the request outcome with the decoded body on success
 */
async function polledRequest<T>(
  octokit: Octokit,
  route: string,
  repo: RepoCandidate,
): Promise<{ value: T | null; gaveUp: boolean; status?: number }> {
  try {
    return await fetchWithBackoff<T>(async () => {
      const attempt = await octokit.request(route, { owner: repo.owner, repo: repo.name });

      return { status: attempt.status, body: (attempt.status >= 300 ? null : attempt.data) as T | null };
    });
  } catch {
    return { value: null, gaveUp: false, status: 0 };
  }
}

/**
 * Append the counting-note when the endpoint kept returning 202.
 * @param warnings - collector for snapshot notes
 * @param gaveUp - whether backoff ran out
 * @param label - short label for the note
 * @returns void
 */
function noteBackoff(warnings: string[], gaveUp: boolean, label: string): void {
  if (gaveUp) {
    warnings.push(`${label}: GitHub did not finish counting in time; recorded as null`);
  }
}
