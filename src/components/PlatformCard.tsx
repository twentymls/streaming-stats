import { DSP_COLORS, DSP_NAMES, DSP_STAT_LABELS } from "../lib/constants";

interface PlatformCardProps {
  source: string;
  stats: Record<string, number>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("it-IT");
}

export function PlatformCard({ source, stats }: PlatformCardProps) {
  const color = DSP_COLORS[source] ?? "#888";
  const name = DSP_NAMES[source] ?? source;
  const entries = Object.entries(stats);

  // Find the "main" stat (streams, views, creates, shazams, plays)
  const mainKey =
    entries.find(
      ([k]) =>
        k === "streams" ||
        k === "views" ||
        k === "creates" ||
        k === "shazams" ||
        k === "plays"
    )?.[0] ?? entries[0]?.[0];
  const mainValue = mainKey ? stats[mainKey] : 0;

  return (
    <div className="platform-card" style={{ borderLeftColor: color }}>
      <div className="platform-header">
        <span className="platform-dot" style={{ backgroundColor: color }} />
        <span className="platform-name">{name}</span>
      </div>
      <div className="platform-main-stat">{formatNumber(mainValue)}</div>
      <div className="platform-main-label">
        {DSP_STAT_LABELS[mainKey] ?? mainKey}
      </div>
      <div className="platform-sub-stats">
        {entries
          .filter(([k]) => k !== mainKey)
          .slice(0, 3)
          .map(([key, value]) => (
            <div key={key} className="sub-stat">
              <span className="sub-stat-value">{formatNumber(value)}</span>
              <span className="sub-stat-label">
                {DSP_STAT_LABELS[key] ?? key}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
