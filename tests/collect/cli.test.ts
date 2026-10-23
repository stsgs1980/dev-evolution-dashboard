import { describe, expect, it } from "vitest";

import { parseArgs, resolveToken } from "../../scripts/collect/cli.ts";

describe("parseArgs", () => {
  it("parses --user, --since, --include-private and --out with a default out", () => {
    const args = parseArgs(["--user", "stsgs1980", "--since", "2019-01-01", "--include-private", "--out", "tmp/snap"]);

    expect(args).toEqual({
      mode: "run",
      user: "stsgs1980",
      since: "2019-01-01",
      includePrivate: true,
      out: "tmp/snap",
    });
  });

  it("defaults to data/snapshot and no private include", () => {
    const args = parseArgs(["--user", "stsgs1980"]);

    expect(args.mode).toBe("run");
    expect(args).toMatchObject({ out: "data/snapshot", includePrivate: false });
  });

  it("marks --help without requiring --user", () => {
    expect(parseArgs(["--help"]).mode).toBe("help");
    expect(parseArgs([]).mode).toBe("help");
  });

  it("rejects --user missing and a malformed --since with plain messages", () => {
    expect(() => parseArgs(["--out", "x"])).toThrow(/--user is required/);
    expect(() => parseArgs(["--user", "u", "--since", "May"])).toThrow(/--since expects YYYY-MM-DD/);
    expect(() => parseArgs(["--user", "u", "--unknown", "1"])).toThrow(/unknown option/i);
  });
});

describe("resolveToken", () => {
  it("prefers the shell token over .env.local and gh", () => {
    expect(
      resolveToken({
        shellToken: "shell-token",
        envLocal: "GITHUB_TOKEN=dotenv-token\n",
        ghToken: "gh-token",
      }),
    ).toEqual({ token: "shell-token", source: "shell" });
  });

  it("falls back to .env.local with CRLF line endings", () => {
    expect(
      resolveToken({
        shellToken: undefined,
        envLocal: "OTHER=1\r\nGITHUB_TOKEN=dotenv-token\r\n",
        ghToken: "gh-token",
      }),
    ).toEqual({ token: "dotenv-token", source: "dotenv" });
  });

  it("falls back to gh auth token and then to anonymous", () => {
    expect(resolveToken({ shellToken: undefined, envLocal: "X=1\n", ghToken: "gh-token" })).toEqual({
      token: "gh-token",
      source: "gh",
    });
    expect(resolveToken({ shellToken: undefined, envLocal: null, ghToken: null })).toEqual({
      token: null,
      source: "anonymous",
    });
  });

  it("ignores an empty token line", () => {
    expect(resolveToken({ shellToken: undefined, envLocal: "GITHUB_TOKEN=\n", ghToken: null })).toEqual({
      token: null,
      source: "anonymous",
    });
  });
});
