import { load } from "@tauri-apps/plugin-store";
import { AppSettings } from "./types";
import { DEFAULT_SOURCES, FETCH_HOUR } from "./constants";

const STORE_NAME = "settings.json";

export async function loadSettings(): Promise<AppSettings | null> {
  const store = await load(STORE_NAME);
  const apiKey = await store.get<string>("api_key");
  if (!apiKey) return null;

  const spotifyArtistId = (await store.get<string>("spotify_artist_id")) ?? "";
  const artistName = (await store.get<string>("artist_name")) ?? "";
  const enabledSources = (await store.get<string[]>("enabled_sources")) ?? DEFAULT_SOURCES;

  return {
    api_key: apiKey,
    spotify_artist_id: spotifyArtistId,
    artist_name: artistName,
    enabled_sources: enabledSources,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await load(STORE_NAME);
  await store.set("api_key", settings.api_key);
  await store.set("spotify_artist_id", settings.spotify_artist_id);
  await store.set("artist_name", settings.artist_name ?? "");
  await store.set("enabled_sources", settings.enabled_sources);
  await store.save();
}

export async function hasApiKey(): Promise<boolean> {
  const store = await load(STORE_NAME);
  const key = await store.get<string>("api_key");
  return !!key;
}

export async function getAutoFetchState(): Promise<{
  lastFetchIso: string | null;
  fetchCountToday: number;
}> {
  const store = await load(STORE_NAME);
  const lastFetchIso = (await store.get<string>("last_fetch_iso")) ?? null;
  const fetchCountToday = (await store.get<number>("fetch_count_today")) ?? 0;

  // Reset counter if the stored date is not today
  const today = new Date().toLocaleDateString("sv"); // yyyy-MM-dd local
  const lastDate = lastFetchIso?.slice(0, 10);
  if (lastDate !== today) {
    return { lastFetchIso, fetchCountToday: 0 };
  }

  return { lastFetchIso, fetchCountToday };
}

export interface FetchScheduleInfo {
  shouldFetchNow: boolean;
  shouldDeferToFetchHour: boolean;
  msUntilFetchHour: number;
}

export async function getScheduledFetchInfo(hasData: boolean): Promise<FetchScheduleInfo> {
  const { lastFetchIso, fetchCountToday } = await getAutoFetchState();
  const fetchHour = FETCH_HOUR;

  const now = new Date();
  const today = now.toLocaleDateString("sv");
  const lastDate = lastFetchIso?.slice(0, 10);
  const effectiveCount = lastDate === today ? fetchCountToday : 0;

  // Already fetched today — nothing to do
  if (effectiveCount >= 1) {
    return { shouldFetchNow: false, shouldDeferToFetchHour: false, msUntilFetchHour: 0 };
  }

  // No data at all (first launch) → fetch immediately
  if (!hasData || !lastFetchIso) {
    return { shouldFetchNow: true, shouldDeferToFetchHour: false, msUntilFetchHour: 0 };
  }

  // Missed day(s) — last fetch was 2+ days ago → catch-up immediately
  if (lastDate && lastDate < today) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("sv");
    if (lastDate < yesterdayStr) {
      return { shouldFetchNow: true, shouldDeferToFetchHour: false, msUntilFetchHour: 0 };
    }
  }

  // Current hour >= fetch_hour → fetch now
  if (now.getHours() >= fetchHour) {
    return { shouldFetchNow: true, shouldDeferToFetchHour: false, msUntilFetchHour: 0 };
  }

  // Before fetch_hour today — defer
  const target = new Date(now);
  target.setHours(fetchHour, 0, 0, 0);
  const ms = target.getTime() - now.getTime();
  return { shouldFetchNow: false, shouldDeferToFetchHour: true, msUntilFetchHour: ms };
}

export async function recordFetch(): Promise<void> {
  const store = await load(STORE_NAME);
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv");
  const nowIso = now.toISOString();

  const prevIso = await store.get<string>("last_fetch_iso");
  const prevDate = prevIso?.slice(0, 10);
  const prevCount = (await store.get<number>("fetch_count_today")) ?? 0;

  const newCount = prevDate === todayStr ? prevCount + 1 : 1;

  await store.set("last_fetch_iso", nowIso);
  await store.set("fetch_count_today", newCount);
  await store.save();
}
