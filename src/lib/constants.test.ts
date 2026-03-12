import { DEFAULT_SOURCES, DSP_COLORS, DSP_NAMES } from "./constants";

describe("DEFAULT_SOURCES", () => {
  it("has 8 entries", () => {
    expect(DEFAULT_SOURCES).toHaveLength(8);
  });

  it("contains expected platforms", () => {
    expect(DEFAULT_SOURCES).toContain("spotify");
    expect(DEFAULT_SOURCES).toContain("apple_music");
    expect(DEFAULT_SOURCES).toContain("youtube");
    expect(DEFAULT_SOURCES).toContain("tiktok");
  });
});

describe("DSP_COLORS", () => {
  it("has a color for every default source", () => {
    for (const source of DEFAULT_SOURCES) {
      expect(DSP_COLORS[source]).toBeDefined();
    }
  });

  it("all colors are valid hex", () => {
    for (const color of Object.values(DSP_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("DSP_NAMES", () => {
  it("has a name for every default source", () => {
    for (const source of DEFAULT_SOURCES) {
      expect(DSP_NAMES[source]).toBeDefined();
      expect(DSP_NAMES[source].length).toBeGreaterThan(0);
    }
  });
});
