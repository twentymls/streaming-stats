import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAPIDAPI_HOST = "songstats.p.rapidapi.com";
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

const FIELD_MAP: Record<string, string> = {
  streams_total: "streams",
  views_total: "views",
  video_views_total: "views",
  plays_total: "plays",
  creates_total: "creates",
  shazams_total: "shazams",
  followers_total: "followers",
  subscribers_total: "followers",
  monthly_listeners_current: "monthly_listeners",
  monthly_listeners: "monthly_listeners",
  monthly_audience_current: "monthly_audience",
  monthly_audience: "monthly_audience",
  popularity_current: "popularity",
  playlist_reach_current: "playlist_reach",
  playlist_reach: "playlist_reach",
  playlist_reach_total: "playlist_reach_total",
  playlists_current: "playlist_count",
  playlists_total: "playlists_total",
  playlists_editorial_current: "editorial_playlists",
  playlists_editorial_total: "editorial_playlists_total",
  charts_total: "chart_entries",
  charts_current: "current_charts",
  charted_tracks_current: "charted_tracks",
  charted_tracks_total: "charted_tracks_total",
  charted_cities_total: "charted_cities",
  charted_countries_total: "charted_countries",
  likes_total: "likes",
  video_likes_total: "likes",
  video_comments_total: "video_comments",
  short_likes_total: "short_likes",
  short_comments_total: "short_comments",
  comments_total: "comments",
  shares_total: "shares",
  reposts_total: "reposts",
  favorites_total: "favorites",
  engagement_rate_total: "engagement_rate",
  video_engagement_rate_total: "video_engagement",
  short_engagement_rate_total: "short_engagement",
  videos_total: "videos",
  shorts_total: "shorts",
  channel_views_total: "channel_views",
  short_views_total: "short_views",
  creator_reach_total: "creator_reach",
  profile_likes_total: "profile_likes",
  profile_videos_total: "profile_videos",
};

const TOP_TRACKS_SOURCES = [
  "spotify",
  "tiktok",
  "youtube",
  "apple_music",
  "shazam",
  "soundcloud",
];
const TOP_CURATORS_SOURCES = ["tiktok"];

const TOP_TRACKS_METRIC: Record<string, string> = {
  spotify: "streams",
  tiktok: "videos",
  youtube: "views",
  apple_music: "playlists",
  shazam: "shazams",
  soundcloud: "streams",
};

function mapStatFields(rawData: Record<string, number>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [apiField, value] of Object.entries(rawData)) {
    const statType = FIELD_MAP[apiField];
    if (statType) {
      stats[statType] =
        stats[statType] != null ? Math.max(stats[statType], value) : value;
    }
  }
  return stats;
}

async function apiGet(
  apiKey: string,
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
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    if (response.status === 429) {
      console.warn(`[daily-fetch] Rate limited on ${endpoint}, retrying...`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    return await response.json();
  }

  throw new Error(`API error 429: rate limited after 3 retries`);
}

Deno.serve(async (req) => {
  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find users whose desktop hasn't synced in 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: staleUsers, error: queryError } = await supabase
    .from("user_settings")
    .select("*")
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`);

  if (queryError) {
    console.error("[daily-fetch] Failed to query stale users:", queryError.message);
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;

  for (const user of staleUsers ?? []) {
    if (!user.rapidapi_key || !user.spotify_artist_id) continue;
    const sources: string[] = user.enabled_sources ?? [];
    if (sources.length === 0) continue;

    console.log(`[daily-fetch] Processing user ${user.user_id}`);

    // Fetch stats for each enabled source
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 1200));

      try {
        const data = (await apiGet(user.rapidapi_key, "/artists/stats", {
          spotify_artist_id: user.spotify_artist_id,
          source,
        })) as {
          stats?: Array<{ source: string; data?: Record<string, number> }>;
        };

        const entry = data.stats?.find((s: { source: string }) => s.source === source);
        const stats = entry?.data ? mapStatFields(entry.data) : {};

        const rows = Object.entries(stats)
          .filter(([, value]) => typeof value === "number" && value > 0)
          .map(([statType, value]) => ({
            user_id: user.user_id,
            date: today,
            source,
            stat_type: statType,
            value,
          }));

        if (rows.length > 0) {
          const { error } = await supabase
            .from("daily_stats")
            .upsert(rows, { onConflict: "user_id,date,source,stat_type" });
          if (error) console.warn(`[daily-fetch] Upsert failed for ${source}:`, error.message);
        }
      } catch (err) {
        console.error(`[daily-fetch] Failed to fetch ${source} for user ${user.user_id}:`, err);
      }
    }

    // Fetch top tracks for applicable sources
    for (let i = 0; i < TOP_TRACKS_SOURCES.length; i++) {
      const source = TOP_TRACKS_SOURCES[i];
      if (!sources.includes(source)) continue;
      await new Promise((r) => setTimeout(r, 1200));

      try {
        const params: Record<string, string> = {
          spotify_artist_id: user.spotify_artist_id,
          source,
          limit: "5",
          scope: "total",
        };
        const metric = TOP_TRACKS_METRIC[source];
        if (metric) params.metric = metric;

        const data = (await apiGet(user.rapidapi_key, "/artists/top_tracks", params)) as {
          data?: Array<{ top_tracks?: Array<Record<string, unknown>> }>;
        };

        const tracks = data.data?.[0]?.top_tracks ?? [];
        const rows = tracks.map((t, idx) => ({
          user_id: user.user_id,
          date: today,
          source,
          rank: idx + 1,
          title: String(t.track_name ?? t.title ?? t.name ?? "Unknown"),
          streams: Number(
            t.rank_value ?? t.streams ?? t.streams_total ?? t.plays ?? t.views ?? 0
          ),
          artwork_url: t.image_url ? String(t.image_url) : t.artwork_url ? String(t.artwork_url) : null,
          songstats_track_id: t.songstats_track_id ? String(t.songstats_track_id) : null,
          songstats_url: t.songstats_url ? String(t.songstats_url) : null,
        }));

        if (rows.length > 0) {
          const { error } = await supabase
            .from("top_tracks")
            .upsert(rows, { onConflict: "user_id,date,source,rank" });
          if (error) console.warn(`[daily-fetch] top_tracks upsert failed for ${source}:`, error.message);
        }
      } catch (err) {
        console.error(`[daily-fetch] top_tracks failed for ${source}:`, err);
      }
    }

    // Fetch top curators for TikTok
    for (const source of TOP_CURATORS_SOURCES) {
      if (!sources.includes(source)) continue;
      await new Promise((r) => setTimeout(r, 1200));

      try {
        const data = (await apiGet(user.rapidapi_key, "/artists/top_curators", {
          spotify_artist_id: user.spotify_artist_id,
          source,
          scope: "total",
        })) as {
          data?: Array<{ top_curators?: Array<Record<string, unknown>> }>;
        };

        const curators = data.data?.[0]?.top_curators ?? [];
        const rows = curators.map((c, idx) => ({
          user_id: user.user_id,
          date: today,
          source,
          rank: idx + 1,
          curator_name: String(c.curator_name ?? "Unknown"),
          followers_total: c.followers_total ? String(c.followers_total) : null,
          image_url: c.image_url ? String(c.image_url) : null,
          external_url: c.external_url ? String(c.external_url) : null,
        }));

        if (rows.length > 0) {
          const { error } = await supabase
            .from("top_curators")
            .upsert(rows, { onConflict: "user_id,date,source,rank" });
          if (error)
            console.warn(`[daily-fetch] top_curators upsert failed for ${source}:`, error.message);
        }
      } catch (err) {
        console.error(`[daily-fetch] top_curators failed for ${source}:`, err);
      }
    }

    // Update last_sync_at
    await supabase
      .from("user_settings")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", user.user_id);

    processed++;
  }

  return new Response(
    JSON.stringify({ ok: true, processed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
