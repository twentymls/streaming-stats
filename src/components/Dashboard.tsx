import { useState, useEffect, useCallback, useMemo } from "react";
import { PlatformCard } from "./PlatformCard";
import { PlatformDetail } from "./PlatformDetail";
import { TrendChart, DistributionChart } from "./StatsChart";
import { Settings } from "./Settings";
import {
  getLatestStats,
  getStatsRange,
  getMonthlyApiCount,
  getAllCachedTopTracks,
  getAllCachedTopCurators,
} from "../lib/database";
import {
  fetchAllStats,
  fetchHistoricStats,
  getArtistInfo,
  fetchAndCacheTopContent,
  TOP_TRACKS_SOURCES,
  TOP_CURATORS_SOURCES,
} from "../lib/songstats-api";
import { loadSettings, getAutoFetchState, recordFetch } from "../lib/settings";
import type { DailyStat, AppSettings, TopTrack, TopCurator } from "../lib/types";
import { DSP_NAMES } from "../lib/constants";
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
  const [artistName, setArtistName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [fetchesToday, setFetchesToday] = useState(0);
  const [cachedTopTracks, setCachedTopTracks] = useState<Map<string, TopTrack[]>>(new Map());
  const [cachedTopCurators, setCachedTopCurators] = useState<Map<string, TopCurator[]>>(new Map());

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
      } else if (effectiveCount < 2) {
        const hoursSinceLast = (Date.now() - new Date(lastFetchIso).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast >= 8) {
          shouldFetch = true;
        }
      }

      if (shouldFetch) {
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
          }
          await recordFetch();
          setFetchesToday((prev) => prev + 1);
          await loadData();
        } catch (err) {
          console.error("Auto-fetch failed:", err);
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings?.api_key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check auto-fetch eligibility every 30 minutes while app is open
  useEffect(() => {
    const interval = setInterval(
      async () => {
        const { lastFetchIso, fetchCountToday } = await getAutoFetchState();
        const today = new Date().toLocaleDateString("sv");
        const lastDate = lastFetchIso?.slice(0, 10);
        const effectiveCount = lastDate === today ? fetchCountToday : 0;

        if (effectiveCount >= 2 || !lastFetchIso) return;

        const hoursSinceLast = (Date.now() - new Date(lastFetchIso).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast >= 8) {
          handleFetch();
        }
      },
      30 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [handleFetch]);

  // Must be above early returns to keep hook order stable
  const dashboardHistoric = useMemo(() => {
    const cutoff = format(subDays(new Date(), period), "yyyy-MM-dd");
    return historicStats.filter((s) => s.date >= cutoff);
  }, [historicStats, period]);

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
        onBack={() => setSelectedPlatform(null)}
      />
    );
  }

  // Prepare distribution data
  const distribution = Array.from(latestStats.entries()).map(([source, stats]) => ({
    source,
    total: stats.streams ?? stats.views ?? stats.creates ?? stats.shazams ?? 0,
  }));

  return (
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
            disabled={loading || fetchesToday >= 2}
            className="btn btn-primary"
          >
            {loading ? "Updating..." : fetchesToday >= 2 ? "Done for today" : "Update"}
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

          {dashboardHistoric.length > 0 && (
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

              <div className="charts-grid">
                <TrendChart
                  stats={dashboardHistoric}
                  title="Streams / Views over time"
                  statType="streams"
                />
                <DistributionChart platformStats={distribution} title="Distribution by platform" />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
