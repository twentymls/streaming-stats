import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Dashboard } from "./Dashboard";

// Mock StatsChart — Chart.js doesn't work in jsdom
vi.mock("./StatsChart", () => ({
  TrendChart: () => <div data-testid="trend-chart" />,
  DistributionChart: () => <div data-testid="distribution-chart" />,
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
vi.mock("../lib/songstats-api", () => ({
  get fetchAllStats() {
    return mockFetchAllStats;
  },
  fetchHistoricStats: vi.fn(async () => {}),
  getArtistInfo: vi.fn(async () => ({ name: "Test Artist" })),
  get fetchAndCacheTopContent() {
    return mockFetchAndCacheTopContent;
  },
  fetchAndCacheTrackStats: vi.fn(async () => {}),
  TOP_TRACKS_SOURCES: ["spotify"],
  TOP_CURATORS_SOURCES: ["spotify"],
}));

// Mock settings
const mockLoadSettings = vi.fn();
const mockGetAutoFetchState = vi.fn();
const mockRecordFetch = vi.fn(async () => {});
vi.mock("../lib/settings", () => ({
  get loadSettings() {
    return mockLoadSettings;
  },
  get getAutoFetchState() {
    return mockGetAutoFetchState;
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
    // Make auto-fetch trigger (no last fetch)
    mockGetAutoFetchState.mockResolvedValue({ lastFetchIso: null, fetchCountToday: 0 });

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

  it("does not show loading overlay when auto-fetch is not needed", async () => {
    mockGetAutoFetchState.mockResolvedValue({
      lastFetchIso: new Date().toISOString(),
      fetchCountToday: 2,
    });
    mockLoadSettings.mockResolvedValue(defaultSettings);

    render(<Dashboard onReset={() => {}} />);

    // Wait for settings to load and auto-fetch check to complete
    await waitFor(() => {
      expect(mockGetAutoFetchState).toHaveBeenCalled();
    });

    // Overlay should not be present
    expect(document.querySelector(".loading-overlay")).not.toBeInTheDocument();
  });
});
