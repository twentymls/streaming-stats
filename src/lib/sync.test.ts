import { vi, describe, it, expect, beforeEach } from "vitest";

// Override the global mock from setup.ts so we can test the real sync module
vi.unmock("../lib/sync");
vi.unmock("./sync");

// Mock supabase
const mockUpsert = vi.fn(async () => ({ error: null }));
const mockFrom = vi.fn((_table: string) => ({
  upsert: mockUpsert,
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
  getSupabaseUser: vi.fn(async () => ({ id: "user-123", email: "test@example.com" })),
}));

// Mock database
vi.mock("./database", () => ({
  getStatsRange: vi.fn(async () => [
    { date: "2026-03-18", source: "spotify", stat_type: "streams", value: 50000 },
    { date: "2026-03-18", source: "spotify", stat_type: "followers", value: 1000 },
  ]),
  getAllCachedTopTracks: vi.fn(async () => {
    const m = new Map();
    m.set("spotify", [
      { title: "Song A", streams: 5000, artwork_url: "https://example.com/a.jpg" },
    ]);
    return m;
  }),
  getAllCachedTopCurators: vi.fn(async () => new Map()),
}));

// Mock settings
vi.mock("./settings", () => ({
  loadSettings: vi.fn(async () => ({
    api_key: "test-key",
    spotify_artist_id: "abc123",
    artist_name: "Test Artist",
    enabled_sources: ["spotify"],
  })),
}));

describe("sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  describe("syncToSupabase", () => {
    it("upserts daily_stats, top_tracks, and user_settings", async () => {
      const { syncToSupabase } = await import("./sync");
      await syncToSupabase();

      const tableNames = mockFrom.mock.calls.map((c: string[]) => c[0]);
      expect(tableNames).toContain("daily_stats");
      expect(tableNames).toContain("top_tracks");
      expect(tableNames).toContain("user_settings");
    });

    it("includes user_id in upserted rows", async () => {
      const { syncToSupabase } = await import("./sync");
      await syncToSupabase();

      const dailyStatsIdx = mockFrom.mock.calls.findIndex((c: string[]) => c[0] === "daily_stats");
      expect(dailyStatsIdx).toBeGreaterThanOrEqual(0);

      const upsertArgs = mockUpsert.mock.calls[dailyStatsIdx] as unknown[];
      const rows = upsertArgs[0] as Array<{ user_id: string }>;
      expect(rows[0].user_id).toBe("user-123");
    });
  });

  describe("syncAllHistory", () => {
    it("upserts all history data", async () => {
      const { syncAllHistory } = await import("./sync");
      await syncAllHistory();

      const tableNames = mockFrom.mock.calls.map((c: string[]) => c[0]);
      expect(tableNames).toContain("daily_stats");
      expect(tableNames).toContain("top_tracks");
      expect(tableNames).toContain("user_settings");
    });
  });

  describe("syncSettings", () => {
    it("upserts settings with last_sync_at timestamp", async () => {
      const { syncSettings } = await import("./sync");
      await syncSettings();

      const settingsIdx = mockFrom.mock.calls.findIndex((c: string[]) => c[0] === "user_settings");
      expect(settingsIdx).toBeGreaterThanOrEqual(0);

      const upsertArgs = mockUpsert.mock.calls[settingsIdx] as unknown[];
      const row = upsertArgs[0] as {
        user_id: string;
        artist_name: string;
        spotify_artist_id: string;
        last_sync_at: string;
      };
      expect(row.user_id).toBe("user-123");
      expect(row.artist_name).toBe("Test Artist");
      expect(row.spotify_artist_id).toBe("abc123");
      expect(row.last_sync_at).toBeDefined();
    });
  });
});
