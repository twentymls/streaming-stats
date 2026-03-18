import { vi, describe, it, expect } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    }),
  },
  getSupabaseUser: vi.fn(async () => null),
}));

describe("settings-web", () => {
  describe("loadSettings", () => {
    it("returns null when no user", async () => {
      const { loadSettings } = await import("./settings-web");
      const result = await loadSettings();
      expect(result).toBeNull();
    });
  });

  describe("hasApiKey", () => {
    it("returns false when no user", async () => {
      const { hasApiKey } = await import("./settings-web");
      const result = await hasApiKey();
      expect(result).toBe(false);
    });
  });

  describe("getScheduledFetchInfo", () => {
    it("always returns no-fetch state", async () => {
      const { getScheduledFetchInfo } = await import("./settings-web");
      const result = await getScheduledFetchInfo();
      expect(result).toEqual({
        shouldFetchNow: false,
        shouldDeferToFetchHour: false,
        msUntilFetchHour: 0,
      });
    });
  });

  describe("recordFetch", () => {
    it("is a no-op", async () => {
      const { recordFetch } = await import("./settings-web");
      await expect(recordFetch()).resolves.toBeUndefined();
    });
  });

  describe("saveSettings", () => {
    it("is a no-op", async () => {
      const { saveSettings } = await import("./settings-web");
      await expect(saveSettings()).resolves.toBeUndefined();
    });
  });

  describe("getAutoFetchState", () => {
    it("returns defaults", async () => {
      const { getAutoFetchState } = await import("./settings-web");
      const result = await getAutoFetchState();
      expect(result).toEqual({ lastFetchIso: null, fetchCountToday: 0 });
    });
  });
});
