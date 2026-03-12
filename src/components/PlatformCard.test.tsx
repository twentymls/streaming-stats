import { render, screen, fireEvent } from "@testing-library/react";
import { PlatformCard } from "./PlatformCard";

describe("PlatformCard", () => {
  it("renders platform name and formatted main stat", () => {
    render(
      <PlatformCard
        source="spotify"
        stats={{ streams: 1500000 }}
      />
    );
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("1.5M")).toBeInTheDocument();
  });

  it("picks streams as main stat over followers", () => {
    render(
      <PlatformCard
        source="spotify"
        stats={{ followers: 500, streams: 1000 }}
      />
    );
    // Main stat should be streams (1.0K), followers as sub-stat
    expect(screen.getByText("1.0K")).toBeInTheDocument();
  });

  it("picks views as main stat", () => {
    render(
      <PlatformCard
        source="youtube"
        stats={{ views: 2000, followers: 100 }}
      />
    );
    expect(screen.getByText("2.0K")).toBeInTheDocument();
  });

  it("shows up to 3 sub-stats", () => {
    render(
      <PlatformCard
        source="spotify"
        stats={{
          streams: 1000,
          followers: 200,
          monthly_listeners: 300,
          playlist_count: 50,
          chart_entries: 10,
        }}
      />
    );
    // Main stat is streams, so sub-stats are followers, monthly_listeners, playlist_count (3 max)
    const subStats = document.querySelectorAll(".sub-stat");
    expect(subStats.length).toBe(3);
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <PlatformCard
        source="spotify"
        stats={{ streams: 1000 }}
        onClick={handleClick}
      />
    );
    fireEvent.click(screen.getByText("Spotify"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("handles unknown source gracefully", () => {
    render(
      <PlatformCard
        source="pandora"
        stats={{ plays: 500 }}
      />
    );
    // Falls back to source string as name
    expect(screen.getByText("pandora")).toBeInTheDocument();
  });
});
