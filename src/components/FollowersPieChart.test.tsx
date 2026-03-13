import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FollowersPieChart } from "./FollowersPieChart";

// Mock Chart.js — doesn't work in jsdom
vi.mock("react-chartjs-2", () => ({
  Pie: (props: { data: unknown }) => (
    <div data-testid="pie-chart" data-datasets={JSON.stringify(props.data)} />
  ),
}));

describe("FollowersPieChart", () => {
  it("renders total followers and pie chart", () => {
    const stats = new Map<string, Record<string, number>>([
      ["spotify", { followers: 50000, streams: 1000000 }],
      ["youtube", { followers: 30000, views: 500000 }],
      ["tiktok", { followers: 20000, views: 200000 }],
    ]);
    render(<FollowersPieChart platformStats={stats} />);
    expect(screen.getByText("100.0K")).toBeInTheDocument();
    expect(screen.getByText("Total Followers")).toBeInTheDocument();
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("excludes platforms without followers", () => {
    const stats = new Map<string, Record<string, number>>([
      ["spotify", { followers: 50000 }],
      ["shazam", { shazams: 10000 }],
    ]);
    render(<FollowersPieChart platformStats={stats} />);
    const chart = screen.getByTestId("pie-chart");
    const data = JSON.parse(chart.getAttribute("data-datasets") ?? "{}");
    expect(data.labels).toEqual(["Spotify"]);
    expect(data.datasets[0].data).toEqual([50000]);
  });

  it("renders nothing when no platform has followers", () => {
    const stats = new Map<string, Record<string, number>>([["shazam", { shazams: 10000 }]]);
    const { container } = render(<FollowersPieChart platformStats={stats} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing with empty stats", () => {
    const { container } = render(<FollowersPieChart platformStats={new Map()} />);
    expect(container.innerHTML).toBe("");
  });
});
