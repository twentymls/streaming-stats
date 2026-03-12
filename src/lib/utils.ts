import type { DailyStat } from "./types";

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
