import { useState, useMemo } from "react";
import { DSP_COLORS, DSP_NAMES, DSP_STAT_LABELS } from "../lib/constants";
import { PlatformIcon } from "./PlatformIcon";
import { TrendChart } from "./StatsChart";
import type { DailyStat, TopTrack, TopCurator } from "../lib/types";
import { format, subDays } from "date-fns";
import {
  formatNumber,
  getHeroStat,
  isSafeUrl,
  PLAY_COUNT_STAT,
  computeRollingAverageDeltas,
  computeYesterdayDelta,
  STAT_DISPLAY_ORDER,
} from "../lib/utils";

interface PlatformDetailProps {
  source: string;
  stats: Record<string, number>;
  historicStats: DailyStat[];
  topTracks: TopTrack[];
  topCurators: TopCurator[];
  topTrackDeltas?: Map<string, number>;
  trackStats?: Map<string, Record<string, number>>;
  onBack: () => void;
}

function DailyDeltasChart({ stats, playCountKey }: { stats: DailyStat[]; playCountKey: string }) {
  const chartData = useMemo(
    () => computeRollingAverageDeltas(stats, playCountKey),
    [stats, playCountKey]
  );

  if (chartData.length === 0) return null;

  return (
    <TrendChart
      stats={chartData}
      title={`Daily ${DSP_STAT_LABELS[playCountKey] ?? playCountKey} (14d avg)`}
      statType={playCountKey}
    />
  );
}

export function PlatformDetail({
  source,
  stats,
  historicStats,
  topTracks,
  topCurators,
  topTrackDeltas,
  trackStats,
  onBack,
}: PlatformDetailProps) {
  const [period, setPeriod] = useState(30);

  const color = DSP_COLORS[source] ?? "#888";
  const name = DSP_NAMES[source] ?? source;
  const hero = getHeroStat(source, stats);
  const playCountKey = PLAY_COUNT_STAT[source] ?? "streams";

  const filteredHistoric = useMemo(() => {
    const cutoff = format(subDays(new Date(), period), "yyyy-MM-dd");
    return historicStats.filter((s) => s.date >= cutoff);
  }, [historicStats, period]);

  // Preferred "audience" stat for the trend chart per platform
  // Falls back to the play-count stat if preferred stat has no historic data
  const TREND_STAT_PREFERENCE: Record<string, string[]> = {
    spotify: ["monthly_listeners"],
    youtube: ["monthly_audience", "followers"],
    apple_music: ["playlist_reach"],
    tiktok: ["followers"],
    instagram: ["followers"],
  };

  // Compute yesterday's delta for each stat type
  const yesterdayDeltas = useMemo(() => {
    const deltas: Record<string, number> = {};
    const statTypes = new Set(historicStats.map((s) => s.stat_type));
    for (const st of statTypes) {
      const delta = computeYesterdayDelta(historicStats, st);
      if (delta != null) deltas[st] = delta;
    }
    return deltas;
  }, [historicStats]);

  // Compute daily play count rate (14-day rolling average, same as dashboard KPI)
  const dailyRate = useMemo(() => {
    const rollingAvg = computeRollingAverageDeltas(historicStats, playCountKey);
    if (rollingAvg.length === 0) return null;
    return rollingAvg[rollingAvg.length - 1].value;
  }, [historicStats, playCountKey]);

  const preferredStats = TREND_STAT_PREFERENCE[source] ?? [];
  const PLAY_COUNT_FALLBACK = ["streams", "views", "creates", "shazams", "plays"];
  const hasData = (st: string) => filteredHistoric.some((s) => s.stat_type === st && s.value > 0);
  const firstStatWithData = filteredHistoric.find((s) => s.value > 0)?.stat_type;
  const trendStatType =
    preferredStats.find(hasData) ??
    PLAY_COUNT_FALLBACK.find(hasData) ??
    firstStatWithData ??
    playCountKey;

  return (
    <div className="platform-detail">
      <div className="detail-header">
        <button className="btn" onClick={onBack}>
          &larr; Back
        </button>
        <h1>
          <PlatformIcon source={source} size={24} />
          {name}
        </h1>
      </div>

      {hero && (
        <div className="detail-hero" style={{ "--hero-accent": color } as React.CSSProperties}>
          <div className="detail-hero-value">
            {formatNumber(hero.value)}
            {yesterdayDeltas[hero.key] != null && (
              <span className="yesterday-badge">+{formatNumber(yesterdayDeltas[hero.key])}</span>
            )}
          </div>
          <div className="detail-hero-label">{DSP_STAT_LABELS[hero.key] ?? hero.key}</div>
          {dailyRate != null && (
            <div className="detail-hero-daily">
              +{formatNumber(dailyRate)} {DSP_STAT_LABELS[playCountKey] ?? playCountKey}/day
            </div>
          )}
        </div>
      )}

      <div className="detail-stats-grid">
        {Object.entries(stats)
          .filter(([k, v]) => {
            if (k === hero?.key) return false;
            // Hide stats that are 0 when their "_total" counterpart has a value
            const totalKey = k + "_total";
            if (v === 0 && stats[totalKey] != null && stats[totalKey] > 0) return false;
            return true;
          })
          .sort(([a], [b]) => {
            const ai = STAT_DISPLAY_ORDER.indexOf(a);
            const bi = STAT_DISPLAY_ORDER.indexOf(b);
            return (
              (ai === -1 ? STAT_DISPLAY_ORDER.length : ai) -
              (bi === -1 ? STAT_DISPLAY_ORDER.length : bi)
            );
          })
          .map(([key, value]) => (
            <div key={key} className="detail-stat-card">
              <div className="detail-stat-value">
                {formatNumber(value)}
                {yesterdayDeltas[key] != null && (
                  <span className="yesterday-badge-sm">+{formatNumber(yesterdayDeltas[key])}</span>
                )}
              </div>
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
                  <div className="top-track-title">
                    {track.title}
                    {track.songstats_url && isSafeUrl(track.songstats_url) && (
                      <a
                        href={track.songstats_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="track-link"
                      >
                        View on Songstats
                      </a>
                    )}
                  </div>
                  <div className="top-track-streams">
                    {formatNumber(track.streams)}{" "}
                    {source === "tiktok" ? "videos" : source === "youtube" ? "views" : "streams"}
                    {topTrackDeltas?.get(track.title) != null && (
                      <span className="yesterday-badge-sm">
                        +{formatNumber(topTrackDeltas.get(track.title)!)} yesterday
                      </span>
                    )}
                  </div>
                  {track.songstats_track_id && trackStats?.get(track.songstats_track_id) && (
                    <div className="track-stat-badges">
                      {Object.entries(trackStats.get(track.songstats_track_id)!).map(
                        ([key, value]) => (
                          <span key={key} className="track-stat-badge">
                            {formatNumber(value)} {DSP_STAT_LABELS[key] ?? key}
                          </span>
                        )
                      )}
                    </div>
                  )}
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
              {topCurators.slice(0, 10).map((curator, i) => {
                const Wrapper =
                  curator.external_url && isSafeUrl(curator.external_url) ? "a" : "div";
                const wrapperProps =
                  Wrapper === "a"
                    ? {
                        href: curator.external_url,
                        target: "_blank" as const,
                        rel: "noopener noreferrer",
                        style: { textDecoration: "none", color: "inherit" },
                      }
                    : { style: { textDecoration: "none", color: "inherit" } };
                return (
                  <Wrapper key={i} className="top-track-item" {...wrapperProps}>
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
                  </Wrapper>
                );
              })}
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
          {playCountKey !== trendStatType && source !== "instagram" && (
            <DailyDeltasChart stats={filteredHistoric} playCountKey={playCountKey} />
          )}
        </>
      )}
    </div>
  );
}
