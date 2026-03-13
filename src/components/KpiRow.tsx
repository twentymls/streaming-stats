import type { AggregateStats } from "../lib/utils";
import { formatNumber } from "../lib/utils";
import { DSP_CHART_COLORS, DSP_NAMES } from "../lib/constants";
import { PlatformIcon } from "./PlatformIcon";

function KpiTooltip({ text }: { text: string }) {
  return (
    <span className="kpi-info" aria-label={text}>
      <span className="kpi-info-icon">i</span>
      <span className="kpi-tooltip">{text}</span>
    </span>
  );
}

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
        <KpiTooltip text="Total new streams, views, and creations across all platforms for the most recent day." />
        <div className="kpi-value">
          {todaySign}
          {formatNumber(stats.todayTotal)}
        </div>
        <div className="kpi-label">Today&apos;s Growth</div>
      </div>
      <div className="kpi-card">
        <KpiTooltip text="New Spotify streams gained yesterday." />
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.spotify }}>
          +{formatNumber(spotifyDaily)}
        </div>
        <div className="kpi-label kpi-label-icon">
          <PlatformIcon source="spotify" size={14} />
          {DSP_NAMES.spotify} Streams/day
        </div>
      </div>
      <div className="kpi-card">
        <KpiTooltip text="New YouTube views gained yesterday." />
        <div className="kpi-value" style={{ color: DSP_CHART_COLORS.youtube }}>
          +{formatNumber(youtubeDaily)}
        </div>
        <div className="kpi-label kpi-label-icon">
          <PlatformIcon source="youtube" size={14} />
          {DSP_NAMES.youtube} Views/day
        </div>
      </div>
      <div className="kpi-card">
        <KpiTooltip text="Total growth across all platforms divided by the number of days in the selected period. Your average daily gain across all DSPs combined." />
        <div className="kpi-value">+{formatNumber(stats.avgDailyTotal)}/day</div>
        <div className="kpi-label">Avg Daily Growth</div>
      </div>
      <div className="kpi-card">
        <KpiTooltip text="The single day within the selected period that had the highest combined growth across all platforms." />
        <div className="kpi-value">+{formatNumber(stats.bestDay.total)}</div>
        <div className="kpi-label">Best Day ({stats.bestDay.date.slice(5)})</div>
      </div>
      <div className="kpi-card">
        <KpiTooltip text="The platform that contributed the most total growth in the selected period." />
        <div className="kpi-value kpi-value-icon">
          <PlatformIcon source={stats.topPlatform.source} size={22} />
          {DSP_NAMES[stats.topPlatform.source] ?? stats.topPlatform.source}
        </div>
        <div className="kpi-label">Top Platform ({stats.topPlatform.sharePercent.toFixed(0)}%)</div>
      </div>
    </div>
  );
}
