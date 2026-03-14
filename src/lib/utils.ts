import type { DailyStat } from "./types";

export interface PlatformSummary {
  source: string;
  totalGrowth: number;
  avgDailyGrowth: number;
  sharePercent: number;
}

export interface AggregateStats {
  todayTotal: number;
  avgDailyTotal: number;
  bestDay: { date: string; total: number };
  topPlatform: { source: string; sharePercent: number };
}

export interface DashboardChartData {
  dailyPoints: Array<{ date: string; deltas: Record<string, number>; total: number }>;
  platformSummaries: PlatformSummary[];
  aggregateStats: AggregateStats;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("it-IT");
}

export const HERO_STAT_PRIORITY: Record<string, string[]> = {
  spotify: ["monthly_listeners", "streams", "followers"],
  youtube: ["views", "followers"],
  tiktok: ["views", "creates", "followers"],
  shazam: ["shazams"],
  soundcloud: ["plays", "followers"],
  apple_music: ["streams", "playlist_reach"],
  deezer: ["streams", "followers"],
  amazon: ["streams", "followers"],
};

export function getHeroStat(
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

/**
 * Display order for stat badges — stats commonly populated first,
 * chart/editorial stats (typically 0) last.
 */
export const STAT_DISPLAY_ORDER: string[] = [
  // Core play counts
  "streams",
  "views",
  "plays",
  "creates",
  "shazams",
  // Followers & audience
  "followers",
  "monthly_listeners",
  "monthly_audience",
  "popularity",
  // Playlists
  "playlist_reach",
  "playlist_reach_total",
  "playlist_count",
  "playlists_total",
  // YouTube/TikTok content
  "channel_views",
  "short_views",
  "videos",
  "shorts",
  "creator_reach",
  // Engagement
  "likes",
  "video_comments",
  "short_likes",
  "short_comments",
  "comments",
  "shares",
  "reposts",
  "favorites",
  "profile_likes",
  "profile_videos",
  "engagement_rate",
  "video_engagement",
  "short_engagement",
  // Editorial & charts — typically 0 for most artists
  "editorial_playlists",
  "editorial_playlists_total",
  "chart_entries",
  "current_charts",
  "charted_tracks",
  "charted_tracks_total",
  "charted_cities",
  "charted_countries",
];

export const PLAY_COUNT_STAT: Record<string, string> = {
  spotify: "streams",
  apple_music: "streams",
  deezer: "streams",
  amazon: "streams",
  youtube: "views",
  tiktok: "views",
  soundcloud: "plays",
  shazam: "shazams",
};

export function computeDailyDeltas(stats: DailyStat[], statType: string): DailyStat[] {
  const filtered = stats
    .filter((s) => s.stat_type === statType)
    .sort((a, b) => a.date.localeCompare(b.date));
  const deltas: DailyStat[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const delta = filtered[i].value - filtered[i - 1].value;
    deltas.push({
      date: filtered[i].date,
      source: filtered[i].source,
      stat_type: filtered[i].stat_type,
      value: delta < 0 ? 0 : delta,
    });
  }
  return deltas;
}

/**
 * Computes a 7-day rolling average of daily deltas from cumulative data.
 * SongStats updates cumulative totals unevenly (some days get bulk catch-ups),
 * so raw deltas are misleading. The rolling average smooths this out to match
 * the real daily value (e.g. ~23K vs raw deltas of ~3K).
 */
export function computeRollingAverageDeltas(
  stats: DailyStat[],
  statType: string,
  windowDays: number = 14
): DailyStat[] {
  const filtered = stats
    .filter((s) => s.stat_type === statType)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length < 2) return [];

  // Compute total change over the window ending at each data point
  const result: DailyStat[] = [];
  for (let i = 1; i < filtered.length; i++) {
    // Find the earliest data point within the window
    const endDate = new Date(filtered[i].date);
    let windowStart = i - 1;
    for (let j = i - 1; j >= 0; j--) {
      const daysDiff = (endDate.getTime() - new Date(filtered[j].date).getTime()) / 86400000;
      if (daysDiff <= windowDays) {
        windowStart = j;
      } else {
        break;
      }
    }

    const totalChange = filtered[i].value - filtered[windowStart].value;
    const actualDays =
      (endDate.getTime() - new Date(filtered[windowStart].date).getTime()) / 86400000;

    if (actualDays > 0) {
      result.push({
        date: filtered[i].date,
        source: filtered[i].source,
        stat_type: filtered[i].stat_type,
        value: Math.round(Math.max(0, totalChange / actualDays)),
      });
    }
  }

  return result;
}

export function computeYesterdayDelta(stats: DailyStat[], statType: string): number | null {
  const filtered = stats
    .filter((s) => s.stat_type === statType)
    .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

  if (filtered.length < 2) return null;

  const delta = filtered[0].value - filtered[1].value;
  return delta > 0 ? delta : null;
}

const PLAY_COUNT_FALLBACK = ["streams", "views", "plays", "creates", "shazams"];

export function getPlayCountStat(
  source: string,
  stats: Record<string, number>
): { key: string; value: number } | null {
  const preferred = PLAY_COUNT_STAT[source];
  if (preferred && stats[preferred] != null) {
    return { key: preferred, value: stats[preferred] };
  }
  for (const key of PLAY_COUNT_FALLBACK) {
    if (stats[key] != null) return { key, value: stats[key] };
  }
  return null;
}

/**
 * Computes aggregate daily growth data across all platforms.
 * Uses each platform's primary play-count stat (streams/views/plays/shazams).
 * When smoothed=true, uses rolling average deltas instead of raw deltas.
 */
export function computeAllPlatformDeltas(
  stats: DailyStat[],
  smoothed: boolean = false
): DashboardChartData {
  // Group stats by source
  const sources = [...new Set(stats.map((s) => s.source))];

  // Compute deltas per platform using their play-count stat
  const platformDeltas = new Map<string, DailyStat[]>();
  for (const source of sources) {
    const statType = PLAY_COUNT_STAT[source];
    if (!statType) continue;
    const sourceStats = stats.filter((s) => s.source === source);
    const deltas = smoothed
      ? computeRollingAverageDeltas(sourceStats, statType)
      : computeDailyDeltas(sourceStats, statType);
    if (deltas.length > 0) {
      platformDeltas.set(source, deltas);
    }
  }

  // Collect all unique dates across all platforms
  const allDates = new Set<string>();
  for (const [, deltas] of platformDeltas) {
    for (const d of deltas) {
      allDates.add(d.date);
    }
  }
  const sortedDates = [...allDates].sort();

  // Build daily points
  const dailyPoints = sortedDates.map((date) => {
    const deltas: Record<string, number> = {};
    let total = 0;
    for (const [source, sourceDeltaList] of platformDeltas) {
      const entry = sourceDeltaList.find((d) => d.date === date);
      const value = entry?.value ?? 0;
      deltas[source] = value;
      total += value;
    }
    return { date, deltas, total };
  });

  // Platform summaries
  const platformTotals = new Map<string, number>();
  for (const [source, deltas] of platformDeltas) {
    const total = deltas.reduce((sum, d) => sum + d.value, 0);
    platformTotals.set(source, total);
  }
  const grandTotal = [...platformTotals.values()].reduce((a, b) => a + b, 0);
  const numDays = sortedDates.length || 1;

  const platformSummaries: PlatformSummary[] = [...platformTotals.entries()]
    .map(([source, totalGrowth]) => ({
      source,
      totalGrowth,
      avgDailyGrowth: Math.round(totalGrowth / numDays),
      sharePercent: grandTotal > 0 ? (totalGrowth / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.totalGrowth - a.totalGrowth);

  // Aggregate stats
  const todayTotal = dailyPoints.length > 0 ? dailyPoints[dailyPoints.length - 1].total : 0;
  const avgDailyTotal = Math.round(grandTotal / numDays);
  const bestDay =
    dailyPoints.length > 0
      ? dailyPoints.reduce((best, dp) => (dp.total > best.total ? dp : best))
      : { date: "", total: 0 };
  const topPlatform =
    platformSummaries.length > 0
      ? { source: platformSummaries[0].source, sharePercent: platformSummaries[0].sharePercent }
      : { source: "", sharePercent: 0 };

  return {
    dailyPoints,
    platformSummaries,
    aggregateStats: {
      todayTotal,
      avgDailyTotal,
      bestDay: { date: bestDay.date, total: bestDay.total },
      topPlatform,
    },
  };
}
