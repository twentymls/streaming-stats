import type { AggregateStats } from "../lib/utils";
import { formatNumber } from "../lib/utils";
import { DSP_CHART_COLORS, DSP_NAMES } from "../lib/constants";

interface KpiRowProps {
  stats: AggregateStats;
  platformDeltas?: Record<string, number>;
}

export function KpiRow({ stats, platformDeltas }: KpiRowProps) {
  const todaySign = stats.todayTotal >= 0 ? "+" : "";
  const todayClass = stats.todayTotal >= 0 ? "kpi-positive" : "kpi-negative";
  const platformColor = DSP_CHART_COLORS[stats.topPlatform.source] ?? "#888";

  const spotifyDaily = platformDeltas?.spotify ?? 0;
  const youtubeDaily = platformDeltas?.youtube ?? 0;

  return (
    <div className="kpi-row">
      <div className={`kpi-card ${todayClass}`}>
        <div className="kpi-value">
          {todaySign}
          {formatNumber(stats.todayTotal)}
        </div>
        <div className="kpi-label">Today&apos;s Growth</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.spotify }}>
          +{formatNumber(spotifyDaily)}
        </div>
        <div className="kpi-label">{DSP_NAMES.spotify} Streams/day</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.youtube }}>
          +{formatNumber(youtubeDaily)}
        </div>
        <div className="kpi-label">{DSP_NAMES.youtube} Views/day</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">+{formatNumber(stats.avgDailyTotal)}/day</div>
        <div className="kpi-label">Avg Daily Growth</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">+{formatNumber(stats.bestDay.total)}</div>
        <div className="kpi-label">Best Day ({stats.bestDay.date.slice(5)})</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value" style={{ color: platformColor }}>
          {DSP_NAMES[stats.topPlatform.source] ?? stats.topPlatform.source}
        </div>
        <div className="kpi-label">Top Platform ({stats.topPlatform.sharePercent.toFixed(0)}%)</div>
      </div>
    </div>
  );
}
