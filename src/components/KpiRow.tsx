import type { AggregateStats } from "../lib/utils";
import { formatNumber } from "../lib/utils";
import { DSP_CHART_COLORS, DSP_NAMES } from "../lib/constants";
import { PlatformIcon } from "./PlatformIcon";

interface KpiRowProps {
  stats: AggregateStats;
  platformDeltas?: Record<string, number>;
}

export function KpiRow({ stats, platformDeltas }: KpiRowProps) {
  const todaySign = stats.todayTotal >= 0 ? "+" : "";
  const todayClass = stats.todayTotal >= 0 ? "kpi-positive" : "kpi-negative";

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
        <div className="kpi-hint">All platforms combined</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.spotify }}>
          +{formatNumber(spotifyDaily)}
        </div>
        <div className="kpi-label kpi-label-icon">
          <PlatformIcon source="spotify" size={14} />
          {DSP_NAMES.spotify} Streams/day
        </div>
        <div className="kpi-hint">Yesterday&apos;s new streams</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.youtube }}>
          +{formatNumber(youtubeDaily)}
        </div>
        <div className="kpi-label kpi-label-icon">
          <PlatformIcon source="youtube" size={14} />
          {DSP_NAMES.youtube} Views/day
        </div>
        <div className="kpi-hint">Yesterday&apos;s new views</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">+{formatNumber(stats.avgDailyTotal)}/day</div>
        <div className="kpi-label">Avg Daily Growth</div>
        <div className="kpi-hint">Mean daily gain in period</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value">+{formatNumber(stats.bestDay.total)}</div>
        <div className="kpi-label">Best Day ({stats.bestDay.date.slice(5)})</div>
        <div className="kpi-hint">Highest single-day total</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-value kpi-value-icon">
          <PlatformIcon source={stats.topPlatform.source} size={22} />
          {DSP_NAMES[stats.topPlatform.source] ?? stats.topPlatform.source}
        </div>
        <div className="kpi-label">Top Platform ({stats.topPlatform.sharePercent.toFixed(0)}%)</div>
        <div className="kpi-hint">Most growth in period</div>
      </div>
    </div>
  );
}
