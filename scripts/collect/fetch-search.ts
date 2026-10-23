/** PR and issue counts of the author through the GitHub Search API. */
import type { Octokit } from "octokit";

/** Counted PR and issue activity of the user. */
export interface SearchEventsResult {
  prs: { totalCount: number | null };
  issues: { totalCount: number | null };
  /** Warnings for the snapshot notes, e.g. a failed search request. */
  warnings: string[];
}

/**
 * Count PRs authored by the user with one search request each.
 * The Search API has a separate quota (30/min authenticated); failures are
 * reported as null plus a note instead of failing the whole collection.
 * @param octokit - configured client
 * @param user - GitHub username
 * @param anonymous - true when no token resolved; search still runs but one failure is tolerated
 * @returns counted events
 */
export async function fetchSearchEvents(
  octokit: Octokit,
  user: string,
  anonymous: boolean,
): Promise<SearchEventsResult> {
  const warnings: string[] = [];
  const prQuery = `type:pr author:${user}`;
  const issueQuery = `type:issue author:${user}`;

  const prs = await searchTotal(octokit, prQuery);
  const issues = await searchTotal(octokit, issueQuery);

  if (prs === null) {
    warnings.push("search: PR count failed; recorded as null");
  }

  if (issues === null) {
    warnings.push("search: issue count failed; recorded as null");
  }

  if (anonymous) {
    warnings.push("search ran in anonymous mode; the 10/min quota may truncate results");
  }

  return { prs: { totalCount: prs }, issues: { totalCount: issues }, warnings };
}

/**
 * Run one search query and extract total_count, or null on failure.
 * @param octokit - configured client
 * @param query - search qualifier string
 * @returns the total count or null
 */
async function searchTotal(octokit: Octokit, query: string): Promise<number | null> {
  try {
    const response = await octokit.request("GET /search/issues", { q: query, per_page: 1 });

    if (response.status >= 300) {
      return null;
    }

    const count = (response.data as { total_count?: unknown }).total_count;

    return typeof count === "number" && Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}
