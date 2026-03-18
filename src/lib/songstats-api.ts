import { fetch } from "@tauri-apps/plugin-http";
import { RAPIDAPI_BASE_URL, RAPIDAPI_HOST } from "./constants";
import type { ArtistInfo, PlatformStats, TopTrack, TopCurator } from "./types";
import {
  logApiCall,
  saveDailyStat,
  saveTopTracks,
  saveTopCurators,
  saveTrackStats,
} from "./database";
import { FIELD_MAP, mapStatFields } from "./songstats-fields";

export const TOP_TRACKS_SOURCES = [
  "spotify",
  "tiktok",
  "youtube",
  "apple_music",
  "shazam",
  "soundcloud",
];
export const TOP_CURATORS_SOURCES = ["tiktok"];

async function apiGet(
  api_key: string,
  endpoint: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${RAPIDAPI_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    if (response.status === 429) {
      console.warn(`[songstats] Rate limited on ${endpoint}, retrying...`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    return await response.json();
  }

  throw new Error(`API error 429: rate limited after 3 retries`);
}

export async function getArtistInfo(api_key: string, spotifyArtistId: string): Promise<ArtistInfo> {
  const data = (await apiGet(api_key, "/artists/info", {
    spotify_artist_id: spotifyArtistId,
  })) as {
    artist_info: {
      songstats_artist_id: string;
      name: string;
      avatar: string;
      links: Array<{ source: string; url: string }>;
    };
  };

  await logApiCall("/artists/info", "all", 200);

  const sources: Record<string, string> = {};
  if (data.artist_info?.links) {
    for (const s of data.artist_info.links) {
      sources[s.source] = s.url;
    }
  }

  return {
    songstats_artist_id: data.artist_info?.songstats_artist_id ?? "",
    name: data.artist_info?.name ?? "Unknown",
    avatar_url: data.artist_info?.avatar ?? "",
    sources,
  };
}

export async function getArtistStats(
  api_key: string,
  spotifyArtistId: string,
  source: string
): Promise<PlatformStats> {
  const data = (await apiGet(api_key, "/artists/stats", {
    spotify_artist_id: spotifyArtistId,
    source,
  })) as {
    stats: Array<{ source: string; data: Record<string, number> }>;
  };

  await logApiCall("/artists/stats", source, 200);

  const entry = data.stats?.find((s) => s.source === source);
  if (entry?.data) {
    const unmapped = Object.keys(entry.data).filter((k) => !FIELD_MAP[k]);
    if (unmapped.length > 0) {
      console.warn(`[songstats] Unmapped fields for ${source}:`, unmapped);
    }
  }
  const stats = entry?.data ? mapStatFields(entry.data) : {};

  return { source, stats };
}

// Re-export from shared module for backwards compatibility
export { FIELD_MAP, mapStatFields } from "./songstats-fields";

export async function fetchHistoricStats(
  api_key: string,
  spotifyArtistId: string,
  sources: string[],
  days: number = 90
): Promise<number> {
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let savedCount = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const data = await apiGet(api_key, "/artists/historic_stats", {
        spotify_artist_id: spotifyArtistId,
        source,
        start_date: startDate,
      });

      await logApiCall("/artists/historic_stats", source, 200);

      // Response format: { stats: [{ source, data: { history: [{ date, ...fields }] } }] }
      const raw = data as {
        stats?: Array<{ source: string; data?: { history?: Array<Record<string, unknown>> } }>;
      };
      const match = raw.stats?.find((s) => s.source === source);
      const entries = match?.data?.history ?? [];

      for (const entry of entries) {
        const date = entry.date as string | undefined;
        if (!date) continue;
        const mapped = mapStatFields(entry as unknown as Record<string, number>);
        for (const [statType, value] of Object.entries(mapped)) {
          if (typeof value === "number" && value > 0) {
            await saveDailyStat(date, source, statType, value);
            savedCount++;
          }
        }
      }
    } catch (err) {
      console.error(`[songstats] FAILED to fetch historic stats for ${source}:`, err);
      await logApiCall("/artists/historic_stats", source, 500);
    }
  }

  return savedCount;
}

export async function fetchAllStats(
  api_key: string,
  spotifyArtistId: string,
  sources: string[]
): Promise<PlatformStats[]> {
  const today = new Date().toISOString().slice(0, 10);
  const results: PlatformStats[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    // Delay between requests to avoid per-second rate limit on BASIC plan
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const platformStats = await getArtistStats(api_key, spotifyArtistId, source);
      results.push(platformStats);

      // Save each stat to the database
      for (const [statType, value] of Object.entries(platformStats.stats)) {
        await saveDailyStat(today, source, statType, value);
      }
    } catch (err) {
      console.error(`[songstats] FAILED to fetch stats for ${source}:`, err);
      await logApiCall("/artists/stats", source, 500);
    }
  }

  return results;
}

export async function fetchTopCurators(
  api_key: string,
  spotifyArtistId: string,
  source: string
): Promise<TopCurator[]> {
  try {
    const data = await apiGet(api_key, "/artists/top_curators", {
      spotify_artist_id: spotifyArtistId,
      source,
      scope: "total",
    });

    await logApiCall("/artists/top_curators", source, 200);

    // Response: { data: [{ source, top_curators: [...] }] }
    const raw = data as {
      data?: Array<{ top_curators?: Array<Record<string, unknown>> }>;
    };
    const curators = raw.data?.[0]?.top_curators ?? [];
    return curators.map((c) => ({
      curator_name: String(c.curator_name ?? "Unknown"),
      followers_total: c.followers_total ? String(c.followers_total) : undefined,
      image_url: c.image_url ? String(c.image_url) : undefined,
      external_url: c.external_url ? String(c.external_url) : undefined,
    }));
  } catch (err) {
    console.error(`[songstats] FAILED to fetch top curators for ${source}:`, err);
    await logApiCall("/artists/top_curators", source, 500);
    return [];
  }
}

const TOP_TRACKS_METRIC: Record<string, string> = {
  spotify: "streams",
  tiktok: "videos",
  youtube: "views",
  apple_music: "playlists",
  shazam: "shazams",
  soundcloud: "streams",
};

export async function fetchTopTracks(
  api_key: string,
  spotifyArtistId: string,
  source: string
): Promise<TopTrack[]> {
  try {
    const params: Record<string, string> = {
      spotify_artist_id: spotifyArtistId,
      source,
      limit: "5",
      scope: "total",
    };
    const metric = TOP_TRACKS_METRIC[source];
    if (metric) params.metric = metric;

    const data = await apiGet(api_key, "/artists/top_tracks", params);

    await logApiCall("/artists/top_tracks", source, 200);

    // Response: { data: [{ source, top_tracks: [...] }] }
    const raw = data as {
      data?: Array<{ top_tracks?: Array<Record<string, unknown>> }>;
    };

    const tracks = raw.data?.[0]?.top_tracks ?? [];
    return tracks.map((t) => ({
      title: String(t.track_name ?? t.title ?? t.name ?? "Unknown"),
      streams: Number(t.rank_value ?? t.streams ?? t.streams_total ?? t.plays ?? t.views ?? 0),
      artwork_url: t.image_url
        ? String(t.image_url)
        : t.artwork_url
          ? String(t.artwork_url)
          : undefined,
      songstats_track_id: t.songstats_track_id ? String(t.songstats_track_id) : undefined,
      songstats_url: t.songstats_url ? String(t.songstats_url) : undefined,
    }));
  } catch (err) {
    console.error(`[songstats] FAILED to fetch top tracks for ${source}:`, err);
    await logApiCall("/artists/top_tracks", source, 500);
    return [];
  }
}

export async function fetchAndCacheTopContent(
  api_key: string,
  spotifyArtistId: string,
  topTracksSources: string[],
  topCuratorsSources: string[]
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < topTracksSources.length; i++) {
    const source = topTracksSources[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    try {
      const tracks = await fetchTopTracks(api_key, spotifyArtistId, source);
      if (tracks.length > 0) {
        await saveTopTracks(today, source, tracks);
      }
    } catch (err) {
      console.error(`[songstats] FAILED to cache top tracks for ${source}:`, err);
    }
  }

  for (let i = 0; i < topCuratorsSources.length; i++) {
    const source = topCuratorsSources[i];
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const curators = await fetchTopCurators(api_key, spotifyArtistId, source);
      if (curators.length > 0) {
        await saveTopCurators(today, source, curators);
      }
    } catch (err) {
      console.error(`[songstats] FAILED to cache top curators for ${source}:`, err);
    }
  }
}

export async function fetchTrackStats(
  api_key: string,
  songstats_track_id: string,
  source: string
): Promise<Record<string, number>> {
  const data = await apiGet(api_key, "/tracks/stats", {
    songstats_track_id,
    source,
  });

  await logApiCall("/tracks/stats", source, 200);

  const raw = data as {
    stats?: Array<{ source: string; data?: Record<string, number> }>;
  };
  const entry = raw.stats?.find((s) => s.source === source);
  return entry?.data ? mapStatFields(entry.data) : {};
}

export async function fetchAndCacheTrackStats(
  api_key: string,
  tracks: TopTrack[],
  sources: string[]
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  let callCount = 0;

  for (const source of sources) {
    for (const track of tracks) {
      if (!track.songstats_track_id) continue;
      if (callCount > 0) await new Promise((r) => setTimeout(r, 1200));
      try {
        const stats = await fetchTrackStats(api_key, track.songstats_track_id, source);
        const entries = Object.entries(stats).map(([k, v]) => [k, v] as [string, number]);
        if (entries.length > 0) {
          await saveTrackStats(today, track.songstats_track_id, source, entries);
        }
        callCount++;
      } catch (err) {
        console.error(
          `[songstats] FAILED to fetch track stats for ${track.title} on ${source}:`,
          err
        );
        await logApiCall("/tracks/stats", source, 500);
        callCount++;
      }
    }
  }
}

export async function testApiKey(api_key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await apiGet(api_key, "/artists/info", {
      spotify_artist_id: "5k8aKKH3WU39dXEbRyUhGJ",
    });
    return { valid: true };
  } catch (err) {
    const msg = String(err);
    if (msg.includes("401") || msg.includes("403")) {
      return { valid: false, error: "invalid_key" };
    }
    if (msg.includes("429")) {
      return { valid: false, error: "rate_limit" };
    }
    return { valid: false, error: "network" };
  }
}
