import { describe, it, expect } from "vitest";
import { FIELD_MAP, mapStatFields } from "./songstats-fields";

describe("songstats-fields", () => {
  describe("FIELD_MAP", () => {
    it("maps streams_total to streams", () => {
      expect(FIELD_MAP["streams_total"]).toBe("streams");
    });

    it("maps followers_total to followers", () => {
      expect(FIELD_MAP["followers_total"]).toBe("followers");
    });

    it("maps subscribers_total to followers", () => {
      expect(FIELD_MAP["subscribers_total"]).toBe("followers");
    });

    it("maps both views_total and video_views_total to views", () => {
      expect(FIELD_MAP["views_total"]).toBe("views");
      expect(FIELD_MAP["video_views_total"]).toBe("views");
    });
  });

  describe("mapStatFields", () => {
    it("maps raw API fields to normalized stat types", () => {
      const raw = { streams_total: 50000, followers_total: 1000 };
      const result = mapStatFields(raw);
      expect(result).toEqual({ streams: 50000, followers: 1000 });
    });

    it("takes max when multiple fields map to the same type", () => {
      const raw = { views_total: 100, video_views_total: 200 };
      const result = mapStatFields(raw);
      expect(result).toEqual({ views: 200 });
    });

    it("ignores unmapped fields", () => {
      const raw = { streams_total: 100, unknown_field: 999 };
      const result = mapStatFields(raw);
      expect(result).toEqual({ streams: 100 });
    });

    it("returns empty object for empty input", () => {
      expect(mapStatFields({})).toEqual({});
    });
  });
});
