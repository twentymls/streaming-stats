import { vi, beforeEach } from "vitest";
import Database from "@tauri-apps/plugin-sql";

describe("database", () => {
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockSelect: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockExecute = vi.fn(async () => ({ rowsAffected: 1 }));
    mockSelect = vi.fn(async () => []);

    vi.mocked(Database.load).mockResolvedValue({
      execute: mockExecute,
      select: mockSelect,
    } as unknown as Database);
  });

  describe("saveDailyStat", () => {
    it("calls execute with correct SQL and params", async () => {
      const { saveDailyStat } = await import("./database");
      await saveDailyStat("2025-01-15", "spotify", "streams", 50000);

      // First calls are migrations (from getDb -> runMigrations), last call is the actual insert
      const insertCall = mockExecute.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT OR REPLACE INTO daily_stats")
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![1]).toEqual(["2025-01-15", "spotify", "streams", 50000]);
    });
  });

  describe("getLatestStats", () => {
    it("calls select with MAX(date) subquery", async () => {
      mockSelect.mockResolvedValueOnce([
        { date: "2025-01-15", source: "spotify", stat_type: "streams", value: 1000 },
      ]);

      const { getLatestStats } = await import("./database");
      const result = await getLatestStats();

      const selectCall = mockSelect.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" && call[0].includes("MAX(date)")
      );
      expect(selectCall).toBeDefined();
      expect(result).toEqual([
        { date: "2025-01-15", source: "spotify", stat_type: "streams", value: 1000 },
      ]);
    });
  });

  describe("getStatsRange", () => {
    it("queries with date range only", async () => {
      const { getStatsRange } = await import("./database");
      await getStatsRange("2025-01-01", "2025-01-31");

      const rangeCall = mockSelect.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" && call[0].includes("BETWEEN")
      );
      expect(rangeCall).toBeDefined();
      expect(rangeCall![1]).toEqual(["2025-01-01", "2025-01-31"]);
    });

    it("queries with date range and source", async () => {
      const { getStatsRange } = await import("./database");
      await getStatsRange("2025-01-01", "2025-01-31", "spotify");

      const rangeCall = mockSelect.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("BETWEEN") &&
          call[0].includes("source = $3")
      );
      expect(rangeCall).toBeDefined();
      expect(rangeCall![1]).toEqual(["2025-01-01", "2025-01-31", "spotify"]);
    });
  });

  describe("getMonthlyApiCount", () => {
    it("returns 0 for empty result", async () => {
      mockSelect.mockResolvedValueOnce([{ count: 0 }]);
      const { getMonthlyApiCount } = await import("./database");
      const count = await getMonthlyApiCount();
      expect(count).toBe(0);
    });

    it("returns count from query", async () => {
      mockSelect.mockResolvedValueOnce([{ count: 42 }]);
      const { getMonthlyApiCount } = await import("./database");
      const count = await getMonthlyApiCount();
      expect(count).toBe(42);
    });
  });

  describe("saveTopTracks", () => {
    it("calls execute per track with rank = i+1", async () => {
      const { saveTopTracks } = await import("./database");
      const tracks = [
        { title: "Song A", streams: 1000 },
        { title: "Song B", streams: 500, artwork_url: "http://example.com/art.jpg" },
      ];

      await saveTopTracks("2025-01-15", "spotify", tracks);

      const trackCalls = mockExecute.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT OR REPLACE INTO top_tracks")
      );
      expect(trackCalls).toHaveLength(2);
      expect(trackCalls[0][1]).toEqual([
        "2025-01-15", "spotify", 1, "Song A", 1000, null,
      ]);
      expect(trackCalls[1][1]).toEqual([
        "2025-01-15", "spotify", 2, "Song B", 500, "http://example.com/art.jpg",
      ]);
    });
  });
});
