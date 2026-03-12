import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { PlatformDetail } from "./PlatformDetail";

// Mock StatsChart — Chart.js doesn't work in jsdom
vi.mock("./StatsChart", () => ({
  TrendChart: ({ title }: { title: string }) => <div data-testid="trend-chart">{title}</div>,
}));

const defaultProps = {
  source: "spotify",
  stats: { streams: 100000, monthly_listeners: 50000, followers: 2000 },
  historicStats: [],
  topTracks: [],
  topCurators: [],
  onBack: vi.fn(),
};

describe("PlatformDetail", () => {
  it("renders hero stat based on platform priority", () => {
    render(<PlatformDetail {...defaultProps} />);
    // Spotify priority: monthly_listeners first
    expect(screen.getByText("50.0K")).toBeInTheDocument();
    expect(screen.getByText("Monthly Listeners")).toBeInTheDocument();
  });

  it("shows back button that calls onBack", () => {
    const onBack = vi.fn();
    render(<PlatformDetail {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders 'not available' when no top tracks", () => {
    render(<PlatformDetail {...defaultProps} />);
    expect(screen.getByText(/top tracks not available/i)).toBeInTheDocument();
  });

  it("renders top tracks list", () => {
    render(
      <PlatformDetail
        {...defaultProps}
        topTracks={[
          { title: "Song One", streams: 5000 },
          { title: "Song Two", streams: 3000 },
        ]}
      />
    );
    expect(screen.getByText("Song One")).toBeInTheDocument();
    expect(screen.getByText("Song Two")).toBeInTheDocument();
  });

  it("shows curators section only for TikTok", () => {
    const { rerender } = render(<PlatformDetail {...defaultProps} />);
    expect(screen.queryByText("Top Curators")).not.toBeInTheDocument();

    rerender(
      <PlatformDetail
        {...defaultProps}
        source="tiktok"
        stats={{ views: 1000, creates: 500 }}
        topCurators={[]}
      />
    );
    expect(screen.getByText("Top Curators")).toBeInTheDocument();
  });

  it("renders period selector buttons when historic data exists", () => {
    // Use today's date so it passes the 30-day cutoff filter
    const today = new Date().toISOString().slice(0, 10);
    render(
      <PlatformDetail
        {...defaultProps}
        historicStats={[{ date: today, source: "spotify", stat_type: "streams", value: 1000 }]}
      />
    );
    expect(screen.getByText("7d")).toBeInTheDocument();
    expect(screen.getByText("30d")).toBeInTheDocument();
    expect(screen.getByText("60d")).toBeInTheDocument();
    expect(screen.getByText("90d")).toBeInTheDocument();
  });

  it("renders today's play count card for spotify", () => {
    render(<PlatformDetail {...defaultProps} />);
    // Hero is monthly_listeners, play count is streams — card should show
    expect(screen.getByText("Today's Streams")).toBeInTheDocument();
    expect(screen.getByText("100.0K")).toBeInTheDocument();
  });

  it("does not render play count card when it matches hero stat", () => {
    // YouTube: hero=views, play count=views → should NOT show card
    render(
      <PlatformDetail {...defaultProps} source="youtube" stats={{ views: 5000, followers: 200 }} />
    );
    expect(screen.queryByText(/Today's/)).not.toBeInTheDocument();
  });
});
