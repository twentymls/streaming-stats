import { useState, useMemo } from "react";
import { DSP_COLORS, DSP_NAMES, DSP_STAT_LABELS } from "../lib/constants";
import { TrendChart } from "./StatsChart";
import type { DailyStat, TopTrack, TopCurator } from "../lib/types";
import { format, subDays } from "date-fns";
import { formatNumber, getHeroStat } from "../lib/utils";

interface PlatformDetailProps {
  source: string;
  stats: Record<string, number>;
  historicStats: DailyStat[];
  topTracks: TopTrack[];
  topCurators: TopCurator[];
  onBack: () => void;
}

export function PlatformDetail({
  source,
  stats,
  historicStats,
  topTracks,
  topCurators,
  onBack,
}: PlatformDetailProps) {
  const [period, setPeriod] = useState(30);

  const color = DSP_COLORS[source] ?? "#888";
  const name = DSP_NAMES[source] ?? source;
  const hero = getHeroStat(source, stats);

  const filteredHistoric = useMemo(() => {
    const cutoff = format(subDays(new Date(), period), "yyyy-MM-dd");
    return historicStats.filter((s) => s.date >= cutoff);
  }, [historicStats, period]);

  // Determine the best stat type for the trend chart
  // For Spotify, prefer monthly_listeners if historic data exists for it
  const trendStatType =
    source === "spotify" && filteredHistoric.some((s) => s.stat_type === "monthly_listeners")
      ? "monthly_listeners"
      : stats.streams != null
        ? "streams"
        : stats.views != null
          ? "views"
          : stats.creates != null
            ? "creates"
            : stats.shazams != null
              ? "shazams"
              : stats.plays != null
                ? "plays"
                : "streams";

  return (
    <div className="platform-detail">
      <div className="detail-header">
        <button className="btn" onClick={onBack}>
          &larr; Back
        </button>
        <h1>
          <span className="platform-dot" style={{ backgroundColor: color }} />
          {name}
        </h1>
      </div>

      {hero && (
        <div className="detail-hero" style={{ borderLeft: `4px solid ${color}` }}>
          <div className="detail-hero-value">{formatNumber(hero.value)}</div>
          <div className="detail-hero-label">{DSP_STAT_LABELS[hero.key] ?? hero.key}</div>
        </div>
      )}

      <div className="detail-stats-grid">
        {Object.entries(stats)
          .filter(([k]) => k !== hero?.key)
          .map(([key, value]) => (
            <div key={key} className="detail-stat-card">
              <div className="detail-stat-value">{formatNumber(value)}</div>
              <div className="detail-stat-label">{DSP_STAT_LABELS[key] ?? key}</div>
            </div>
          ))}
      </div>

      <div className="top-tracks-section">
        <h3>Top Tracks</h3>
        {topTracks.length === 0 ? (
          <div className="top-tracks-empty">Top tracks not available for {name}</div>
        ) : (
          <div className="top-tracks-list">
            {topTracks.map((track, i) => (
              <div key={i} className="top-track-item">
                <span className="top-track-rank">{i + 1}</span>
                {track.artwork_url && (
                  <img className="top-track-artwork" src={track.artwork_url} alt="" />
                )}
                <div className="top-track-info">
                  <div className="top-track-title">{track.title}</div>
                  <div className="top-track-streams">
                    {formatNumber(track.streams)} {trendStatType === "views" ? "views" : "streams"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {source === "tiktok" && (
        <div className="top-tracks-section">
          <h3>Top Curators</h3>
          {topCurators.length === 0 ? (
            <div className="top-tracks-empty">Top curators not available</div>
          ) : (
            <div className="top-tracks-list">
              {topCurators.slice(0, 10).map((curator, i) => (
                <a
                  key={i}
                  className="top-track-item"
                  href={curator.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="top-track-rank">{i + 1}</span>
                  {curator.image_url != null && (
                    <img
                      className="top-track-artwork"
                      src={curator.image_url}
                      alt=""
                      style={{ borderRadius: "50%" }}
                    />
                  )}
                  <div className="top-track-info">
                    <div className="top-track-title">{curator.curator_name}</div>
                    <div className="top-track-streams">
                      {curator.followers_total != null && `${curator.followers_total} followers`}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {filteredHistoric.length > 0 && (
        <>
          <div className="period-selector">
            {[7, 30, 60, 90].map((d) => (
              <button
                key={d}
                className={`btn btn-sm ${period === d ? "active" : ""}`}
                onClick={() => setPeriod(d)}
              >
                {d}d
              </button>
            ))}
          </div>
          <TrendChart
            stats={filteredHistoric}
            title={`${DSP_STAT_LABELS[trendStatType] ?? trendStatType} over time`}
            statType={trendStatType}
          />
        </>
      )}
    </div>
  );
}
