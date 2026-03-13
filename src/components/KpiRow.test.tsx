import { render, screen } from "@testing-library/react";
import { KpiRow } from "./KpiRow";
import type { AggregateStats } from "../lib/utils";

const defaultStats: AggregateStats = {
  todayTotal: 47231,
  avgDailyTotal: 38892,
  bestDay: { date: "2025-03-08", total: 62104 },
  topPlatform: { source: "tiktok", sharePercent: 58.2 },
};

describe("KpiRow", () => {
  it("renders today's growth with positive formatting", () => {
    render(<KpiRow stats={defaultStats} />);
    expect(screen.getByText("Today's Growth")).toBeInTheDocument();
    expect(screen.getByText(/47\.2K/)).toBeInTheDocument();
  });

  it("renders average daily growth", () => {
    render(<KpiRow stats={defaultStats} />);
    expect(screen.getByText("Avg Daily Growth")).toBeInTheDocument();
    expect(screen.getByText(/38\.9K\/day/)).toBeInTheDocument();
  });

  it("renders best day with date", () => {
    render(<KpiRow stats={defaultStats} />);
    expect(screen.getByText(/Best Day/)).toBeInTheDocument();
    expect(screen.getByText(/62\.1K/)).toBeInTheDocument();
  });

  it("renders top platform with name and share", () => {
    render(<KpiRow stats={defaultStats} />);
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText(/58%/)).toBeInTheDocument();
  });

  it("applies positive class for positive growth", () => {
    const { container } = render(<KpiRow stats={defaultStats} />);
    expect(container.querySelector(".kpi-positive")).toBeInTheDocument();
  });

  it("applies negative class for negative growth", () => {
    const negativeStats: AggregateStats = {
      ...defaultStats,
      todayTotal: -500,
    };
    const { container } = render(<KpiRow stats={negativeStats} />);
    expect(container.querySelector(".kpi-negative")).toBeInTheDocument();
  });

  it("handles zero values gracefully", () => {
    const zeroStats: AggregateStats = {
      todayTotal: 0,
      avgDailyTotal: 0,
      bestDay: { date: "", total: 0 },
      topPlatform: { source: "", sharePercent: 0 },
    };
    render(<KpiRow stats={zeroStats} />);
    expect(screen.getByText("Today's Growth")).toBeInTheDocument();
  });

  it("renders Spotify daily streams when platformDeltas provided", () => {
    render(<KpiRow stats={defaultStats} platformDeltas={{ spotify: 15200, youtube: 4600 }} />);
    expect(screen.getByText("Spotify Streams/day")).toBeInTheDocument();
    expect(screen.getByText(/15\.2K/)).toBeInTheDocument();
  });

  it("renders YouTube daily views when platformDeltas provided", () => {
    render(<KpiRow stats={defaultStats} platformDeltas={{ spotify: 15200, youtube: 4600 }} />);
    expect(screen.getByText("YouTube Views/day")).toBeInTheDocument();
    expect(screen.getByText(/4\.6K/)).toBeInTheDocument();
  });

  it("shows zero for Spotify/YouTube when platformDeltas not provided", () => {
    render(<KpiRow stats={defaultStats} />);
    expect(screen.getByText("Spotify Streams/day")).toBeInTheDocument();
    expect(screen.getByText("YouTube Views/day")).toBeInTheDocument();
  });
});
