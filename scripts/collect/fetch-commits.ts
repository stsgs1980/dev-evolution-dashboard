/** Repository commit history through a blobless git clone, with an API fallback. */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { Octokit } from "octokit";

import { manifestPoints } from "./fetch-manifests.ts";
import type { RepoCandidate } from "./fetch-repos.ts";

const exec = promisify(execFile);

/** Loose commit record before schema normalization. */
export interface CommitCandidate {
  sha: string;
  date: string;
  message: string;
  body: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  isMerge: boolean;
  parents: number;
}

/** Loose manifest source for parse-manifests. */
export interface ManifestSource {
  sha: string;
  date: string;
  content: string | null;
}

/** Everything commit collection produced for one repository. */
export interface CommitsResult {
  commits: CommitCandidate[];
  manifests: ManifestSource[];
  /** True when the git clone provided the history (meta.source api+git). */
  usedGit: boolean;
  /** Warnings for the snapshot notes, e.g. clone failure with the API fallback. */
  warnings: string[];
}

/** Upper bound from prompt 02: do not truncate silently past this. */
export const MAX_COMMITS = 20000;

/**
 * Collect the commit history and package.json manifest points of one repository.
 * Prefers a blobless clone (`--filter=blob:none`); falls back to the REST
 * commits list when cloning is impossible.
 * @param octokit - configured client used by the API fallback
 * @param repo - repository candidate; an empty cloneUrl skips git
 * @param sinceDate - optional YYYY-MM-DD lower bound on commit dates
 * @returns commits, manifest sources and warnings
 */
export async function collectCommits(
  octokit: Octokit,
  repo: RepoCandidate,
  sinceDate: string | null,
): Promise<CommitsResult> {
  if (repo.cloneUrl === "") {
    return fallbackCommits(octokit, repo, sinceDate, ["repository analyzed over the REST API only"]);
  }

  const workDir = mkdtempSync(join(tmpdir(), "collect-"));
  const warnings: string[] = [];

  try {
    await exec(
      "git",
      ["clone", "--filter=blob:none", "--no-checkout", "--config", "advice.detachedHead=false", repo.cloneUrl, workDir],
      { timeout: 240000, maxBuffer: 1 << 20 },
    );

    const log = await exec(
      "git",
      [
        "-C",
        workDir,
        "log",
        "--reverse",
        "--no-renames",
        "--date=iso-strict",
        "--format=%H%x00%aI%x00%s%x00%b%x00%P",
        "--numstat",
      ],
      { timeout: 240000, maxBuffer: 1 << 28 },
    );

    const commits = sinceFilter(parseGitLog(log.stdout), sinceDate);
    const manifests = await manifestPoints(workDir, sinceDate);

    return { commits, manifests, usedGit: true, warnings };
  } catch {
    warnings.push("git clone failed; using the REST commits list");

    const fallback = await fallbackCommits(octokit, repo, sinceDate, warnings);

    return fallback;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * REST fallback: the commit list without numstat (no line counts) for a repository.
 * @param octokit - configured client
 * @param repo - repository candidate
 * @param sinceDate - optional ISO lower bound
 * @param seeds - warnings collected before this fetch
 * @returns commits with empty manifests plus the given warnings
 */
export async function fallbackCommits(
  octokit: Octokit,
  repo: RepoCandidate,
  sinceDate: string | null,
  seeds: string[],
): Promise<CommitsResult> {
  if (repo.owner === "") {
    return { commits: [], manifests: [], usedGit: false, warnings: [...seeds, "no owner name for the REST fallback"] };
  }

  const items = await octokit.paginate(octokit.rest.repos.listCommits, {
    owner: repo.owner,
    repo: repo.name,
    per_page: 100,
    since: sinceDate === null ? undefined : `${sinceDate}T00:00:00Z`,
  });

  const commits: CommitCandidate[] = [];

  for (const item of items) {
    if (item === null || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const details = record.commit as Record<string, unknown> | undefined;
    const parents = Array.isArray(record.parents) ? record.parents : [];

    if (details === undefined) {
      continue;
    }

    const author = details.author as { date?: unknown } | undefined;
    const message = typeof details.message === "string" ? details.message : "";
    const newline = message.indexOf("\n");

    commits.push({
      sha: typeof record.sha === "string" ? record.sha : "",
      date: typeof author?.date === "string" ? author.date : "",
      message: newline === -1 ? message : message.slice(0, newline),
      body: newline === -1 ? "" : message.slice(newline + 1).trim(),
      isMerge: parents.length > 1,
      parents: parents.length,
    });
  }

  return { commits, manifests: [], usedGit: false, warnings: seeds };
}

/**
 * Parse `git log --numstat --format` output into commit candidates.
 * Message is the subject line; the body comes from the %b field of the header.
 * @param text - full git log output
 * @returns commits in given order with numstat totals where available
 */
export function parseGitLog(text: string): CommitCandidate[] {
  const commits: CommitCandidate[] = [];
  let current: CommitCandidate | null = null;

  for (const line of text.split("\n")) {
    const header = line.split("\x00");

    if (header.length === 5) {
      if (current !== null) {
        commits.push(current);
      }

      current = {
        sha: header[0],
        date: header[1],
        message: header[2],
        body: header[3],
        isMerge: countParents(header[4]) > 1,
        parents: countParents(header[4]),
      };

      continue;
    }

    const parts = line.split("\t");
    const isNumstat = parts.length === 3 && /^(\d+|-)$/.test(parts[0]) && /^(\d+|-)$/.test(parts[1]);

    if (isNumstat && current !== null) {
      current.filesChanged = (current.filesChanged ?? 0) + 1;
      current.additions = (current.additions ?? 0) + numstatValue(parts[0]);
      current.deletions = (current.deletions ?? 0) + numstatValue(parts[1]);
    }
  }

  if (current !== null) {
    commits.push(current);
  }

  return commits;
}

/**
 * Drop commits older than the optional --since bound.
 * @param commits - commits in chronological order
 * @param sinceDate - optional YYYY-MM-DD lower bound
 * @returns the filtered list
 */
function sinceFilter(commits: CommitCandidate[], sinceDate: string | null): CommitCandidate[] {
  return sinceDate === null ? commits : commits.filter((commit) => commit.date.slice(0, 10) >= sinceDate);
}

/**
 * Count the parents of a commit from the %P field.
 * @param field - raw parents field
 * @returns number of parents, 0 for the field of a root commit
 */
function countParents(field: string): number {
  const trimmed = field.trim();

  return trimmed === "" ? 0 : trimmed.split(" ").length;
}

/**
 * Parse one numstat column; "-" (binary) contributes nothing.
 * @param column - raw numstat column value
 * @returns a nonnegative integer
 */
function numstatValue(column: string): number {
  return column === "-" ? 0 : Number(column);
}
