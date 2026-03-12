import { fetch } from "@tauri-apps/plugin-http";
import { RAPIDAPI_BASE_URL, RAPIDAPI_HOST } from "./constants";
import { ArtistInfo, PlatformStats, TopTrack } from "./types";
import { logApiCall, saveDailyStat } from "./database";

async function apiGet(
  api_key: string,
  endpoint: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${RAPIDAPI_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-rapidapi-key": api_key,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

export async function getArtistInfo(
  api_key: string,
  spotifyArtistId: string
): Promise<ArtistInfo> {
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
  const stats = entry?.data ? mapStatFields(entry.data) : {};

  return { source, stats };
}

const FIELD_MAP: Record<string, string> = {
  streams_total: "streams",
  views_total: "views",
  video_views_total: "views",
  followers_total: "followers",
  subscribers_total: "followers",
  monthly_listeners_current: "monthly_listeners",
  playlist_reach_current: "playlist_reach",
  playlists_current: "playlist_count",
  charts_total: "chart_entries",
  likes_total: "likes",
  video_likes_total: "likes",
  plays_total: "plays",
  creates_total: "creates",
  shazams_total: "shazams",
  videos_total: "videos",
  favorites_total: "favorites",
};

function mapStatFields(rawData: Record<string, number>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [apiField, value] of Object.entries(rawData)) {
    const statType = FIELD_MAP[apiField];
    if (statType) stats[statType] = value;
  }
  return stats;
}

export async function fetchHistoricStats(
  api_key: string,
  spotifyArtistId: string,
  sources: string[],
  days: number = 90
): Promise<number> {
  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
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
      const raw = data as { stats?: Array<{ source: string; data?: { history?: Array<Record<string, unknown>> } }> };
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
      console.error(
        `[songstats] FAILED to fetch historic stats for ${source}:`,
        err
      );
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
      const platformStats = await getArtistStats(
        api_key,
        spotifyArtistId,
        source
      );
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

export async function fetchTopTracks(
  api_key: string,
  spotifyArtistId: string,
  source: string
): Promise<TopTrack[]> {
  try {
    const data = await apiGet(api_key, "/artists/top_tracks", {
      spotify_artist_id: spotifyArtistId,
      source,
      limit: "5",
    });

    await logApiCall("/artists/top_tracks", source, 200);

    console.log("[songstats] /artists/top_tracks raw response:", JSON.stringify(data, null, 2));

    const raw = data as {
      top_tracks?: Array<{
        title?: string;
        name?: string;
        track_name?: string;
        streams?: number;
        streams_total?: number;
        plays?: number;
        views?: number;
        artwork_url?: string;
        image?: string;
      }>;
    };

    const tracks = raw.top_tracks ?? [];
    return tracks.map((t) => ({
      title: t.title ?? t.name ?? t.track_name ?? "Unknown",
      streams: t.streams ?? t.streams_total ?? t.plays ?? t.views ?? 0,
      artwork_url: t.artwork_url ?? t.image,
    }));
  } catch (err) {
    console.error(`[songstats] FAILED to fetch top tracks for ${source}:`, err);
    await logApiCall("/artists/top_tracks", source, 500);
    return [];
  }
}

export async function testApiKey(
  api_key: string
): Promise<{ valid: boolean; error?: string }> {
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
