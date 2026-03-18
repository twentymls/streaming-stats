import { supabase, getSupabaseUser } from "./supabase";
import type { AppSettings } from "./types";
import { DEFAULT_SOURCES } from "./constants";
import type { FetchScheduleInfo } from "./settings";

export async function loadSettings(): Promise<AppSettings | null> {
  const user = await getSupabaseUser();
  if (!user || !supabase) return null;

  const { data } = await supabase
    .from("user_settings")
    .select("artist_name,spotify_artist_id,enabled_sources")
    .eq("user_id", user.id)
    .single();

  if (!data) return null;

  return {
    api_key: "", // Not exposed to PWA
    spotify_artist_id: data.spotify_artist_id ?? "",
    artist_name: data.artist_name ?? "",
    enabled_sources: data.enabled_sources ?? DEFAULT_SOURCES,
  };
}

export async function saveSettings(): Promise<void> {
  // No-op in PWA
}

export async function hasApiKey(): Promise<boolean> {
  const user = await getSupabaseUser();
  return !!user;
}

export async function getAutoFetchState(): Promise<{
  lastFetchIso: string | null;
  fetchCountToday: number;
}> {
  return { lastFetchIso: null, fetchCountToday: 0 };
}

export async function getScheduledFetchInfo(): Promise<FetchScheduleInfo> {
  return { shouldFetchNow: false, shouldDeferToFetchHour: false, msUntilFetchHour: 0 };
}

export async function recordFetch(): Promise<void> {
  // No-op in PWA
}
