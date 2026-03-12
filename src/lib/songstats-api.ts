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
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function getArtistInfo(
  api_key: string,
  spotifyArtistId: string
): Promise<ArtistInfo> {
  const data = (await apiGet(api_key, "/artists/info", {
    spotify_artist_id: spotifyArtistId,
  })) as {
    stats: {
      songstats_artist_id: string;
      name: string;
      avatar: string;
      source_data: Array<{ source: string; url: string }>;
    };
  };

  await logApiCall("/artists/info", "all", 200);

  const sources: Record<string, string> = {};
  if (data.stats?.source_data) {
    for (const s of data.stats.source_data) {
      sources[s.source] = s.url;
    }
  }

  return {
    songstats_artist_id: data.stats?.songstats_artist_id ?? "",
    name: data.stats?.name ?? "Unknown",
    avatar_url: data.stats?.avatar ?? "",
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
    stats: {
      source: string;
      data: Array<{ source: string; stat_type: string; value: number }>;
    };
  };

  await logApiCall("/artists/stats", source, 200);

  const stats: Record<string, number> = {};
  if (data.stats?.data) {
    for (const item of data.stats.data) {
      stats[item.stat_type] = item.value;
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

  for (const source of sources) {
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
      console.error(`Failed to fetch stats for ${source}:`, err);
      await logApiCall("/artists/stats", source, 500);
    }
  }

  return results;
}

export async function testApiKey(api_key: string): Promise<boolean> {
  try {
    await apiGet(api_key, "/artists/info", {
      spotify_artist_id: "5k8aKKH3WU39dXEbRyUhGJ",
    });
    return true;
  } catch {
    return false;
  }
}
