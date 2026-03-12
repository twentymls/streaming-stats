import { formatNumber, getHeroStat, HERO_STAT_PRIORITY } from "./utils";

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
