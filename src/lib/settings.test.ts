import { vi, beforeEach } from "vitest";
import { load } from "@tauri-apps/plugin-store";

describe("settings", () => {
  let store: Map<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    store = new Map<string, unknown>();
    vi.mocked(load).mockResolvedValue({
      get: vi.fn(async (key: string) => store.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      save: vi.fn(async () => {}),
    } as unknown as Awaited<ReturnType<typeof load>>);
  });

  describe("loadSettings", () => {
    it("returns null when no api_key exists", async () => {
      const { loadSettings } = await import("./settings");
      const result = await loadSettings();
      expect(result).toBeNull();
    });

    it("returns full AppSettings with defaults for optional fields", async () => {
      store.set("api_key", "test-key-123");
      store.set("spotify_artist_id", "artist-id");

      const { loadSettings } = await import("./settings");
      const result = await loadSettings();

      expect(result).not.toBeNull();
      expect(result!.api_key).toBe("test-key-123");
      expect(result!.spotify_artist_id).toBe("artist-id");
      expect(result!.artist_name).toBe("");
      expect(result!.enabled_sources).toHaveLength(8);
      expect(result!.fetch_hour).toBe(6);
    });
  });

  describe("saveSettings", () => {
    it("calls store.set for all fields and save", async () => {
      const { saveSettings } = await import("./settings");
      const mockStore = await load("settings.json");

      await saveSettings({
        api_key: "key",
        spotify_artist_id: "artist",
        artist_name: "Test Artist",
        enabled_sources: ["spotify"],
        fetch_hour: 8,
      });

      expect(mockStore.set).toHaveBeenCalledWith("api_key", "key");
      expect(mockStore.set).toHaveBeenCalledWith("spotify_artist_id", "artist");
      expect(mockStore.set).toHaveBeenCalledWith("artist_name", "Test Artist");
      expect(mockStore.set).toHaveBeenCalledWith("enabled_sources", ["spotify"]);
      expect(mockStore.set).toHaveBeenCalledWith("fetch_hour", 8);
      expect(mockStore.save).toHaveBeenCalled();
    });
  });

  describe("hasApiKey", () => {
    it("returns true when key exists", async () => {
      store.set("api_key", "some-key");
      const { hasApiKey } = await import("./settings");
      expect(await hasApiKey()).toBe(true);
    });

    it("returns false when no key", async () => {
      const { hasApiKey } = await import("./settings");
      expect(await hasApiKey()).toBe(false);
    });

    it("returns false when key is empty string", async () => {
      store.set("api_key", "");
      const { hasApiKey } = await import("./settings");
      expect(await hasApiKey()).toBe(false);
    });
  });

  describe("getAutoFetchState", () => {
    it("returns zero count when no prior fetch", async () => {
      const { getAutoFetchState } = await import("./settings");
      const result = await getAutoFetchState();
      expect(result.lastFetchIso).toBeNull();
      expect(result.fetchCountToday).toBe(0);
    });

    it("resets counter when date changes", async () => {
      store.set("last_fetch_iso", "2025-01-01T10:00:00.000Z");
      store.set("fetch_count_today", 5);

      const { getAutoFetchState } = await import("./settings");
      const result = await getAutoFetchState();
      expect(result.fetchCountToday).toBe(0);
    });

    it("returns stored count for today", async () => {
      const today = new Date().toLocaleDateString("sv");
      store.set("last_fetch_iso", `${today}T10:00:00.000Z`);
      store.set("fetch_count_today", 3);

      const { getAutoFetchState } = await import("./settings");
      const result = await getAutoFetchState();
      expect(result.fetchCountToday).toBe(3);
    });
  });

  describe("recordFetch", () => {
    it("increments counter on same day", async () => {
      const today = new Date().toLocaleDateString("sv");
      store.set("last_fetch_iso", `${today}T08:00:00.000Z`);
      store.set("fetch_count_today", 2);

      const { recordFetch } = await import("./settings");
      await recordFetch();

      expect(store.get("fetch_count_today")).toBe(3);
    });

    it("resets to 1 on new day", async () => {
      store.set("last_fetch_iso", "2025-01-01T08:00:00.000Z");
      store.set("fetch_count_today", 5);

      const { recordFetch } = await import("./settings");
      await recordFetch();

      expect(store.get("fetch_count_today")).toBe(1);
    });
  });
});
