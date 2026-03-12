import { vi } from "vitest";
import { mapStatFields, FIELD_MAP, testApiKey } from "./songstats-api";

// Mock database module
vi.mock("./database", () => ({
  logApiCall: vi.fn(async () => {}),
  saveDailyStat: vi.fn(async () => {}),
  saveTopTracks: vi.fn(async () => {}),
  saveTopCurators: vi.fn(async () => {}),
}));

describe("FIELD_MAP", () => {
  it("maps streams_total to streams", () => {
    expect(FIELD_MAP["streams_total"]).toBe("streams");
  });

  it("maps video_views_total to views", () => {
    expect(FIELD_MAP["video_views_total"]).toBe("views");
  });

  it("maps monthly_listeners_current to monthly_listeners", () => {
    expect(FIELD_MAP["monthly_listeners_current"]).toBe("monthly_listeners");
  });

  it("maps bare monthly_audience for historic data", () => {
    expect(FIELD_MAP["monthly_audience"]).toBe("monthly_audience");
    expect(FIELD_MAP["monthly_audience_current"]).toBe("monthly_audience");
  });
});

describe("mapStatFields", () => {
  it("maps known API fields to stat names", () => {
    const result = mapStatFields({
      streams_total: 1000,
      followers_total: 500,
    });
    expect(result).toEqual({ streams: 1000, followers: 500 });
  });

  it("ignores unmapped fields", () => {
    const result = mapStatFields({
      streams_total: 1000,
      unknown_field: 999,
    });
    expect(result).toEqual({ streams: 1000 });
  });

  it("returns empty object for empty input", () => {
    expect(mapStatFields({})).toEqual({});
  });

  it("takes the max when multiple fields map to the same stat type", () => {
    const result = mapStatFields({
      views_total: 1_000_000,
      video_views_total: 800_000,
    });
    expect(result).toEqual({ views: 1_000_000 });
  });

  it("takes the max regardless of field order", () => {
    const result = mapStatFields({
      video_views_total: 800_000,
      views_total: 1_000_000,
    });
    expect(result).toEqual({ views: 1_000_000 });
  });

  it("handles all field mappings", () => {
    const input: Record<string, number> = {};
    for (const key of Object.keys(FIELD_MAP)) {
      input[key] = 1;
    }
    const result = mapStatFields(input);
    // Each unique mapped value should appear
    const uniqueValues = new Set(Object.values(FIELD_MAP));
    expect(Object.keys(result).length).toBe(uniqueValues.size);
  });
});

describe("testApiKey", () => {
  it("returns valid for successful response", async () => {
    const { fetch } = await import("@tauri-apps/plugin-http");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ artist_info: { name: "Test" } }),
      text: async () => "",
    } as unknown as Response);

    const result = await testApiKey("valid-key");
    expect(result.valid).toBe(true);
  });

  it("returns invalid_key for 401 response", async () => {
    const { fetch } = await import("@tauri-apps/plugin-http");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => "Unauthorized",
    } as unknown as Response);

    const result = await testApiKey("bad-key");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_key");
  });

  it("returns rate_limit for 429 response", async () => {
    const { fetch } = await import("@tauri-apps/plugin-http");
    // All 3 retries return 429
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => "Too Many Requests",
    } as unknown as Response);

    const result = await testApiKey("rate-limited-key");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("rate_limit");

    vi.mocked(fetch).mockReset();
  });

  it("returns network error for other failures", async () => {
    const { fetch } = await import("@tauri-apps/plugin-http");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network failure"));

    const result = await testApiKey("key");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("network");
  });
});
