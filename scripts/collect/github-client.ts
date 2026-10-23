/** Octokit client factory and offline-testable retry/backoff logic (202-aware). */
import { Octokit } from "octokit";

/** An already-json-decoded response of one GitHub call. */
export interface ResponseLike<T> {
  status: number;
  body: T | null;
}

/** Options of fetchWithBackoff; sleep is injectable for deterministic tests. */
export interface BackoffOptions {
  /** Total attempts; after this many 202s the value is reported as null. */
  attempts?: number;
  /** First delay in ms; doubles on every retry. */
  baseDelayMs?: number;
  /** Sleep implementation, injectable. */
  sleep?: (ms: number) => Promise<void>;
}

/** The outcome of one fetch with backoff. */
export interface FetchOutcome<T> {
  value: T | null;
  /** True when the endpoint kept returning 202 until the attempts ran out. */
  gaveUp: boolean;
  /** Last observed HTTP status, when the call completed. */
  status?: number;
}

/**
 * Create a GitHub client for the collector.
 * @param token - a GitHub token, or null for anonymous access (rate limit 60/h)
 * @returns a configured Octokit instance
 */
export function createClient(token: string | null): Octokit {
  return new Octokit(token === null ? {} : { auth: token });
}

/**
 * Fetch a value with exponential backoff for 202 (GitHub is counting) responses.
 * Non-2xx responses are not retried: auth and rate limit errors belong to the
 * retry/throttle plugins of Octokit, not to the stats polling loop.
 * @param callSite - a single request returning status and decoded body
 * @param options - attempts (default 5), baseDelayMs (default 2000), sleep
 * @returns the fetched value, givenUp status and the last HTTP status
 */
export async function fetchWithBackoff<T>(
  callSite: () => Promise<ResponseLike<T>>,
  options: BackoffOptions = {},
): Promise<FetchOutcome<T>> {
  const attempts = options.attempts === undefined ? 5 : options.attempts;
  const baseDelayMs = options.baseDelayMs === undefined ? 2000 : options.baseDelayMs;
  const sleep = options.sleep === undefined ? defaultSleep : options.sleep;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await callSite();

    if (response.status >= 200 && response.status < 300 && response.status !== 202) {
      return { value: response.body, gaveUp: false, status: response.status };
    }

    if (response.status === 202) {
      if (attempt === attempts - 1) {
        return { value: null, gaveUp: true, status: 202 };
      }

      await sleep(baseDelayMs * 2 ** attempt);

      continue;
    }

    return { value: null, gaveUp: false, status: response.status };
  }

  return { value: null, gaveUp: true };
}

/**
 * Default sleep implementation.
 * @param ms - delay in milliseconds
 * @returns a promise that resolves after the delay
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
