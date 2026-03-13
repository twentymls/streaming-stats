import { render } from "@testing-library/react";
import { PlatformIcon } from "./PlatformIcon";

describe("PlatformIcon", () => {
  it("renders an SVG icon for known platforms", () => {
    const { container } = render(<PlatformIcon source="spotify" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("platform-icon");
  });

  it("renders a colored fallback span for unknown platforms", () => {
    const { container } = render(<PlatformIcon source="pandora" />);
    const span = container.querySelector("span.platform-icon");
    expect(span).toBeInTheDocument();
    expect(span).toHaveStyle({ backgroundColor: "#888" });
  });

  it("renders a colored fallback for platforms without icons (deezer, amazon)", () => {
    const { container: deezerContainer } = render(<PlatformIcon source="deezer" />);
    const deezerSpan = deezerContainer.querySelector("span.platform-icon");
    expect(deezerSpan).toBeInTheDocument();
    expect(deezerSpan).toHaveStyle({ backgroundColor: "#A238FF" });

    const { container: amazonContainer } = render(<PlatformIcon source="amazon" />);
    const amazonSpan = amazonContainer.querySelector("span.platform-icon");
    expect(amazonSpan).toBeInTheDocument();
    expect(amazonSpan).toHaveStyle({ backgroundColor: "#00A8E1" });
  });

  it("applies custom size", () => {
    const { container } = render(<PlatformIcon source="spotify" size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
