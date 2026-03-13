import { render, screen, fireEvent } from "@testing-library/react";
import { GrowthShare } from "./GrowthShare";
import type { PlatformSummary } from "../lib/utils";

const summaries: PlatformSummary[] = [
  { source: "tiktok", totalGrowth: 275140, avgDailyGrowth: 27514, sharePercent: 58.2 },
  { source: "spotify", totalGrowth: 151920, avgDailyGrowth: 15192, sharePercent: 32.1 },
  { source: "youtube", totalGrowth: 46370, avgDailyGrowth: 4637, sharePercent: 9.8 },
];

describe("GrowthShare", () => {
  it("renders all platform rows", () => {
    render(<GrowthShare summaries={summaries} />);
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("renders share percentages", () => {
    render(<GrowthShare summaries={summaries} />);
    expect(screen.getByText("58.2%")).toBeInTheDocument();
    expect(screen.getByText("32.1%")).toBeInTheDocument();
    expect(screen.getByText("9.8%")).toBeInTheDocument();
  });

  it("renders avg daily growth values", () => {
    render(<GrowthShare summaries={summaries} />);
    expect(screen.getByText("+27.5K/day")).toBeInTheDocument();
    expect(screen.getByText("+15.2K/day")).toBeInTheDocument();
    expect(screen.getByText("+4.6K/day")).toBeInTheDocument();
  });

  it("calls onPlatformClick when row is clicked", () => {
    const handleClick = vi.fn();
    render(<GrowthShare summaries={summaries} onPlatformClick={handleClick} />);
    fireEvent.click(screen.getByText("Spotify"));
    expect(handleClick).toHaveBeenCalledWith("spotify");
  });

  it("renders empty state when no summaries", () => {
    render(<GrowthShare summaries={[]} />);
    expect(screen.getByText("No growth data available")).toBeInTheDocument();
  });

  it("renders heading", () => {
    render(<GrowthShare summaries={summaries} />);
    expect(screen.getByText("Growth Share")).toBeInTheDocument();
  });
});
