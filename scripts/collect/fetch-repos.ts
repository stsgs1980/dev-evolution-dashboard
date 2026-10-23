/** Profile and repository listing through the GitHub REST API. */
import type { Octokit } from "octokit";

/** Loose shape of a repository before schema normalization. */
export interface RepoCandidate {
  name: string;
  owner: string;
  isFork: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  cloneUrl: string;
  createdAt: string;
  pushedAt: string;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
}

/** Loose shape of the user profile before schema normalization. */
export interface ProfileCandidate {
  login: string;
  name: string | null;
  company: string | null;
  bio: string | null;
  blog: string | null;
  location: string | null;
  createdAt: string;
  publicRepos: number;
  followers: number;
  following: number;
}

/** Result of one paginated repos fetch. */
export interface ReposResult {
  repos: RepoCandidate[];
  /** Warnings for the snapshot notes, e.g. private repos in anonymous mode. */
  warnings: string[];
}

/**
 * Fetch the user profile.
 * @param octokit - configured client
 * @param user - GitHub username
 * @returns the profile candidate
 */
export async function fetchProfile(octokit: Octokit, user: string): Promise<ProfileCandidate> {
  const response = await octokit.rest.users.getByUsername({ username: user });
  const data = response.data;

  return {
    login: user,
    name: stringOrNull(data.name),
    company: stringOrNull(data.company),
    bio: stringOrNull(data.bio),
    blog: stringOrNull(data.blog),
    location: stringOrNull(data.location),
    createdAt: chooseIso(data.created_at),
    publicRepos: numberOrZero(data.public_repos),
    followers: numberOrZero(data.followers),
    following: numberOrZero(data.following),
  };
}

/**
 * Fetch the paginated repository list of a user, anonymous public listing only.
 * @param octokit - configured client
 * @param user - GitHub username
 * @param includePrivate - the caller relays this to authenticated listing when a token exists
 * @returns repository candidates sorted by createdAt ascending plus warnings
 */
export async function fetchRepos(octokit: Octokit, user: string, includePrivate: boolean): Promise<ReposResult> {
  const warnings: string[] = [];
  const mapped: RepoCandidate[] = [];

  if (!includePrivate) {
    for (const item of await octokit.paginate(octokit.rest.repos.listForUser, {
      username: user,
      per_page: 100,
      sort: "created",
      direction: "asc",
    })) {
      const candidate = mapRepo(item);

      if (candidate !== null) {
        mapped.push(candidate);
      }
    }

    return { repos: sortRepos(mapped), warnings };
  }

  for (const item of await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    per_page: 100,
    affiliation: "owner",
    sort: "created",
    direction: "asc",
  })) {
    const candidate = mapRepo(item);

    if (candidate !== null) {
      mapped.push(candidate);
    }
  }

  return { repos: sortRepos(mapped), warnings };
}

/**
 * Sort repository candidates by createdAt, then name (spec: idempotent arrays).
 * @param repos - unsorted candidates
 * @returns sorted candidates
 */
export function sortRepos(repos: RepoCandidate[]): RepoCandidate[] {
  return [...repos].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

/**
 * Map one REST repository item to the collector candidate shape.
 * @param item - REST payload
 * @returns repository candidate or null when the item is malformed
 */
export function mapRepo(item: unknown): RepoCandidate | null {
  if (item === null || typeof item !== "object") {
    return null;
  }

  const repo = item as Record<string, unknown>;
  const name = stringOrNull(repo.name);

  if (name === null) {
    return null;
  }

  const owner =
    typeof repo.owner === "object" && repo.owner !== null ? (repo.owner as { login?: unknown }).login : null;
  const login = stringOrNull(owner) ?? "";
  const isPrivate = repo.private === true;

  return {
    name: isPrivate ? "private" : name,
    owner: isPrivate ? "" : login,
    isFork: repo.fork === true,
    isArchived: repo.archived === true,
    isPrivate,
    cloneUrl: isPrivate ? "" : `https://github.com/${login}/${name}.git`,
    createdAt: chooseIso(repo.created_at),
    pushedAt: chooseIso(repo.pushed_at),
    primaryLanguage: stringOrNull(repo.language),
    stars: numberOrZero(repo.stargazers_count),
    forks: numberOrZero(repo.forks_count),
  };
}

/**
 * Return the string or null when the value is empty or not a string.
 * @param value - raw API value
 * @returns the string value or null
 */
export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Keep raw API timestamps verbatim (GitHub already emits ISO 8601).
 * @param value - raw timestamp field
 * @returns the timestamp or an empty string when absent
 */
function chooseIso(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Coerce a count-like value to a safe nonnegative integer.
 * @param value - raw API value
 * @returns an integer, 0 for anything unexpected
 */
function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}
