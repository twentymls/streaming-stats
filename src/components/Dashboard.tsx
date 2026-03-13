import { useState, useEffect, useCallback, useMemo } from "react";
import { PlatformCard } from "./PlatformCard";
import { PlatformDetail } from "./PlatformDetail";
import { KpiRow } from "./KpiRow";
import { DailyGrowthChart } from "./DailyGrowthChart";
import { GrowthShare } from "./GrowthShare";
import { FollowersPieChart } from "./FollowersPieChart";
import { Settings } from "./Settings";
import {
  getLatestStats,
  getStatsRange,
  getMonthlyApiCount,
  getAllCachedTopTracks,
  getAllCachedTopCurators,
  getTopTrackDeltas,
  getLatestTrackStats,
  getTrackStatsLastFetch,
} from "../lib/database";
import {
  fetchAllStats,
  fetchHistoricStats,
  getArtistInfo,
  fetchAndCacheTopContent,
  fetchAndCacheTrackStats,
  TOP_TRACKS_SOURCES,
  TOP_CURATORS_SOURCES,
} from "../lib/songstats-api";
import { loadSettings, getAutoFetchState, recordFetch } from "../lib/settings";
import type { DailyStat, AppSettings, TopTrack, TopCurator } from "../lib/types";
import { DSP_NAMES } from "../lib/constants";
import {
  computeAllPlatformDeltas,
  computeRollingAverageDeltas,
  PLAY_COUNT_STAT,
} from "../lib/utils";
import { format, subDays } from "date-fns";

interface DashboardProps {
  onReset: () => void;
}

export function Dashboard({ onReset }: DashboardProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [latestStats, setLatestStats] = useState<Map<string, Record<string, number>>>(new Map());
  const [historicStats, setHistoricStats] = useState<DailyStat[]>([]);
  const [apiCount, setApiCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [fetchesToday, setFetchesToday] = useState(0);
  const [cachedTopTracks, setCachedTopTracks] = useState<Map<string, TopTrack[]>>(new Map());
  const [cachedTopCurators, setCachedTopCurators] = useState<Map<string, TopCurator[]>>(new Map());
  const [topTrackDeltas, setTopTrackDeltas] = useState<Map<string, Map<string, number>>>(new Map());
  const [trackStats, setTrackStats] = useState<Map<string, Record<string, number>>>(new Map());

  const loadData = useCallback(async () => {
    const s = await loadSettings();
    if (!s) return;
    setSettings(s);
    setArtistName(s.artist_name ?? "");

    // Load latest stats grouped by platform
    const latest = await getLatestStats();
    const grouped = new Map<string, Record<string, number>>();
    for (const stat of latest) {
      if (!grouped.has(stat.source)) grouped.set(stat.source, {});
      grouped.get(stat.source)![stat.stat_type] = stat.value;
    }
    setLatestStats(grouped);
    if (latest.length > 0) setLastUpdate(latest[0].date);

    // Load historic data — always fetch 90 days so detail views can filter locally
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
    const historic = await getStatsRange(startDate, endDate);
    setHistoricStats(historic);

    const count = await getMonthlyApiCount();
    setApiCount(count);

    // Load cached top tracks/curators from DB
    const tracks = await getAllCachedTopTracks();
    setCachedTopTracks(tracks);
    const curators = await getAllCachedTopCurators();
    setCachedTopCurators(curators);

    // Load top track deltas for TikTok and YouTube
    const deltas = new Map<string, Map<string, number>>();
    for (const src of ["tiktok", "youtube"]) {
      const d = await getTopTrackDeltas(src);
      if (d.size > 0) deltas.set(src, d);
    }
    setTopTrackDeltas(deltas);

    // Load per-track stats for tracks that have songstats_track_id
    const tsMap = new Map<string, Record<string, number>>();
    for (const [, trackList] of tracks) {
      for (const track of trackList) {
        if (!track.songstats_track_id) continue;
        for (const src of ["tiktok", "youtube"]) {
          const ts = await getLatestTrackStats(track.songstats_track_id, src);
          if (ts.length > 0) {
            const existing = tsMap.get(track.songstats_track_id) ?? {};
            for (const s of ts) {
              existing[s.stat_type] = s.value;
            }
            tsMap.set(track.songstats_track_id, existing);
          }
        }
      }
    }
    setTrackStats(tsMap);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFetch = useCallback(async () => {
    if (!settings) return;
    setLoading(true);
    try {
      await fetchAllStats(settings.api_key, settings.spotify_artist_id, settings.enabled_sources);
      await fetchAndCacheTopContent(
        settings.api_key,
        settings.spotify_artist_id,
        TOP_TRACKS_SOURCES,
        TOP_CURATORS_SOURCES
      );
      await recordFetch();
      setFetchesToday((prev) => prev + 1);
      await loadData();
    } catch (err) {
      console.error("Fetch failed:", err);
    }
    setLoading(false);
  }, [settings, loadData]);

  const handleFetchWithInfo = async () => {
    if (!settings) return;
    setLoading(true);
    try {
      const info = await getArtistInfo(settings.api_key, settings.spotify_artist_id);
      setArtistName(info.name);
      await fetchAllStats(settings.api_key, settings.spotify_artist_id, settings.enabled_sources);
      await fetchAndCacheTopContent(
        settings.api_key,
        settings.spotify_artist_id,
        TOP_TRACKS_SOURCES,
        TOP_CURATORS_SOURCES
      );
      await recordFetch();
      setFetchesToday((prev) => prev + 1);
      await loadData();
    } catch (err) {
      console.error("Fetch failed:", err);
    }
    setLoading(false);
  };

  // Auto-fetch on mount: first launch of the day, or 8+ hours since last fetch
  useEffect(() => {
    if (!settings) return;
    let cancelled = false;

    (async () => {
      const { lastFetchIso, fetchCountToday } = await getAutoFetchState();
      const today = new Date().toLocaleDateString("sv");
      const lastDate = lastFetchIso?.slice(0, 10);
      const effectiveCount = lastDate === today ? fetchCountToday : 0;
      setFetchesToday(effectiveCount);

      if (cancelled) return;

      let shouldFetch = false;
      if (!lastFetchIso || lastDate !== today) {
        shouldFetch = true;
      } else if (effectiveCount < 1) {
        shouldFetch = true;
      }

      if (shouldFetch) {
        setInitialLoading(true);
        setLoading(true);
        try {
          const hasData = (await getLatestStats()).length > 0;
          if (!hasData) {
            const info = await getArtistInfo(settings.api_key, settings.spotify_artist_id);
            setArtistName(info.name);
            // One-time backfill of historic data on first launch
            await fetchHistoricStats(
              settings.api_key,
              settings.spotify_artist_id,
              settings.enabled_sources
            );
          }
          await fetchAllStats(
            settings.api_key,
            settings.spotify_artist_id,
            settings.enabled_sources
          );
          if (effectiveCount === 0) {
            await fetchAndCacheTopContent(
              settings.api_key,
              settings.spotify_artist_id,
              TOP_TRACKS_SOURCES,
              TOP_CURATORS_SOURCES
            );

            // Fetch per-track stats weekly
            const lastTrackStatsFetch = await getTrackStatsLastFetch("tiktok");
            const daysSince = lastTrackStatsFetch
              ? (Date.now() - new Date(lastTrackStatsFetch).getTime()) / 86400000
              : Infinity;
            if (daysSince >= 7) {
              const latestTracks = await getAllCachedTopTracks();
              const allTracks = [
                ...(latestTracks.get("tiktok") ?? []),
                ...(latestTracks.get("youtube") ?? []),
              ];
              const tracksWithIds = allTracks.filter((t) => t.songstats_track_id);
              if (tracksWithIds.length > 0) {
                await fetchAndCacheTrackStats(settings.api_key, tracksWithIds, [
                  "tiktok",
                  "youtube",
                ]);
              }
            }
          }
          await recordFetch();
          setFetchesToday((prev) => prev + 1);
          await loadData();
        } catch (err) {
          console.error("Auto-fetch failed:", err);
        } finally {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings?.api_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const [smoothed, setSmoothed] = useState(false);

  // Must be above early returns to keep hook order stable
  const dashboardHistoric = useMemo(() => {
    const cutoff = format(subDays(new Date(), period), "yyyy-MM-dd");
    return historicStats.filter((s) => s.date >= cutoff);
  }, [historicStats, period]);

  const chartData = useMemo(
    () => computeAllPlatformDeltas(dashboardHistoric, smoothed),
    [dashboardHistoric, smoothed]
  );

  // Rolling-average daily values for Spotify/YouTube KPI cards
  // Uses the same calculation as the platform detail pages (14-day window)
  const kpiPlatformDeltas = useMemo(() => {
    const result: Record<string, number> = {};
    for (const source of ["spotify", "youtube"]) {
      const statType = PLAY_COUNT_STAT[source];
      if (!statType) continue;
      const sourceStats = dashboardHistoric.filter((s) => s.source === source);
      const rollingAvg = computeRollingAverageDeltas(sourceStats, statType);
      if (rollingAvg.length > 0) {
        result[source] = rollingAvg[rollingAvg.length - 1].value;
      }
    }
    return result;
  }, [dashboardHistoric]);

  if (showSettings) {
    return (
      <Settings
        onBack={() => {
          setShowSettings(false);
          loadData();
        }}
        onReset={onReset}
      />
    );
  }

  if (selectedPlatform && settings) {
    const platformHistoric = historicStats.filter((s) => s.source === selectedPlatform);
    return (
      <PlatformDetail
        source={selectedPlatform}
        stats={latestStats.get(selectedPlatform) ?? {}}
        historicStats={platformHistoric}
        topTracks={cachedTopTracks.get(selectedPlatform) ?? []}
        topCurators={cachedTopCurators.get(selectedPlatform) ?? []}
        topTrackDeltas={topTrackDeltas.get(selectedPlatform)}
        trackStats={trackStats}
        onBack={() => setSelectedPlatform(null)}
      />
    );
  }

  return (
    <>
      {initialLoading && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            <div className="spinner" />
            <p>Updating stats...</p>
          </div>
        </div>
      )}
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-left">
            <h1>{artistName || "Streaming Stats"}</h1>
            {lastUpdate && <span className="last-update">Last update: {lastUpdate}</span>}
          </div>
          <div className="header-right">
            <div className="api-badge">API: {apiCount}/500</div>
            <button
              onClick={latestStats.size === 0 ? handleFetchWithInfo : handleFetch}
              disabled={loading || fetchesToday >= 10}
              className="btn btn-primary"
            >
              {loading ? "Updating..." : fetchesToday >= 10 ? "Done for today" : "Update"}
            </button>
            <button onClick={() => setShowSettings(true)} className="btn">
              Settings
            </button>
          </div>
        </header>

        {latestStats.size === 0 ? (
          <div className="empty-state">
            <h2>No data yet</h2>
            <p>Click "Update" to fetch your first stats from all platforms.</p>
          </div>
        ) : (
          <>
            <section className="platforms-grid">
              {settings?.enabled_sources
                .filter((s) => latestStats.has(s))
                .map((source) => (
                  <PlatformCard
                    key={source}
                    source={source}
                    stats={latestStats.get(source)!}
                    onClick={() => setSelectedPlatform(source)}
                  />
                ))}
              {settings?.enabled_sources
                .filter((s) => !latestStats.has(s))
                .map((source) => (
                  <div key={source} className="platform-card empty">
                    <div className="platform-header">
                      <span className="platform-name">{DSP_NAMES[source] ?? source}</span>
                    </div>
                    <div className="platform-main-stat">-</div>
                    <div className="platform-main-label">No data</div>
                  </div>
                ))}
            </section>

            <FollowersPieChart platformStats={latestStats} />

            {chartData.dailyPoints.length > 0 && (
              <section className="charts-section">
                <div className="charts-toolbar">
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
                  <label className="smooth-toggle">
                    <input
                      type="checkbox"
                      checked={smoothed}
                      onChange={(e) => setSmoothed(e.target.checked)}
                    />
                    Smooth (7-day avg)
                  </label>
                </div>

                <KpiRow stats={chartData.aggregateStats} platformDeltas={kpiPlatformDeltas} />
                <DailyGrowthChart dailyPoints={chartData.dailyPoints} />
                <GrowthShare
                  summaries={chartData.platformSummaries}
                  onPlatformClick={setSelectedPlatform}
                />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
