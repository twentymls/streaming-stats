import {
  formatNumber,
  getHeroStat,
  getPlayCountStat,
  computeDailyDeltas,
  computeRollingAverageDeltas,
  computeYesterdayDelta,
  HERO_STAT_PRIORITY,
  PLAY_COUNT_STAT,
} from "./utils";

describe("formatNumber", () => {
  it("returns locale string for numbers under 1000", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatNumber(1_000)).toBe("1.0K");
    expect(formatNumber(1_500)).toBe("1.5K");
    expect(formatNumber(999_999)).toBe("1000.0K");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(1_000_000)).toBe("1.0M");
    expect(formatNumber(1_500_000)).toBe("1.5M");
    expect(formatNumber(10_000_000)).toBe("10.0M");
  });
});

describe("getHeroStat", () => {
  it("returns monthly_listeners for spotify", () => {
    const result = getHeroStat("spotify", {
      streams: 100,
      monthly_listeners: 500,
      followers: 50,
    });
    expect(result).toEqual({ key: "monthly_listeners", value: 500 });
  });

  it("returns views for youtube", () => {
    const result = getHeroStat("youtube", { views: 1000, followers: 200 });
    expect(result).toEqual({ key: "views", value: 1000 });
  });

  it("returns shazams for shazam", () => {
    const result = getHeroStat("shazam", { shazams: 300 });
    expect(result).toEqual({ key: "shazams", value: 300 });
  });

  it("falls back to first entry for unknown source", () => {
    const result = getHeroStat("pandora", { custom_stat: 42 });
    expect(result).toEqual({ key: "custom_stat", value: 42 });
  });

  it("returns null for empty stats", () => {
    const result = getHeroStat("spotify", {});
    expect(result).toBeNull();
  });

  it("falls back through priority list", () => {
    const result = getHeroStat("spotify", { followers: 100 });
    expect(result).toEqual({ key: "followers", value: 100 });
  });
});

describe("HERO_STAT_PRIORITY", () => {
  it("has entries for all 8 default platforms", () => {
    const platforms = [
      "spotify",
      "youtube",
      "tiktok",
      "shazam",
      "soundcloud",
      "apple_music",
      "deezer",
      "amazon",
    ];
    for (const p of platforms) {
      expect(HERO_STAT_PRIORITY[p]).toBeDefined();
      expect(HERO_STAT_PRIORITY[p].length).toBeGreaterThan(0);
    }
  });
});

describe("PLAY_COUNT_STAT", () => {
  it("has entries for all 8 default platforms", () => {
    const platforms = [
      "spotify",
      "youtube",
      "tiktok",
      "shazam",
      "soundcloud",
      "apple_music",
      "deezer",
      "amazon",
    ];
    for (const p of platforms) {
      expect(PLAY_COUNT_STAT[p]).toBeDefined();
    }
  });
});

describe("getPlayCountStat", () => {
  it("returns streams for spotify", () => {
    const result = getPlayCountStat("spotify", {
      streams: 100000,
      monthly_listeners: 50000,
    });
    expect(result).toEqual({ key: "streams", value: 100000 });
  });

  it("returns views for youtube", () => {
    const result = getPlayCountStat("youtube", { views: 5000, followers: 200 });
    expect(result).toEqual({ key: "views", value: 5000 });
  });

  it("returns plays for soundcloud", () => {
    const result = getPlayCountStat("soundcloud", { plays: 3000, followers: 100 });
    expect(result).toEqual({ key: "plays", value: 3000 });
  });

  it("returns shazams for shazam", () => {
    const result = getPlayCountStat("shazam", { shazams: 800 });
    expect(result).toEqual({ key: "shazams", value: 800 });
  });

  it("falls back through candidates for unknown source", () => {
    const result = getPlayCountStat("pandora", { plays: 42 });
    expect(result).toEqual({ key: "plays", value: 42 });
  });

  it("returns null for empty stats", () => {
    const result = getPlayCountStat("spotify", {});
    expect(result).toBeNull();
  });
});

describe("computeDailyDeltas", () => {
  it("computes deltas from cumulative values", () => {
    const stats = [
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 1200 },
      { date: "2025-01-03", source: "spotify", stat_type: "streams", value: 1500 },
    ];
    const result = computeDailyDeltas(stats, "streams");
    expect(result).toEqual([
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 200 },
      { date: "2025-01-03", source: "spotify", stat_type: "streams", value: 300 },
    ]);
  });

  it("filters by stat_type", () => {
    const stats = [
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
      { date: "2025-01-01", source: "spotify", stat_type: "monthly_listeners", value: 500 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 1200 },
      { date: "2025-01-02", source: "spotify", stat_type: "monthly_listeners", value: 520 },
    ];
    const result = computeDailyDeltas(stats, "streams");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(200);
  });

  it("clamps negative deltas to zero", () => {
    const stats = [
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 900 },
    ];
    const result = computeDailyDeltas(stats, "streams");
    expect(result[0].value).toBe(0);
  });

  it("returns empty array for single data point", () => {
    const stats = [{ date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 }];
    expect(computeDailyDeltas(stats, "streams")).toEqual([]);
  });

  it("returns empty array for no matching stat_type", () => {
    const stats = [{ date: "2025-01-01", source: "spotify", stat_type: "followers", value: 100 }];
    expect(computeDailyDeltas(stats, "streams")).toEqual([]);
  });

  it("sorts by date before computing deltas", () => {
    const stats = [
      { date: "2025-01-03", source: "spotify", stat_type: "streams", value: 1500 },
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 1200 },
    ];
    const result = computeDailyDeltas(stats, "streams");
    expect(result).toEqual([
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 200 },
      { date: "2025-01-03", source: "spotify", stat_type: "streams", value: 300 },
    ]);
  });
});

describe("computeRollingAverageDeltas", () => {
  it("smooths uneven cumulative updates into daily average", () => {
    // Simulates SongStats reporting: small deltas then a big catch-up
    const stats = [
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000000 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 1003000 },
      { date: "2025-01-03", source: "spotify", stat_type: "streams", value: 1006000 },
      { date: "2025-01-04", source: "spotify", stat_type: "streams", value: 1009000 },
      { date: "2025-01-05", source: "spotify", stat_type: "streams", value: 1012000 },
      { date: "2025-01-06", source: "spotify", stat_type: "streams", value: 1015000 },
      { date: "2025-01-07", source: "spotify", stat_type: "streams", value: 1018000 },
      { date: "2025-01-08", source: "spotify", stat_type: "streams", value: 1100000 }, // big catch-up
    ];
    const result = computeRollingAverageDeltas(stats, "streams", 8);
    // Last point: (1100000 - 1000000) / 8 days = 12500 (window covers all 8 days)
    // Without rolling avg, raw delta would be 82000 (misleading)
    const lastValue = result[result.length - 1].value;
    expect(lastValue).toBeGreaterThan(10000);
    expect(lastValue).toBeLessThan(20000);
  });

  it("returns empty array for single data point", () => {
    const stats = [{ date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 }];
    expect(computeRollingAverageDeltas(stats, "streams")).toEqual([]);
  });

  it("returns empty array for no matching stat_type", () => {
    const stats = [{ date: "2025-01-01", source: "spotify", stat_type: "followers", value: 100 }];
    expect(computeRollingAverageDeltas(stats, "streams")).toEqual([]);
  });

  it("clamps negative changes to zero", () => {
    const stats = [
      { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
      { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 900 },
    ];
    const result = computeRollingAverageDeltas(stats, "streams");
    expect(result[0].value).toBe(0);
  });

  it("computes correct average over consecutive days", () => {
    // 10 days, 1000 increase each day = average of 1000/day
    const stats = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      source: "spotify",
      stat_type: "streams",
      value: 100000 + i * 1000,
    }));
    const result = computeRollingAverageDeltas(stats, "streams", 7);
    // All values should be ~1000 (uniform growth)
    for (const entry of result) {
      expect(entry.value).toBe(1000);
    }
  });
});

describe("computeYesterdayDelta", () => {
  it("returns delta between the two most recent days", () => {
    const stats = [
      { date: "2025-01-01", source: "tiktok", stat_type: "creates", value: 1000 },
      { date: "2025-01-02", source: "tiktok", stat_type: "creates", value: 1150 },
    ];
    expect(computeYesterdayDelta(stats, "creates")).toBe(150);
  });

  it("returns null when less than 2 data points", () => {
    const stats = [{ date: "2025-01-01", source: "tiktok", stat_type: "creates", value: 1000 }];
    expect(computeYesterdayDelta(stats, "creates")).toBeNull();
  });

  it("returns null when delta is zero or negative", () => {
    const stats = [
      { date: "2025-01-01", source: "youtube", stat_type: "views", value: 5000 },
      { date: "2025-01-02", source: "youtube", stat_type: "views", value: 5000 },
    ];
    expect(computeYesterdayDelta(stats, "views")).toBeNull();
  });

  it("picks most recent two dates regardless of input order", () => {
    const stats = [
      { date: "2025-01-03", source: "tiktok", stat_type: "creates", value: 2000 },
      { date: "2025-01-01", source: "tiktok", stat_type: "creates", value: 1000 },
      { date: "2025-01-02", source: "tiktok", stat_type: "creates", value: 1500 },
    ];
    expect(computeYesterdayDelta(stats, "creates")).toBe(500);
  });
});
