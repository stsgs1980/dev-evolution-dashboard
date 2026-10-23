/** Snapshot assembly helpers: repo blocks, meta range, human summary. */
import { MAX_COMMITS, type CommitCandidate } from "./fetch-commits.ts";
import type { RepoCandidate } from "./fetch-repos.ts";
import type { StatsResult } from "./fetch-stats.ts";
import type { ManifestPoint } from "./schema.ts";

/** Inputs of buildRepoBlock, straight from the collection loop. */
export interface RepoParts {
  name: string;
  repo: RepoCandidate;
  commits: CommitCandidate[];
  usedGit: boolean;
  manifests: ManifestPoint[];
  statsResult: StatsResult | null;
}

/** Upper bound for the sampled subset of a truncated commit list. */
const SAMPLE_CAP = 2000;

/** Snapshot-shaped value; typed loosely until the schema validates it. */
export type SnapshotCandidate = Record<string, unknown>;

/**
 * Build one RepoSnapshot-shaped block.
 * @param parts - the collected parts of one repository
 * @returns a repo block close to the snapshot schema
 */
export function buildRepoBlock(parts: RepoParts): SnapshotCandidate {
  const commits = parts.commits;
  const truncated = commits.length > MAX_COMMITS;

  return {
    name: parts.name,
    isFork: parts.repo.isFork,
    isArchived: parts.repo.isArchived,
    isPrivate: parts.repo.isPrivate,
    createdAt: parts.repo.createdAt,
    pushedAt: parts.repo.pushedAt,
    primaryLanguage: parts.repo.primaryLanguage,
    languages: parts.statsResult === null ? {} : parts.statsResult.languages,
    stars: parts.repo.stars,
    forks: parts.repo.forks,
    releases: parts.statsResult === null ? [] : parts.statsResult.releases,
    stats:
      parts.statsResult === null
        ? { commitActivity: null, codeFrequency: null, punchCard: null }
        : parts.statsResult.stats,
    commits: truncated ? truncatedCommits(commits) : commits,
    manifests: parts.manifests,
  };
}

/**
 * Build the meta range lower bound when --since is absent: the earliest repo.
 * @param repos - built repo blocks
 * @param fallback - current timestamp when no repo carries a date
 * @returns a YYYY-MM-DD lower bound
 */
export function earliestDate(repos: { createdAt?: unknown }[], fallback: string): string {
  let earliest = fallback.slice(0, 10);

  for (const repo of repos) {
    if (typeof repo.createdAt === "string" && repo.createdAt.slice(0, 10) < earliest) {
      earliest = repo.createdAt.slice(0, 10);
    }
  }

  return earliest;
}

/**
 * Human summary line for stdout.
 * @param username - collected username
 * @param reposCount - number of repositories in the snapshot
 * @param commitTotal - commits summed across repositories
 * @param outDir - snapshot output directory
 * @param notesCount - number of degradations recorded
 * @returns a single summary line with a trailing newline
 */
export function summary(
  username: string,
  reposCount: number,
  commitTotal: number,
  outDir: string,
  notesCount: number,
): string {
  return `[OK] snapshot: user=${username} repos=${reposCount} commits=${commitTotal} notes=${notesCount} out=${outDir}\n`;
}

/**
 * Mark a commit list as truncated per spec: count plus a sampled subset.
 * @param commits - the full (over-limit) commit list
 * @returns the truncated marker shape
 */
function truncatedCommits(commits: CommitCandidate[]): unknown {
  const stride = Math.ceil(commits.length / SAMPLE_CAP);
  const sampled = commits.filter((_, index) => index % stride === 0);

  return { truncated: true, count: commits.length, sampled };
}
