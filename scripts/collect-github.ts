#!/usr/bin/env node
/** Offline-first GitHub collector entry point: fetch, assemble, validate, write. */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

import { buildRepoBlock, earliestDate, summary, type SnapshotCandidate } from "./collect/build.ts";
import { parseArgs, resolveToken, USAGE, type ParsedArgs } from "./collect/cli.ts";
import { collectCommits } from "./collect/fetch-commits.ts";
import { fetchProfile, fetchRepos, type ProfileCandidate } from "./collect/fetch-repos.ts";
import { fetchSearchEvents, type SearchEventsResult } from "./collect/fetch-search.ts";
import { collectStats, type StatsResult } from "./collect/fetch-stats.ts";
import { createClient } from "./collect/github-client.ts";
import { normalizeSnapshot } from "./collect/normalize.ts";
import { parseManifests } from "./collect/parse-manifests.ts";
import { parseSnapshot } from "./collect/schema.ts";
import { writeSnapshot } from "./collect/write.ts";

const exec = promisify(execFile);

/** Version recorded in every snapshot; bump on schema changes (spec section 3). */
const GENERATOR_VERSION = "1.0.0";
/** Aggregation timezone; the owner fixed Europe/Moscow in the phase 0 brief. */
const TIMEZONE = "Europe/Moscow";

/** Running collection state that later feeds the snapshot notes. */
interface Notes {
  items: { code: string; message: string; at: string | null }[];
}

/**
 * Add one degradation note.
 * @param notes - running note list
 * @param code - stable note code
 * @param message - human-readable message
 * @returns void
 */
function note(notes: Notes, code: string, message: string): void {
  notes.items.push({ code, message, at: null });
}

/**
 * Run one collection: token resolve, fetch, assemble, validate, write.
 * @returns the process exit code
 */
async function main(): Promise<number> {
  let args: ParsedArgs;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[FAIL] ${errMessage(error)}\n`);

    return 2;
  }

  if (args.mode === "help") {
    process.stdout.write(`${USAGE}\n`);

    return 0;
  }

  const token = await resolveTokenInputs();
  const notes: Notes = { items: [{ code: "mode", message: `token source: ${token.source}`, at: null }] };

  if (token.source === "anonymous") {
    console.warn("[WARNING] no GITHUB_TOKEN found; running anonymous: stats endpoints will be skipped");
  }

  const octokit = createClient(token.token);
  const collectedAt = new Date().toISOString();

  progress(`profile ${args.user}`);
  const profile: ProfileCandidate = await fetchProfile(octokit, args.user);
  const repos = await fetchRepos(octokit, args.user, args.includePrivate);

  if (token.token === null && args.includePrivate) {
    console.warn("[WARNING] --include-private without a token: private repos are not visible");
  }

  if (repos.repos.length > 100) {
    console.warn(`[WARNING] ${repos.repos.length} repositories; consider --since over a 5-year window`);
  }

  const built: SnapshotCandidate[] = [];
  let commitTotal = 0;
  let usedGit = false;

  for (const [index, repo] of repos.repos.entries()) {
    progress(`repo ${index + 1}/${repos.repos.length}`);

    const name = repo.isPrivate ? `private-${index + 1}` : repo.name;
    const commits = await collectCommits(octokit, repo, args.since);
    const statsResult: StatsResult | null =
      repo.owner === "" ? null : await collectStats(octokit, repo, token.token !== null);

    if (statsResult === null) {
      note(notes, "skip", `${name}: stats skipped, owner unknown`);
    }

    built.push(
      buildRepoBlock({
        name,
        repo,
        commits: commits.commits,
        usedGit: commits.usedGit,
        manifests: parseManifests(commits.manifests),
        statsResult,
      }),
    );
    commitTotal += commits.commits.length;
    usedGit = usedGit || commits.usedGit;

    for (const warning of [
      ...commits.warnings,
      ...repos.warnings,
      ...(statsResult === null ? [] : statsResult.warnings),
    ]) {
      note(notes, "collect", `${name}: ${warning}`);
    }
  }

  const events: SearchEventsResult = await fetchSearchEvents(octokit, args.user, token.token === null);

  for (const warning of events.warnings) {
    note(notes, "search", warning);
  }

  const snapshot = {
    meta: {
      username: args.user,
      collectedAt,
      range: { from: earliestDate(built as { createdAt?: unknown }[], collectedAt), to: collectedAt },
      timezone: TIMEZONE,
      includePrivate: args.includePrivate,
      generatorVersion: GENERATOR_VERSION,
      source: usedGit ? "api+git" : "api",
    },
    profile,
    repos: built.map((repo) => normalizeSnapshot(repo)),
    events: { prs: events.prs, issues: events.issues },
    notes: notes.items,
  };

  const validated = parseSnapshot(normalizeSnapshot(snapshot));
  const result = writeSnapshot(args.out, args.user, validated);

  if (!result.written) {
    process.stdout.write(`[OK] data unchanged since ${result.reusedCollectedAt}; latest.json kept byte-identical\n`);
  }

  process.stdout.write(summary(args.user, validated.repos.length, commitTotal, args.out, validated.notes.length));

  return 0;
}

/**
 * Gather token candidates for resolveToken: shell env, .env.local, gh CLI.
 * @returns the token resolution; never logs the token value
 */
async function resolveTokenInputs(): Promise<ReturnType<typeof resolveToken>> {
  const shellToken = process.env.GITHUB_TOKEN;
  const envLocal = existsSync(".env.local") ? tryReadFile(".env.local") : null;

  return resolveToken({ shellToken, envLocal, ghToken: await ghAuthToken() });
}

/**
 * Read a file, null on any failure.
 * @param path - file path
 * @returns the file content or null
 */
function tryReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Read `gh auth token` output when the GitHub CLI is installed and logged in.
 * @returns the token or null; the value only lives in memory
 */
async function ghAuthToken(): Promise<string | null> {
  try {
    const result = await exec("gh", ["auth", "token"], { timeout: 5000, maxBuffer: 1 << 16 });
    const token = result.stdout.trim();

    return token === "" ? null : token;
  } catch {
    return null;
  }
}

/**
 * Progress line for stderr.
 * @param message - short progress text
 * @returns void
 */
function progress(message: string): void {
  console.warn(`[..] ${message}`);
}

/**
 * Error message of an unknown thrown value.
 * @param error - thrown value
 * @returns its message
 */
function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`[FAIL] ${errMessage(error)}`);
  process.exitCode = 1;
}
