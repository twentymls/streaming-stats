import { supabase, getSupabaseUser } from "./supabase";
import { getStatsRange, getAllCachedTopTracks, getAllCachedTopCurators } from "./database";
import { loadSettings } from "./settings";
import { format, subDays } from "date-fns";

const BATCH_SIZE = 1000;

export async function syncToSupabase(): Promise<void> {
  const user = await getSupabaseUser();
  if (!user || !supabase) return;

  const today = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), 1), "yyyy-MM-dd");

  // Sync daily_stats for today and yesterday (in case of late syncs)
  const stats = await getStatsRange(startDate, today);
  if (stats.length > 0) {
    const rows = stats.map((s) => ({
      user_id: user.id,
      date: s.date,
      source: s.source,
      stat_type: s.stat_type,
      value: s.value,
    }));
    const { error } = await supabase
      .from("daily_stats")
      .upsert(rows, { onConflict: "user_id,date,source,stat_type" });
    if (error) console.warn("[sync] daily_stats upsert failed:", error.message);
  }

  // Sync top tracks
  const topTracks = await getAllCachedTopTracks();
  for (const [source, tracks] of topTracks) {
    if (tracks.length === 0) continue;
    const rows = tracks.map((t, i) => ({
      user_id: user.id,
      date: today,
      source,
      rank: i + 1,
      title: t.title,
      streams: t.streams,
      artwork_url: t.artwork_url ?? null,
      songstats_track_id: t.songstats_track_id ?? null,
      songstats_url: t.songstats_url ?? null,
    }));
    const { error } = await supabase
      .from("top_tracks")
      .upsert(rows, { onConflict: "user_id,date,source,rank" });
    if (error) console.warn(`[sync] top_tracks upsert failed for ${source}:`, error.message);
  }

  // Sync top curators
  const topCurators = await getAllCachedTopCurators();
  for (const [source, curators] of topCurators) {
    if (curators.length === 0) continue;
    const rows = curators.map((c, i) => ({
      user_id: user.id,
      date: today,
      source,
      rank: i + 1,
      curator_name: c.curator_name,
      followers_total: c.followers_total ?? null,
      image_url: c.image_url ?? null,
      external_url: c.external_url ?? null,
    }));
    const { error } = await supabase
      .from("top_curators")
      .upsert(rows, { onConflict: "user_id,date,source,rank" });
    if (error) console.warn(`[sync] top_curators upsert failed for ${source}:`, error.message);
  }

  // Update last_sync_at
  await syncSettings();
}

export async function syncAllHistory(): Promise<string | null> {
  const user = await getSupabaseUser();
  if (!user) return "Not signed in — no Supabase user session found";
  if (!supabase) return "Supabase client not configured";

  const errors: string[] = [];

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
  const allStats = await getStatsRange(startDate, endDate);

  if (allStats.length === 0) {
    errors.push("No local stats found to sync");
  }

  // Batch upsert in chunks
  let syncedRows = 0;
  for (let i = 0; i < allStats.length; i += BATCH_SIZE) {
    const batch = allStats.slice(i, i + BATCH_SIZE);
    const rows = batch.map((s) => ({
      user_id: user.id,
      date: s.date,
      source: s.source,
      stat_type: s.stat_type,
      value: s.value,
    }));
    const { error } = await supabase
      .from("daily_stats")
      .upsert(rows, { onConflict: "user_id,date,source,stat_type" });
    if (error) {
      errors.push(`daily_stats batch at ${i}: ${error.message}`);
    } else {
      syncedRows += rows.length;
    }
  }

  // Also sync top tracks and curators
  const today = endDate;
  const topTracks = await getAllCachedTopTracks();
  for (const [source, tracks] of topTracks) {
    if (tracks.length === 0) continue;
    const rows = tracks.map((t, idx) => ({
      user_id: user.id,
      date: today,
      source,
      rank: idx + 1,
      title: t.title,
      streams: t.streams,
      artwork_url: t.artwork_url ?? null,
      songstats_track_id: t.songstats_track_id ?? null,
      songstats_url: t.songstats_url ?? null,
    }));
    const { error } = await supabase
      .from("top_tracks")
      .upsert(rows, { onConflict: "user_id,date,source,rank" });
    if (error) errors.push(`top_tracks ${source}: ${error.message}`);
  }

  const topCurators = await getAllCachedTopCurators();
  for (const [source, curators] of topCurators) {
    if (curators.length === 0) continue;
    const rows = curators.map((c, idx) => ({
      user_id: user.id,
      date: today,
      source,
      rank: idx + 1,
      curator_name: c.curator_name,
      followers_total: c.followers_total ?? null,
      image_url: c.image_url ?? null,
      external_url: c.external_url ?? null,
    }));
    const { error } = await supabase
      .from("top_curators")
      .upsert(rows, { onConflict: "user_id,date,source,rank" });
    if (error) errors.push(`top_curators ${source}: ${error.message}`);
  }

  await syncSettings();

  if (errors.length > 0) {
    return `Synced ${syncedRows} stats rows. Errors: ${errors.join("; ")}`;
  }

  return null; // null = success
}

export async function syncSettings(): Promise<void> {
  const user = await getSupabaseUser();
  if (!user || !supabase) return;

  const settings = await loadSettings();
  if (!settings) return;

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      artist_name: settings.artist_name ?? null,
      spotify_artist_id: settings.spotify_artist_id,
      rapidapi_key: settings.api_key,
      enabled_sources: settings.enabled_sources,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.warn("[sync] user_settings upsert failed:", error.message);
}
