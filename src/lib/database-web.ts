import { supabase, getSupabaseUser } from "./supabase";
import type { DailyStat, TopTrack, TopCurator, TrackStat } from "./types";

async function getUserId(): Promise<string | null> {
  const user = await getSupabaseUser();
  return user?.id ?? null;
}

export async function getLatestStats(): Promise<DailyStat[]> {
  const userId = await getUserId();
  if (!userId || !supabase) return [];

  // Get the most recent date first
  const { data: dateRow } = await supabase
    .from("daily_stats")
    .select("date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];
  const latestDate = dateRow[0].date;

  const { data, error } = await supabase
    .from("daily_stats")
    .select("id,date,source,stat_type,value")
    .eq("user_id", userId)
    .eq("date", latestDate);

  if (error) {
    console.error("[db-web] getLatestStats failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    source: row.source,
    stat_type: row.stat_type,
    value: row.value,
  }));
}

export async function getStatsRange(
  startDate: string,
  endDate: string,
  source?: string
): Promise<DailyStat[]> {
  const userId = await getUserId();
  if (!userId || !supabase) return [];

  let query = supabase
    .from("daily_stats")
    .select("id,date,source,stat_type,value")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[db-web] getStatsRange failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    source: row.source,
    stat_type: row.stat_type,
    value: row.value,
  }));
}

// Write operations are no-ops in the PWA
export async function saveDailyStat(): Promise<void> {}
export async function logApiCall(): Promise<void> {}
export async function saveTopTracks(): Promise<void> {}
export async function saveTopCurators(): Promise<void> {}
export async function saveTrackStats(): Promise<void> {}

export async function getMonthlyApiCount(): Promise<number> {
  return 0;
}

export async function getLastFetchDate(): Promise<string | null> {
  const stats = await getLatestStats();
  if (stats.length === 0) return null;
  return stats[0].date;
}

export async function getLatestTopTracks(source: string): Promise<TopTrack[]> {
  const userId = await getUserId();
  if (!userId || !supabase) return [];

  // Get the most recent date for this source
  const { data: dateRow } = await supabase
    .from("top_tracks")
    .select("date")
    .eq("user_id", userId)
    .eq("source", source)
    .order("date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];

  const { data, error } = await supabase
    .from("top_tracks")
    .select("title,streams,artwork_url,songstats_track_id,songstats_url")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("date", dateRow[0].date)
    .order("rank", { ascending: true });

  if (error) {
    console.error("[db-web] getLatestTopTracks failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    title: row.title,
    streams: row.streams,
    artwork_url: row.artwork_url ?? undefined,
    songstats_track_id: row.songstats_track_id ?? undefined,
    songstats_url: row.songstats_url ?? undefined,
  }));
}

export async function getLatestTopCurators(source: string): Promise<TopCurator[]> {
  const userId = await getUserId();
  if (!userId || !supabase) return [];

  const { data: dateRow } = await supabase
    .from("top_curators")
    .select("date")
    .eq("user_id", userId)
    .eq("source", source)
    .order("date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];

  const { data, error } = await supabase
    .from("top_curators")
    .select("curator_name,followers_total,image_url,external_url")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("date", dateRow[0].date)
    .order("rank", { ascending: true });

  if (error) {
    console.error("[db-web] getLatestTopCurators failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    curator_name: row.curator_name,
    followers_total: row.followers_total ?? undefined,
    image_url: row.image_url ?? undefined,
    external_url: row.external_url ?? undefined,
  }));
}

export async function getTopTrackDeltas(source: string): Promise<Map<string, number>> {
  const userId = await getUserId();
  if (!userId || !supabase) return new Map();

  // Get the two most recent dates for this source
  const { data: dateRows } = await supabase
    .from("top_tracks")
    .select("date")
    .eq("user_id", userId)
    .eq("source", source)
    .order("date", { ascending: false });

  if (!dateRows) return new Map();

  const uniqueDates = [...new Set(dateRows.map((r) => r.date))].slice(0, 2);
  if (uniqueDates.length < 2) return new Map();

  const [latestDate, prevDate] = uniqueDates;

  const { data: latestTracks } = await supabase
    .from("top_tracks")
    .select("title,streams")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("date", latestDate);

  const { data: prevTracks } = await supabase
    .from("top_tracks")
    .select("title,streams")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("date", prevDate);

  const deltas = new Map<string, number>();
  const prevMap = new Map((prevTracks ?? []).map((t) => [t.title, t.streams]));

  for (const track of latestTracks ?? []) {
    const prev = prevMap.get(track.title);
    if (prev != null) {
      deltas.set(track.title, track.streams - prev);
    }
  }

  return deltas;
}

export async function getAllCachedTopTracks(): Promise<Map<string, TopTrack[]>> {
  const userId = await getUserId();
  if (!userId || !supabase) return new Map();

  // Get latest date per source
  const { data, error } = await supabase
    .from("top_tracks")
    .select("source,date,title,streams,artwork_url,songstats_track_id,songstats_url,rank")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("rank", { ascending: true });

  if (error || !data) return new Map();

  const result = new Map<string, TopTrack[]>();
  const seenSources = new Set<string>();

  for (const row of data) {
    // Only keep the latest date per source
    if (seenSources.has(row.source)) {
      const existing = result.get(row.source);
      if (
        existing &&
        existing.length > 0 &&
        data.find((r) => r.source === row.source)?.date !== row.date
      ) {
        continue;
      }
    }
    seenSources.add(row.source);

    if (!result.has(row.source)) result.set(row.source, []);
    result.get(row.source)!.push({
      title: row.title,
      streams: row.streams,
      artwork_url: row.artwork_url ?? undefined,
      songstats_track_id: row.songstats_track_id ?? undefined,
      songstats_url: row.songstats_url ?? undefined,
    });
  }

  return result;
}

export async function getAllCachedTopCurators(): Promise<Map<string, TopCurator[]>> {
  const userId = await getUserId();
  if (!userId || !supabase) return new Map();

  const { data, error } = await supabase
    .from("top_curators")
    .select("source,date,curator_name,followers_total,image_url,external_url,rank")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("rank", { ascending: true });

  if (error || !data) return new Map();

  const result = new Map<string, TopCurator[]>();
  const latestDates = new Map<string, string>();

  for (const row of data) {
    if (!latestDates.has(row.source)) {
      latestDates.set(row.source, row.date);
    }
    if (row.date !== latestDates.get(row.source)) continue;

    if (!result.has(row.source)) result.set(row.source, []);
    result.get(row.source)!.push({
      curator_name: row.curator_name,
      followers_total: row.followers_total ?? undefined,
      image_url: row.image_url ?? undefined,
      external_url: row.external_url ?? undefined,
    });
  }

  return result;
}

export async function getLatestTrackStats(
  songstatsTrackId: string,
  source: string
): Promise<TrackStat[]> {
  const userId = await getUserId();
  if (!userId || !supabase) return [];

  const { data: dateRow } = await supabase
    .from("track_stats")
    .select("date")
    .eq("user_id", userId)
    .eq("songstats_track_id", songstatsTrackId)
    .eq("source", source)
    .order("date", { ascending: false })
    .limit(1);

  if (!dateRow || dateRow.length === 0) return [];

  const { data, error } = await supabase
    .from("track_stats")
    .select("songstats_track_id,source,stat_type,value")
    .eq("user_id", userId)
    .eq("songstats_track_id", songstatsTrackId)
    .eq("source", source)
    .eq("date", dateRow[0].date);

  if (error) return [];

  return (data ?? []).map((row) => ({
    songstats_track_id: row.songstats_track_id,
    source: row.source,
    stat_type: row.stat_type,
    value: row.value,
  }));
}

export async function getTrackStatsLastFetch(source: string): Promise<string | null> {
  const userId = await getUserId();
  if (!userId || !supabase) return null;

  const { data } = await supabase
    .from("track_stats")
    .select("date")
    .eq("user_id", userId)
    .eq("source", source)
    .order("date", { ascending: false })
    .limit(1);

  return data?.[0]?.date ?? null;
}
