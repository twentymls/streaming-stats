import { fetch } from "@tauri-apps/plugin-http";
import { RAPIDAPI_BASE_URL, RAPIDAPI_HOST } from "./constants";
import { ArtistInfo, PlatformStats } from "./types";
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

  const stats: Record<string, number> = {};
  const entry = data.stats?.find((s) => s.source === source);
  if (entry?.data) {
    // Map API field names to our stat types
    const fieldMap: Record<string, string> = {
      streams_total: "streams",
      views_total: "views",
      video_views_total: "views",
      followers_total: "followers",
      subscribers_total: "followers",
      playlist_reach_current: "playlist_reach",
      playlists_current: "playlist_count",
      charts_total: "chart_entries",
      likes_total: "likes",
      video_likes_total: "likes",
      plays_total: "plays",
      creates_total: "creates",
      shazams_total: "shazams",
    };
    for (const [apiField, value] of Object.entries(entry.data)) {
      const statType = fieldMap[apiField];
      if (statType) {
        stats[statType] = value;
      }
    }
  }

  return { source, stats };
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
