/** package.json history reading from a local git worktree (manifest sources). */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ManifestSource } from "./fetch-commits.ts";

const exec = promisify(execFile);

/**
 * Read the package.json history of a local worktree as manifest sources.
 * @param workDir - cloned repository path
 * @param sinceDate - optional lower bound on commit dates (YYYY-MM-DD)
 * @returns one manifest source per commit that touched package.json
 */
export async function manifestPoints(workDir: string, sinceDate: string | null): Promise<ManifestSource[]> {
  const log = await exec("git", ["-C", workDir, "log", "--reverse", "--format=%H%x00%aI", "--", "package.json"], {
    timeout: 60000,
    maxBuffer: 1 << 24,
  });

  const sources: ManifestSource[] = [];

  for (const line of log.stdout.split("\n")) {
    const [sha, date] = line.trim().split("\x00");

    if (sha !== undefined && date !== undefined && (sinceDate === null || date.slice(0, 10) >= sinceDate)) {
      sources.push({ sha, date, content: await showManifest(workDir, sha) });
    }
  }

  return sources;
}

/**
 * Show package.json at one commit; null when the file did not exist there.
 * @param workDir - cloned repository path
 * @param sha - commit hash
 * @returns the manifest content or null
 */
async function showManifest(workDir: string, sha: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["-C", workDir, "show", `${sha}:package.json`], {
      timeout: 30000,
      maxBuffer: 1 << 24,
    });

    return stdout;
  } catch {
    return null;
  }
}
