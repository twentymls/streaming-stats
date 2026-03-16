import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Dashboard } from "./Dashboard";

// Mock chart components — Chart.js doesn't work in jsdom
vi.mock("./DailyGrowthChart", () => ({
  DailyGrowthChart: () => <div data-testid="daily-growth-chart" />,
}));

vi.mock("./KpiRow", () => ({
  KpiRow: () => <div data-testid="kpi-row" />,
}));

vi.mock("./GrowthShare", () => ({
  GrowthShare: () => <div data-testid="growth-share" />,
}));

// Mock child components to keep tests focused
vi.mock("./PlatformCard", () => ({
  PlatformCard: ({ source }: { source: string }) => <div data-testid={`card-${source}`} />,
}));

vi.mock("./PlatformDetail", () => ({
  PlatformDetail: () => <div data-testid="platform-detail" />,
}));

vi.mock("./Settings", () => ({
  Settings: () => <div data-testid="settings" />,
}));

// Mock database functions
vi.mock("../lib/database", () => ({
  getLatestStats: vi.fn(async () => []),
  getStatsRange: vi.fn(async () => []),
  getMonthlyApiCount: vi.fn(async () => 0),
  getAllCachedTopTracks: vi.fn(async () => new Map()),
  getAllCachedTopCurators: vi.fn(async () => new Map()),
  getTopTrackDeltas: vi.fn(async () => new Map()),
  getLatestTrackStats: vi.fn(async () => []),
  getTrackStatsLastFetch: vi.fn(async () => null),
}));

// Mock songstats-api functions
const mockFetchAllStats = vi.fn(async () => {});
const mockFetchAndCacheTopContent = vi.fn(async () => {});
const mockFetchAndCacheTrackStats = vi.fn(async () => {});
vi.mock("../lib/songstats-api", () => ({
  get fetchAllStats() {
    return mockFetchAllStats;
  },
  fetchHistoricStats: vi.fn(async () => {}),
  getArtistInfo: vi.fn(async () => ({ name: "Test Artist" })),
  get fetchAndCacheTopContent() {
    return mockFetchAndCacheTopContent;
  },
  get fetchAndCacheTrackStats() {
    return mockFetchAndCacheTrackStats;
  },
  TOP_TRACKS_SOURCES: ["spotify"],
  TOP_CURATORS_SOURCES: ["spotify"],
}));

// Mock settings
const mockLoadSettings = vi.fn();
const mockGetScheduledFetchInfo = vi.fn();
const mockRecordFetch = vi.fn(async () => {});
vi.mock("../lib/settings", () => ({
  get loadSettings() {
    return mockLoadSettings;
  },
  get getScheduledFetchInfo() {
    return mockGetScheduledFetchInfo;
  },
  get recordFetch() {
    return mockRecordFetch;
  },
}));

const defaultSettings = {
  api_key: "test-key",
  spotify_artist_id: "abc123",
  artist_name: "Test Artist",
  enabled_sources: ["spotify"],
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading overlay during initial auto-fetch", async () => {
    // Schedule says fetch now
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: true,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });

    // Settings loads immediately
    mockLoadSettings.mockResolvedValue(defaultSettings);

    // Make fetchAllStats take a while so we can observe the overlay
    let resolveFetch!: () => void;
    mockFetchAllStats.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = resolve;
        })
    );
    mockFetchAndCacheTopContent.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolve();
        })
    );

    render(<Dashboard onReset={() => {}} />);

    // Overlay should appear once auto-fetch starts
    await waitFor(() => {
      expect(screen.getByText("Updating stats...")).toBeInTheDocument();
    });
    expect(document.querySelector(".loading-overlay")).toBeInTheDocument();

    // Resolve the fetch
    resolveFetch();

    // Overlay should disappear after fetch completes
    await waitFor(() => {
      expect(document.querySelector(".loading-overlay")).not.toBeInTheDocument();
    });
  });

  it("does not show loading overlay when already fetched today", async () => {
    // Schedule says already done
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: false,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    render(<Dashboard onReset={() => {}} />);

    // Wait for settings to load and schedule check to complete
    await waitFor(() => {
      expect(mockGetScheduledFetchInfo).toHaveBeenCalled();
    });

    // Overlay should not be present
    expect(document.querySelector(".loading-overlay")).not.toBeInTheDocument();
  });

  it("does not render an Update button", async () => {
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: false,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    render(<Dashboard onReset={() => {}} />);

    await waitFor(() => {
      expect(mockGetScheduledFetchInfo).toHaveBeenCalled();
    });

    expect(screen.queryByText("Update")).not.toBeInTheDocument();
    expect(screen.queryByText("Done for today")).not.toBeInTheDocument();
  });

  it("shows 'Up to date' status with countdown when already fetched today", async () => {
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: false,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    render(<Dashboard onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Up to date/)).toBeInTheDocument();
      expect(screen.getByText(/until refresh/)).toBeInTheDocument();
    });
  });

  it("shows countdown when deferred to fetch hour", async () => {
    // Defer for 2 hours
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: false,
      shouldDeferToFetchHour: true,
      msUntilFetchHour: 2 * 60 * 60 * 1000,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    render(<Dashboard onReset={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/until refresh/)).toBeInTheDocument();
    });
  });

  it("records fetch even when secondary operations fail", async () => {
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: true,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);
    mockFetchAllStats.mockResolvedValue(undefined);

    // Secondary operation fails
    mockFetchAndCacheTopContent.mockRejectedValue(new Error("rate limited"));

    render(<Dashboard onReset={() => {}} />);

    await waitFor(() => {
      expect(mockRecordFetch).toHaveBeenCalled();
    });

    // Should still show "Up to date" despite secondary failure
    await waitFor(() => {
      expect(screen.getByText(/Up to date/)).toBeInTheDocument();
    });
  });

  it("does not record fetch when fetchAllStats fails", async () => {
    mockGetScheduledFetchInfo.mockResolvedValue({
      shouldFetchNow: true,
      shouldDeferToFetchHour: false,
      msUntilFetchHour: 0,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    // Core operation fails
    mockFetchAllStats.mockRejectedValue(new Error("network error"));

    render(<Dashboard onReset={() => {}} />);

    // Wait for the fetch attempt to complete
    await waitFor(() => {
      expect(mockFetchAllStats).toHaveBeenCalled();
    });

    // recordFetch should NOT have been called
    expect(mockRecordFetch).not.toHaveBeenCalled();
  });
});
