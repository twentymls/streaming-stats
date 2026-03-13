import { vi, beforeEach, describe, it, expect } from "vitest";
import { invoke } from "@tauri-apps/api/core";

describe("database", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  describe("saveDailyStat", () => {
    it("calls invoke with correct command and params", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      const { saveDailyStat } = await import("./database");
      await saveDailyStat("2025-01-15", "spotify", "streams", 50000);

      expect(invoke).toHaveBeenCalledWith("save_daily_stat", {
        date: "2025-01-15",
        source: "spotify",
        statType: "streams",
        value: 50000,
      });
    });
  });

  describe("getLatestStats", () => {
    it("calls invoke and returns results", async () => {
      const mockStats = [
        { date: "2025-01-15", source: "spotify", stat_type: "streams", value: 1000 },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(mockStats);

      const { getLatestStats } = await import("./database");
      const result = await getLatestStats();

      expect(invoke).toHaveBeenCalledWith("get_latest_stats");
      expect(result).toEqual(mockStats);
    });
  });

  describe("getStatsRange", () => {
    it("calls invoke with date range only", async () => {
      const { getStatsRange } = await import("./database");
      await getStatsRange("2025-01-01", "2025-01-31");

      expect(invoke).toHaveBeenCalledWith("get_stats_range", {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        source: null,
      });
    });

    it("calls invoke with date range and source", async () => {
      const { getStatsRange } = await import("./database");
      await getStatsRange("2025-01-01", "2025-01-31", "spotify");

      expect(invoke).toHaveBeenCalledWith("get_stats_range", {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        source: "spotify",
      });
    });
  });

  describe("getMonthlyApiCount", () => {
    it("returns count from invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(42);
      const { getMonthlyApiCount } = await import("./database");
      const count = await getMonthlyApiCount();

      expect(invoke).toHaveBeenCalledWith("get_monthly_api_count");
      expect(count).toBe(42);
    });
  });

  describe("getLastFetchDate", () => {
    it("returns date from invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("2025-01-15");
      const { getLastFetchDate } = await import("./database");
      const date = await getLastFetchDate();

      expect(invoke).toHaveBeenCalledWith("get_last_fetch_date");
      expect(date).toBe("2025-01-15");
    });

    it("returns null when no data", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);
      const { getLastFetchDate } = await import("./database");
      const date = await getLastFetchDate();

      expect(date).toBeNull();
    });
  });

  describe("saveTopTracks", () => {
    it("calls invoke with correct params", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      const { saveTopTracks } = await import("./database");
      const tracks = [
        { title: "Song A", streams: 1000 },
        { title: "Song B", streams: 500, artwork_url: "http://example.com/art.jpg" },
      ];

      await saveTopTracks("2025-01-15", "spotify", tracks);

      expect(invoke).toHaveBeenCalledWith("save_top_tracks", {
        date: "2025-01-15",
        source: "spotify",
        tracks,
      });
    });
  });

  describe("saveTopCurators", () => {
    it("calls invoke with correct params", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      const { saveTopCurators } = await import("./database");
      const curators = [{ curator_name: "Curator A", followers_total: "10000" }];

      await saveTopCurators("2025-01-15", "spotify", curators);

      expect(invoke).toHaveBeenCalledWith("save_top_curators", {
        date: "2025-01-15",
        source: "spotify",
        curators,
      });
    });
  });

  describe("getLatestTopTracks", () => {
    it("calls invoke and returns results", async () => {
      const mockTracks = [{ title: "Song A", streams: 1000 }];
      vi.mocked(invoke).mockResolvedValueOnce(mockTracks);

      const { getLatestTopTracks } = await import("./database");
      const result = await getLatestTopTracks("spotify");

      expect(invoke).toHaveBeenCalledWith("get_latest_top_tracks", { source: "spotify" });
      expect(result).toEqual(mockTracks);
    });
  });

  describe("getLatestTopCurators", () => {
    it("calls invoke and returns results", async () => {
      const mockCurators = [{ curator_name: "Curator A" }];
      vi.mocked(invoke).mockResolvedValueOnce(mockCurators);

      const { getLatestTopCurators } = await import("./database");
      const result = await getLatestTopCurators("spotify");

      expect(invoke).toHaveBeenCalledWith("get_latest_top_curators", { source: "spotify" });
      expect(result).toEqual(mockCurators);
    });
  });

  describe("getTopTrackDeltas", () => {
    it("calls invoke and converts to Map", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ "Song A": 200 });

      const { getTopTrackDeltas } = await import("./database");
      const result = await getTopTrackDeltas("spotify");

      expect(invoke).toHaveBeenCalledWith("get_top_track_deltas", { source: "spotify" });
      expect(result).toBeInstanceOf(Map);
      expect(result.get("Song A")).toBe(200);
    });
  });

  describe("getAllCachedTopTracks", () => {
    it("calls invoke and converts to Map", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        spotify: [{ title: "Song A", streams: 1000 }],
      });

      const { getAllCachedTopTracks } = await import("./database");
      const result = await getAllCachedTopTracks();

      expect(invoke).toHaveBeenCalledWith("get_all_cached_top_tracks");
      expect(result).toBeInstanceOf(Map);
      expect(result.get("spotify")).toEqual([{ title: "Song A", streams: 1000 }]);
    });
  });

  describe("getAllCachedTopCurators", () => {
    it("calls invoke and converts to Map", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        spotify: [{ curator_name: "Curator A" }],
      });

      const { getAllCachedTopCurators } = await import("./database");
      const result = await getAllCachedTopCurators();

      expect(invoke).toHaveBeenCalledWith("get_all_cached_top_curators");
      expect(result).toBeInstanceOf(Map);
      expect(result.get("spotify")).toEqual([{ curator_name: "Curator A" }]);
    });
  });

  describe("logApiCall", () => {
    it("calls invoke with correct params", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      const { logApiCall } = await import("./database");
      await logApiCall("/stats", "spotify", 200);

      expect(invoke).toHaveBeenCalledWith("log_api_call", {
        endpoint: "/stats",
        source: "spotify",
        statusCode: 200,
      });
    });
  });
});
