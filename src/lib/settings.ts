import { load } from "@tauri-apps/plugin-store";
import { AppSettings } from "./types";
import { DEFAULT_SOURCES } from "./constants";

const STORE_NAME = "settings.json";

export async function loadSettings(): Promise<AppSettings | null> {
  const store = await load(STORE_NAME);
  const apiKey = await store.get<string>("api_key");
  if (!apiKey) return null;

  const spotifyArtistId =
    (await store.get<string>("spotify_artist_id")) ?? "";
  const artistName = (await store.get<string>("artist_name")) ?? "";
  const enabledSources =
    (await store.get<string[]>("enabled_sources")) ?? DEFAULT_SOURCES;
  const fetchHour = (await store.get<number>("fetch_hour")) ?? 6;

  return {
    api_key: apiKey,
    spotify_artist_id: spotifyArtistId,
    artist_name: artistName,
    enabled_sources: enabledSources,
    fetch_hour: fetchHour,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await load(STORE_NAME);
  await store.set("api_key", settings.api_key);
  await store.set("spotify_artist_id", settings.spotify_artist_id);
  await store.set("artist_name", settings.artist_name ?? "");
  await store.set("enabled_sources", settings.enabled_sources);
  await store.set("fetch_hour", settings.fetch_hour);
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
  const lastFetchIso =
    (await store.get<string>("last_fetch_iso")) ?? null;
  const fetchCountToday =
    (await store.get<number>("fetch_count_today")) ?? 0;

  // Reset counter if the stored date is not today
  const today = new Date().toLocaleDateString("sv"); // yyyy-MM-dd local
  const lastDate = lastFetchIso?.slice(0, 10);
  if (lastDate !== today) {
    return { lastFetchIso, fetchCountToday: 0 };
  }

  return { lastFetchIso, fetchCountToday };
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
