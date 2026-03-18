import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";

// Mock chart components
vi.mock("./components/DailyGrowthChart", () => ({
  DailyGrowthChart: () => <div data-testid="daily-growth-chart" />,
}));

vi.mock("./components/KpiRow", () => ({
  KpiRow: () => <div data-testid="kpi-row" />,
}));

vi.mock("./components/GrowthShare", () => ({
  GrowthShare: () => <div data-testid="growth-share" />,
}));

vi.mock("./components/PlatformCard", () => ({
  PlatformCard: ({ source }: { source: string }) => <div data-testid={`card-${source}`} />,
}));

vi.mock("./components/PlatformDetail", () => ({
  PlatformDetail: () => <div data-testid="platform-detail" />,
}));

vi.mock("./components/Settings", () => ({
  Settings: () => <div data-testid="settings" />,
}));

vi.mock("./components/LoginPage", () => ({
  LoginPage: () => <div data-testid="login-page" />,
}));

const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn((_callback: unknown) => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      signOut: vi.fn(async () => {}),
      onAuthStateChange: (callback: unknown) => mockOnAuthStateChange(callback),
    },
  },
}));

// Mock database and settings for Dashboard
vi.mock("./lib/database", () => ({
  getLatestStats: vi.fn(async () => []),
  getStatsRange: vi.fn(async () => []),
  getMonthlyApiCount: vi.fn(async () => 0),
  getAllCachedTopTracks: vi.fn(async () => new Map()),
  getAllCachedTopCurators: vi.fn(async () => new Map()),
  getTopTrackDeltas: vi.fn(async () => new Map()),
  getLatestTrackStats: vi.fn(async () => []),
  getTrackStatsLastFetch: vi.fn(async () => null),
}));

vi.mock("./lib/songstats-api", () => ({
  fetchAllStats: vi.fn(async () => []),
  fetchHistoricStats: vi.fn(async () => {}),
  getArtistInfo: vi.fn(async () => ({ name: "Test Artist" })),
  fetchAndCacheTopContent: vi.fn(async () => {}),
  fetchAndCacheTrackStats: vi.fn(async () => {}),
  TOP_TRACKS_SOURCES: ["spotify"],
  TOP_CURATORS_SOURCES: ["spotify"],
}));

vi.mock("./lib/settings", () => ({
  loadSettings: vi.fn(async () => null),
  getScheduledFetchInfo: vi.fn(async () => ({
    shouldFetchNow: false,
    shouldDeferToFetchHour: false,
    msUntilFetchHour: 0,
  })),
  recordFetch: vi.fn(async () => {}),
}));

describe("PwaApp", () => {
  it("shows login page when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { PwaApp } = await import("./PwaApp");
    render(<PwaApp />);

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  it("shows dashboard when user is authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@test.com" } },
    });

    const { PwaApp } = await import("./PwaApp");
    render(<PwaApp />);

    await waitFor(() => {
      expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    });
  });
});
