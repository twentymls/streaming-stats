import { invoke } from "@tauri-apps/api/core";
import type { DailyStat, TopTrack, TopCurator, TrackStat } from "./types";

export async function getLatestStats(): Promise<DailyStat[]> {
  return invoke<DailyStat[]>("get_latest_stats");
}

export async function getStatsRange(
  startDate: string,
  endDate: string,
  source?: string
): Promise<DailyStat[]> {
  return invoke<DailyStat[]>("get_stats_range", {
    startDate,
    endDate,
    source: source ?? null,
  });
}

export async function saveDailyStat(
  date: string,
  source: string,
  statType: string,
  value: number
): Promise<void> {
  return invoke("save_daily_stat", { date, source, statType, value });
}

export async function logApiCall(
  endpoint: string,
  source: string,
  statusCode: number
): Promise<void> {
  return invoke("log_api_call", { endpoint, source, statusCode });
}

export async function getMonthlyApiCount(): Promise<number> {
  return invoke<number>("get_monthly_api_count");
}

export async function getLastFetchDate(): Promise<string | null> {
  return invoke<string | null>("get_last_fetch_date");
}

export async function saveTopTracks(
  date: string,
  source: string,
  tracks: TopTrack[]
): Promise<void> {
  return invoke("save_top_tracks", { date, source, tracks });
}

export async function saveTopCurators(
  date: string,
  source: string,
  curators: TopCurator[]
): Promise<void> {
  return invoke("save_top_curators", { date, source, curators });
}

export async function getLatestTopTracks(source: string): Promise<TopTrack[]> {
  return invoke<TopTrack[]>("get_latest_top_tracks", { source });
}

export async function getLatestTopCurators(source: string): Promise<TopCurator[]> {
  return invoke<TopCurator[]>("get_latest_top_curators", { source });
}

export async function getTopTrackDeltas(source: string): Promise<Map<string, number>> {
  const obj = await invoke<Record<string, number>>("get_top_track_deltas", { source });
  return new Map(Object.entries(obj));
}

export async function getAllCachedTopTracks(): Promise<Map<string, TopTrack[]>> {
  const obj = await invoke<Record<string, TopTrack[]>>("get_all_cached_top_tracks");
  return new Map(Object.entries(obj));
}

export async function getAllCachedTopCurators(): Promise<Map<string, TopCurator[]>> {
  const obj = await invoke<Record<string, TopCurator[]>>("get_all_cached_top_curators");
  return new Map(Object.entries(obj));
}

export async function saveTrackStats(
  date: string,
  songstatsTrackId: string,
  source: string,
  stats: [string, number][]
): Promise<void> {
  return invoke("save_track_stats", {
    date,
    songstatsTrackId,
    source,
    stats,
  });
}

export async function getLatestTrackStats(
  songstatsTrackId: string,
  source: string
): Promise<TrackStat[]> {
  return invoke<TrackStat[]>("get_latest_track_stats", {
    songstatsTrackId,
    source,
  });
}

export async function getTrackStatsLastFetch(source: string): Promise<string | null> {
  return invoke<string | null>("get_track_stats_last_fetch", { source });
}
