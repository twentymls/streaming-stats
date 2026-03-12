import { useState, useEffect, useMemo } from "react";
import { DSP_COLORS, DSP_NAMES, DSP_STAT_LABELS } from "../lib/constants";
import { fetchTopTracks, fetchTopCurators } from "../lib/songstats-api";
import { TrendChart } from "./StatsChart";
import { DailyStat, TopTrack } from "../lib/types";
import { format, subDays } from "date-fns";

interface PlatformDetailProps {
  source: string;
  stats: Record<string, number>;
  historicStats: DailyStat[];
  apiKey: string;
  spotifyArtistId: string;
  onBack: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("it-IT");
}

const HERO_STAT_PRIORITY: Record<string, string[]> = {
  spotify: ["monthly_listeners", "streams", "followers"],
  youtube: ["views", "followers"],
  tiktok: ["views", "creates", "followers"],
  shazam: ["shazams"],
  soundcloud: ["plays", "followers"],
  apple_music: ["streams", "playlist_reach"],
  deezer: ["streams", "followers"],
  amazon: ["streams", "followers"],
};

function getHeroStat(
  source: string,
  stats: Record<string, number>
): { key: string; value: number } | null {
  const priority = HERO_STAT_PRIORITY[source] ?? [
    "streams",
    "views",
    "creates",
    "shazams",
    "plays",
  ];
  for (const key of priority) {
    if (stats[key] != null) return { key, value: stats[key] };
  }
  const first = Object.entries(stats)[0];
  return first ? { key: first[0], value: first[1] } : null;
}

export function PlatformDetail({
  source,
  stats,
  historicStats,
  apiKey,
  spotifyArtistId,
  onBack,
}: PlatformDetailProps) {
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState(false);
  const [curators, setCurators] = useState<unknown[]>([]);
  const [curatorsLoading, setCuratorsLoading] = useState(false);
  const [period, setPeriod] = useState(30);

  const color = DSP_COLORS[source] ?? "#888";
  const name = DSP_NAMES[source] ?? source;
  const hero = getHeroStat(source, stats);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch top tracks first
      setTracksLoading(true);
      setTracksError(false);
      const tracks = await fetchTopTracks(apiKey, spotifyArtistId, source);
      if (cancelled) return;
      if (tracks.length === 0) {
        setTracksError(true);
      }
      setTopTracks(tracks);
      setTracksLoading(false);

      // For TikTok, also fetch top curators (with delay to avoid rate limit)
      if (source === "tiktok") {
        setCuratorsLoading(true);
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        const result = await fetchTopCurators(apiKey, spotifyArtistId, source);
        if (cancelled) return;
        setCurators(result);
        setCuratorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, spotifyArtistId, source]);

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
          <span
            className="platform-dot"
            style={{ backgroundColor: color }}
          />
          {name}
        </h1>
      </div>

      {hero && (
        <div className="detail-hero" style={{ borderLeft: `4px solid ${color}` }}>
          <div className="detail-hero-value">{formatNumber(hero.value)}</div>
          <div className="detail-hero-label">
            {DSP_STAT_LABELS[hero.key] ?? hero.key}
          </div>
        </div>
      )}

      <div className="detail-stats-grid">
        {Object.entries(stats)
          .filter(([k]) => k !== hero?.key)
          .map(([key, value]) => (
            <div key={key} className="detail-stat-card">
              <div className="detail-stat-value">{formatNumber(value)}</div>
              <div className="detail-stat-label">
                {DSP_STAT_LABELS[key] ?? key}
              </div>
            </div>
          ))}
      </div>

      <div className="top-tracks-section">
        <h3>Top Tracks</h3>
        {tracksLoading ? (
          <div className="top-tracks-empty">Loading tracks...</div>
        ) : tracksError ? (
          <div className="top-tracks-empty">
            Top tracks not available for {name}
          </div>
        ) : (
          <div className="top-tracks-list">
            {topTracks.map((track, i) => (
              <div key={i} className="top-track-item">
                <span className="top-track-rank">{i + 1}</span>
                {track.artwork_url && (
                  <img
                    className="top-track-artwork"
                    src={track.artwork_url}
                    alt=""
                  />
                )}
                <div className="top-track-info">
                  <div className="top-track-title">{track.title}</div>
                  <div className="top-track-streams">
                    {formatNumber(track.streams)}{" "}
                    {trendStatType === "views" ? "views" : "streams"}
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
          {curatorsLoading ? (
            <div className="top-tracks-empty">Loading curators...</div>
          ) : curators.length === 0 ? (
            <div className="top-tracks-empty">
              Top curators not available
            </div>
          ) : (
            <div className="top-tracks-list">
              {curators.slice(0, 10).map((curator, i) => {
                const c = curator as Record<string, unknown>;
                return (
                  <a
                    key={i}
                    className="top-track-item"
                    href={c.external_url ? String(c.external_url) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span className="top-track-rank">{i + 1}</span>
                    {c.image_url != null && (
                      <img
                        className="top-track-artwork"
                        src={String(c.image_url)}
                        alt=""
                        style={{ borderRadius: "50%" }}
                      />
                    )}
                    <div className="top-track-info">
                      <div className="top-track-title">
                        {String(c.curator_name ?? "Unknown")}
                      </div>
                      <div className="top-track-streams">
                        {c.followers_total != null && `${String(c.followers_total)} followers`}
                      </div>
                    </div>
                  </a>
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
        </>
      )}
    </div>
  );
}
