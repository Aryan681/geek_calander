import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEvents, fetchRoulette, ApiError } from "./api";
afterEach(() => vi.restoreAllMocks());
describe("event adapter", () => {
  it("requests a bounded window and normalizes valid records", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "anilist:anime:4",
            title: "Arc",
            releaseDate: "2026-08-02",
            category: "anime",
          },
          {},
        ],
      }),
    });
    const result = await fetchEvents({ from: "2026-08-01", to: "2026-09-01" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("from=2026-08-01"),
      expect.anything(),
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Arc");
  });
  it("surfaces HTTP errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchEvents({ from: "a", to: "b" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
  it("follows cursors and deduplicates events", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "game:1",
              title: "One",
              category: "game",
              releaseDate: "2026-08-01",
            },
          ],
          nextCursor: "page-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "game:1",
              title: "One",
              category: "game",
              releaseDate: "2026-08-01",
            },
            {
              id: "game:2",
              title: "Two",
              category: "game",
              releaseDate: "2026-08-02",
            },
          ],
          nextCursor: null,
        }),
      });
    const result = await fetchEvents({
      from: "2026-08-01",
      to: "2026-09-01",
      limit: 2,
    });
    expect(result.events.map((event) => event.id)).toEqual([
      "game:1",
      "game:2",
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain("cursor=page-2");
  });
  it("fetches and normalizes one roulette result with exclusions", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ event: { id: "game:1", title: "Game", category: "game", releaseDate: "2026-08-01" } }),
    });
    const result = await fetchRoulette({ category: "game", window: "week", mode: "random", exclude: ["game:0"] });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("exclude=game%3A0"), expect.anything());
    expect(result.event.id).toBe("game:1");
  });
  it("supports cancellation and rejects malformed roulette responses", async () => {
    const controller = new AbortController();
    global.fetch = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(fetchRoulette({}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ event: {} }) });
    await expect(fetchRoulette()).rejects.toBeInstanceOf(ApiError);
  });
});
