/** CLI argument parsing and GitHub token resolution for the collector (offline only). */

/** Parsed CLI arguments for one collection run. */
export interface CliArgs {
  mode: "run";
  user: string;
  since: string | null;
  includePrivate: boolean;
  out: string;
}

/** Help marker: the entry point prints usage and exits 0. */
export interface HelpArgs {
  mode: "help";
}

export type ParsedArgs = CliArgs | HelpArgs;

/** Token source given to the collector. */
export interface TokenResolution {
  token: string | null;
  source: "shell" | "dotenv" | "gh" | "anonymous";
}

/** Inputs of resolveToken; the entry point assembles them from the environment. */
export interface TokenInputs {
  shellToken: string | undefined;
  /** Full content of <repoRoot>/.env.local, or null when the file is absent. */
  envLocal: string | null;
  /** `gh auth token` output, or null when gh is absent or logged out. */
  ghToken: string | null;
}

/** Help text for --help and for any argument error. */
export const USAGE =
  "usage: npm run data:collect -- --user <username> [--since YYYY-MM-DD] [--include-private] [--out data/snapshot]";

/**
 * Parse collector CLI arguments (everything after `npm run data:collect --`).
 * @param argv - raw argument vector
 * @returns parsed arguments in run or help mode
 * @throws Error on missing --user, malformed --since or unknown options
 */
export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    return { mode: "help" };
  }

  const parsed: { user?: string; since?: string; includePrivate: boolean; out?: string } = {
    includePrivate: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--include-private") {
      parsed.includePrivate = true;
    } else if (arg === "--user" || arg === "--since" || arg === "--out") {
      const value = argv[i + 1];

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option ${arg} expects a value. ${USAGE}`);
      }

      i += 1;

      if (arg === "--user") {
        parsed.user = value;
      } else if (arg === "--since") {
        parsed.since = value;
      } else {
        parsed.out = value;
      }
    } else {
      throw new Error(`Unknown option: ${arg}. ${USAGE}`);
    }
  }

  if (parsed.user === undefined) {
    throw new Error(`--user is required. ${USAGE}`);
  }

  if (parsed.since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.since)) {
    throw new Error(`--since expects YYYY-MM-DD, got '${parsed.since}'.`);
  }

  return {
    mode: "run",
    user: parsed.user,
    since: parsed.since === undefined ? null : parsed.since,
    includePrivate: parsed.includePrivate,
    out: parsed.out === undefined ? "data/snapshot" : parsed.out,
  };
}

/**
 * Resolve the GitHub token in strict priority order (spec token-setup section 4):
 * shell environment, then .env.local, then `gh auth token`, then anonymous.
 * @param inputs - token candidates gathered by the entry point
 * @returns the resolved token and where it came from; null token means anonymous
 */
export function resolveToken(inputs: TokenInputs): TokenResolution {
  const shell = trimmed(inputs.shellToken);

  if (shell !== null && shell !== "") {
    return { token: shell, source: "shell" };
  }

  const fromEnvFile = parseEnvLocal(inputs.envLocal);

  if (fromEnvFile !== null) {
    return { token: fromEnvFile, source: "dotenv" };
  }

  const gh = trimmed(inputs.ghToken);

  if (gh !== null && gh !== "") {
    return { token: gh, source: "gh" };
  }

  return { token: null, source: "anonymous" };
}

/**
 * Trim a candidate token; empty strings become null so empty lines do not win.
 * @param value - raw token candidate
 * @returns trimmed token or null
 */
function trimmed(value: string | null | undefined): string | null {
  const result = value === null || value === undefined ? "" : value.trim();

  return result === "" ? null : result;
}

/**
 * Extract GITHUB_TOKEN from a .env.local content.
 * @param content - full file content or null when absent
 * @returns the token value or null when absent or empty
 */
function parseEnvLocal(content: string | null): string | null {
  if (content === null) {
    return null;
  }

  for (const line of content.split(/\r?\n/)) {
    const match = /^GITHUB_TOKEN=(.*)$/.exec(line.trim());

    if (match !== null) {
      const value = match[1].trim().replace(/^['"]|['"]$/g, "");

      return value === "" ? null : value;
    }
  }

  return null;
}
