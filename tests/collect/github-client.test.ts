import { describe, expect, it } from "vitest";

import { fetchWithBackoff } from "../../scripts/collect/github-client.ts";

/** Fake clock: collects requested delays instead of sleeping. */
function noSleep(): (ms: number) => Promise<void> {
  return async () => undefined;
}

describe("fetchWithBackoff", () => {
  it("retries 202 (counting) responses and returns the eventual data", async () => {
    const attempts: number[] = [];

    const result = await fetchWithBackoff(
      async () => {
        attempts.push(attempts.length + 1);

        return attempts.length < 3 ? { status: 202, body: null } : { status: 200, body: [1, 2] };
      },
      { sleep: noSleep() },
    );

    expect(result.value).toEqual([1, 2]);
    expect(result.gaveUp).toBe(false);
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("returns null after the configured attempts with exponential delays", async () => {
    const delays: number[] = [];

    const result = await fetchWithBackoff(async () => ({ status: 202, body: null }), {
      attempts: 4,
      baseDelayMs: 1000,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(result.value).toBeNull();
    expect(result.gaveUp).toBe(true);
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it("passes 4xx/5xx failures through without retrying", async () => {
    const result = await fetchWithBackoff(async () => ({ status: 404, body: null }), { sleep: noSleep() });

    expect(result.value).toBeNull();
    expect(result.gaveUp).toBe(false);
    expect(result.status).toBe(404);
  });
});
