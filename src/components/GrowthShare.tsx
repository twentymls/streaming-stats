import type { PlatformSummary } from "../lib/utils";
import { formatNumber } from "../lib/utils";
import { DSP_CHART_COLORS, DSP_NAMES } from "../lib/constants";

interface GrowthShareProps {
  summaries: PlatformSummary[];
  onPlatformClick?: (source: string) => void;
}

export function GrowthShare({ summaries, onPlatformClick }: GrowthShareProps) {
  if (summaries.length === 0) {
    return (
      <div className="growth-share-empty">
        <p>No growth data available</p>
      </div>
    );
  }

  const maxShare = Math.max(...summaries.map((s) => s.sharePercent));

  return (
    <div className="growth-share">
      <h3>Growth Share</h3>
      <div className="growth-share-list">
        {summaries.map((summary) => {
          const color = DSP_CHART_COLORS[summary.source] ?? "#888";
          const barWidth = maxShare > 0 ? (summary.sharePercent / maxShare) * 100 : 0;
          return (
            <div
              key={summary.source}
              className="growth-share-row"
              onClick={() => onPlatformClick?.(summary.source)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPlatformClick?.(summary.source);
              }}
            >
              <span className="growth-share-name" style={{ color }}>
                {DSP_NAMES[summary.source] ?? summary.source}
              </span>
              <div className="growth-share-bar-track">
                <div
                  className="growth-share-bar-fill"
                  style={{ width: `${barWidth}%`, backgroundColor: color }}
                />
              </div>
              <span className="growth-share-percent">{summary.sharePercent.toFixed(1)}%</span>
              <span className="growth-share-avg">+{formatNumber(summary.avgDailyGrowth)}/day</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
