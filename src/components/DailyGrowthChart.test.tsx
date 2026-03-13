import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DailyGrowthChart } from "./DailyGrowthChart";

// Mock Chart.js — doesn't work in jsdom
vi.mock("react-chartjs-2", () => ({
  Bar: (props: { data: unknown }) => (
    <div data-testid="bar-chart" data-datasets={JSON.stringify(props.data)} />
  ),
}));

const dailyPoints = [
  { date: "2025-03-07", deltas: { spotify: 15000, tiktok: 28000 }, total: 43000 },
  { date: "2025-03-08", deltas: { spotify: 16000, tiktok: 30000 }, total: 46000 },
  { date: "2025-03-09", deltas: { spotify: 14000, tiktok: 25000 }, total: 39000 },
];

describe("DailyGrowthChart", () => {
  it("renders chart with data", () => {
    render(<DailyGrowthChart dailyPoints={dailyPoints} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByText("Daily Growth by Platform")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<DailyGrowthChart dailyPoints={[]} />);
    expect(screen.getByText("No growth data available")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("passes correct dataset structure to Bar chart", () => {
    render(<DailyGrowthChart dailyPoints={dailyPoints} />);
    const chart = screen.getByTestId("bar-chart");
    const data = JSON.parse(chart.getAttribute("data-datasets") ?? "{}");
    expect(data.labels).toEqual(["03-07", "03-08", "03-09"]);
    expect(data.datasets).toHaveLength(2);
  });
});
