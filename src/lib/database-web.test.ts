import { vi, describe, it, expect, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

// Build chainable mock
function buildChain(finalResult: { data: unknown; error: unknown }) {
  mockLimit.mockReturnValue(finalResult);
  mockSingle.mockReturnValue(finalResult);
  mockLte.mockReturnValue({ ...finalResult, order: mockOrder, limit: mockLimit });
  mockGte.mockReturnValue({ lte: mockLte, order: mockOrder, limit: mockLimit, ...finalResult });
  mockOrder.mockReturnValue({
    eq: mockEq,
    limit: mockLimit,
    gte: mockGte,
    data: finalResult.data,
    error: finalResult.error,
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    gte: mockGte,
    lte: mockLte,
    limit: mockLimit,
    single: mockSingle,
    data: finalResult.data,
    error: finalResult.error,
  });
  mockSelect.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    gte: mockGte,
    data: finalResult.data,
    error: finalResult.error,
  });
}

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
      upsert: vi.fn(async () => ({ error: null })),
    }),
  },
  getSupabaseUser: vi.fn(async () => ({ id: "user-123" })),
}));

describe("database-web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLatestStats", () => {
    it("returns empty array when no data", async () => {
      buildChain({ data: [], error: null });
      const { getLatestStats } = await import("./database-web");
      const result = await getLatestStats();
      expect(result).toEqual([]);
    });
  });

  describe("getMonthlyApiCount", () => {
    it("always returns 0 in web mode", async () => {
      const { getMonthlyApiCount } = await import("./database-web");
      const result = await getMonthlyApiCount();
      expect(result).toBe(0);
    });
  });

  describe("write operations are no-ops", () => {
    it("saveDailyStat does nothing", async () => {
      const { saveDailyStat } = await import("./database-web");
      await expect(saveDailyStat()).resolves.toBeUndefined();
    });

    it("logApiCall does nothing", async () => {
      const { logApiCall } = await import("./database-web");
      await expect(logApiCall()).resolves.toBeUndefined();
    });

    it("saveTopTracks does nothing", async () => {
      const { saveTopTracks } = await import("./database-web");
      await expect(saveTopTracks()).resolves.toBeUndefined();
    });

    it("saveTopCurators does nothing", async () => {
      const { saveTopCurators } = await import("./database-web");
      await expect(saveTopCurators()).resolves.toBeUndefined();
    });

    it("saveTrackStats does nothing", async () => {
      const { saveTrackStats } = await import("./database-web");
      await expect(saveTrackStats()).resolves.toBeUndefined();
    });
  });
});
