import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { loadSettings, recordFetch, getScheduledFetchInfo } from "../lib/settings";
import type { DailyStat, AppSettings, TopTrack, TopCurator } from "../lib/types";
import { DSP_NAMES, FETCH_HOUR } from "../lib/constants";
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
  const [fetchedToday, setFetchedToday] = useState(false);
  const [nextRefetchTime, setNextRefetchTime] = useState<Date | null>(null);
  const [cachedTopTracks, setCachedTopTracks] = useState<Map<string, TopTrack[]>>(new Map());
  const [cachedTopCurators, setCachedTopCurators] = useState<Map<string, TopCurator[]>>(new Map());
  const [topTrackDeltas, setTopTrackDeltas] = useState<Map<string, Map<string, number>>>(new Map());
  const [trackStats, setTrackStats] = useState<Map<string, Map<string, Record<string, number>>>>(
    new Map()
  );
  const [tick, setTick] = useState(0);
  const fetchInProgress = useRef(false);

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

    // Load per-track stats for tracks that have songstats_track_id, grouped by source
    const tsMap = new Map<string, Map<string, Record<string, number>>>();
    for (const [, trackList] of tracks) {
      for (const track of trackList) {
        if (!track.songstats_track_id) continue;
        for (const src of ["tiktok", "youtube"]) {
          const ts = await getLatestTrackStats(track.songstats_track_id, src);
          if (ts.length > 0) {
            if (!tsMap.has(src)) tsMap.set(src, new Map());
            const sourceMap = tsMap.get(src)!;
            const existing = sourceMap.get(track.songstats_track_id) ?? {};
            for (const s of ts) {
              existing[s.stat_type] = s.value;
            }
            sourceMap.set(track.songstats_track_id, existing);
          }
        }
      }
    }
    setTrackStats(tsMap);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Perform a daily fetch — used by both immediate and scheduled paths
  const performDailyFetch = useCallback(
    async (hasData: boolean) => {
      if (!settings) return;
      if (fetchInProgress.current) return;
      fetchInProgress.current = true;
      setInitialLoading(true);
      setLoading(true);
      try {
        if (!hasData) {
          const info = await getArtistInfo(settings.api_key, settings.spotify_artist_id);
          setArtistName(info.name);
          await fetchHistoricStats(
            settings.api_key,
            settings.spotify_artist_id,
            settings.enabled_sources
          );
        } else {
          // Backfill historic data for sources with < 3 days of data (newly added)
          // Query DB directly to avoid depending on historicStats state
          const endDate = format(new Date(), "yyyy-MM-dd");
          const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
          const currentHistoric = await getStatsRange(startDate, endDate);
          const sparseSources = settings.enabled_sources.filter((s) => {
            const dates = new Set(
              currentHistoric.filter((st) => st.source === s).map((st) => st.date)
            );
            return dates.size < 3;
          });
          if (sparseSources.length > 0) {
            await fetchHistoricStats(settings.api_key, settings.spotify_artist_id, sparseSources);
          }
        }
        await fetchAllStats(settings.api_key, settings.spotify_artist_id, settings.enabled_sources);

        // Record fetch immediately after core stats succeed
        // so partial failures in secondary operations don't cause re-fetches
        await recordFetch();
        setFetchedToday(true);
        setNextRefetchTime(null);

        // Secondary operations — failures here won't trigger re-fetch on next open
        try {
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
              await fetchAndCacheTrackStats(settings.api_key, tracksWithIds, ["tiktok", "youtube"]);
            }
          }
        } catch (err) {
          console.error("Secondary fetch operations failed:", err);
        }

        await loadData();
      } catch (err) {
        console.error("Auto-fetch failed:", err);
      } finally {
        fetchInProgress.current = false;
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [settings, loadData]
  );

  // Scheduled auto-fetch: determines whether to fetch now, defer, or skip
  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    let fetchTimer: ReturnType<typeof setTimeout> | undefined;
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const hasData = (await getLatestStats()).length > 0;
      const schedule = await getScheduledFetchInfo(hasData);

      if (cancelled) return;

      if (schedule.shouldFetchNow) {
        await performDailyFetch(hasData);
      } else if (schedule.shouldDeferToFetchHour) {
        // Show "Next update at ..." and set a timer
        const target = new Date(Date.now() + schedule.msUntilFetchHour);
        setNextRefetchTime(target);
        fetchTimer = setTimeout(async () => {
          if (cancelled) return;
          const currentHasData = (await getLatestStats()).length > 0;
          await performDailyFetch(currentHasData);
        }, schedule.msUntilFetchHour);
      } else {
        // Already fetched today
        setFetchedToday(true);
      }

      // Midnight timer: reset state for the new day
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const msUntilMidnight = midnight.getTime() - now.getTime();

      midnightTimer = setTimeout(async () => {
        if (cancelled) return;
        setFetchedToday(false);
        setNextRefetchTime(null);

        // Re-evaluate schedule for the new day
        const currentHasData = (await getLatestStats()).length > 0;
        const newSchedule = await getScheduledFetchInfo(currentHasData);
        if (newSchedule.shouldFetchNow) {
          await performDailyFetch(currentHasData);
        } else if (newSchedule.shouldDeferToFetchHour) {
          const target = new Date(Date.now() + newSchedule.msUntilFetchHour);
          setNextRefetchTime(target);
          fetchTimer = setTimeout(async () => {
            if (cancelled) return;
            const hasDataNow = (await getLatestStats()).length > 0;
            await performDailyFetch(hasDataNow);
          }, newSchedule.msUntilFetchHour);
        }
      }, msUntilMidnight);
    })();

    return () => {
      cancelled = true;
      if (fetchTimer) clearTimeout(fetchTimer);
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [settings?.api_key, performDailyFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const smoothed = true;

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

  // Tick every minute to keep the countdown fresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const countdownText = useMemo(() => {
    if (loading) return null;

    let targetTime: Date | null = null;

    if (nextRefetchTime) {
      targetTime = nextRefetchTime;
    } else if (fetchedToday) {
      // Next refresh is tomorrow at FETCH_HOUR (2 PM)
      targetTime = new Date();
      targetTime.setDate(targetTime.getDate() + 1);
      targetTime.setHours(FETCH_HOUR, 0, 0, 0);
    }

    if (!targetTime) return null;

    const msUntil = targetTime.getTime() - Date.now();
    if (msUntil <= 0) return null;

    const hours = Math.floor(msUntil / 3_600_000);
    const minutes = Math.floor((msUntil % 3_600_000) / 60_000);

    if (hours > 0) {
      return `${hours}h ${minutes}m until refresh`;
    }
    return `${minutes}m until refresh`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces periodic recomputation
  }, [loading, nextRefetchTime, fetchedToday, tick]);

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
        trackStats={trackStats.get(selectedPlatform)}
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
            <span className="fetch-status">
              {loading
                ? "Updating..."
                : fetchedToday
                  ? countdownText
                    ? `Up to date · ${countdownText}`
                    : "Up to date"
                  : nextRefetchTime
                    ? (countdownText ?? `Next update at ${format(nextRefetchTime, "h:mm a")}`)
                    : ""}
            </span>
            <button onClick={() => setShowSettings(true)} className="btn">
              Settings
            </button>
          </div>
        </header>

        {latestStats.size === 0 ? (
          <div className="empty-state">
            <h2>No data yet</h2>
            <p>Fetching your stats from all platforms...</p>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2>Platforms</h2>
            </div>
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
              <>
                <div className="section-header">
                  <h2>Analytics</h2>
                </div>
                <section className="charts-section">
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

                  <KpiRow stats={chartData.aggregateStats} platformDeltas={kpiPlatformDeltas} />
                  <DailyGrowthChart dailyPoints={chartData.dailyPoints} />
                  <GrowthShare
                    summaries={chartData.platformSummaries}
                    onPlatformClick={setSelectedPlatform}
                  />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
