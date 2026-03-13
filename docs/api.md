# Songstats API Integration

All external API calls go through the Songstats RapidAPI. The client is implemented in `src/lib/songstats-api.ts`.

## Connection Details

- **Host**: `songstats.p.rapidapi.com`
- **Base URL**: `https://songstats.p.rapidapi.com`
- **Auth**: RapidAPI key passed via `X-RapidAPI-Key` header
- **Transport**: `@tauri-apps/plugin-http` (reqwest under the hood, bypasses browser CORS)
- **Plan limit**: 500 requests/month (BASIC plan)

## Endpoints

### GET /artists/info

Fetches artist metadata using a Spotify artist ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `spotify_artist_id` | string | Spotify artist ID (e.g., `0TnOYISbd1XYRBk9myaseg`) |

**Response fields used:**
- `songstats_artist_id` -- internal ID for other endpoints
- `name` -- artist display name
- `avatar_url` -- profile image
- `source_ids` -- map of platform keys to platform-specific IDs

**Used by:** Setup wizard (key validation), first-launch info fetch.

---

### GET /artists/stats

Fetches current stats for a single platform.

| Parameter | Type | Description |
|-----------|------|-------------|
| `spotify_artist_id` | string | Spotify artist ID |
| `source` | string | Platform key: `spotify`, `youtube`, `tiktok`, etc. |

**Response:** A `data.stats` object containing raw stat fields (e.g., `streams_total`, `monthly_listeners_current`). These are mapped to app stat types via the `FIELD_MAP` (see Field Mapping below).

**Used by:** `fetchAllStats()` -- called once per enabled platform during daily updates.

---

### GET /artists/historic_stats

Fetches daily cumulative stats for a platform over a date range.

| Parameter | Type | Description |
|-----------|------|-------------|
| `spotify_artist_id` | string | Spotify artist ID |
| `source` | string | Platform key |
| `start_date` | string | ISO date (e.g., `2024-12-14`) |

**Response:** A `data.stats` object where each key is a stat type, and each value is an array of `{ date, value }` entries.

**Used by:** `fetchHistoricStats()` -- called once per platform on first launch to backfill ~90 days.

---

### GET /artists/top_tracks

Fetches top tracks for a platform.

| Parameter | Type | Description |
|-----------|------|-------------|
| `spotify_artist_id` | string | Spotify artist ID |
| `source` | string | Platform key |
| `limit` | number | Max tracks to return (always 5) |
| `scope` | string | Always `total` |
| `metric` | string | Platform-specific sort metric (see below) |

**Platform-specific metrics:**

| Platform | Metric |
|----------|--------|
| spotify | `streams` |
| tiktok | `videos` |
| youtube | `views` |
| apple_music | `playlists` |
| shazam | `shazams` |
| soundcloud | `streams` |

**Response fields used per track:**
- `title` -- track name
- `streams` / `streams_total` -- play count
- `artwork_url` -- cover image
- `songstats_track_id` -- for per-track stats lookup
- `songstats_url` -- link to Songstats page

**Used by:** `fetchAndCacheTopContent()` -- fetched daily (first update of each day).

---

### GET /artists/top_curators

Fetches top curators (currently TikTok only).

| Parameter | Type | Description |
|-----------|------|-------------|
| `spotify_artist_id` | string | Spotify artist ID |
| `source` | string | Platform key (always `tiktok`) |
| `scope` | string | Always `total` |

**Response fields used per curator:**
- `curator_name` -- TikTok creator name
- `followers_total` -- follower count (formatted string)
- `image_url` -- profile image
- `external_url` -- link to TikTok profile

**Used by:** `fetchAndCacheTopContent()` -- fetched daily.

---

### GET /tracks/stats

Fetches statistics for a single track on a specific platform.

| Parameter | Type | Description |
|-----------|------|-------------|
| `songstats_track_id` | string | Songstats internal track ID |
| `source` | string | Platform key |

**Response:** A `data.stats` object with stat fields mapped via `FIELD_MAP`.

**Used by:** `fetchAndCacheTrackStats()` -- fetched weekly for TikTok and YouTube top tracks.

---

## Rate Limiting & Retry Logic

```typescript
async function apiGet(api_key, endpoint, params) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers });
    if (response.status === 429) {
      await sleep(1500);  // Wait 1.5s before retry
      continue;
    }
    return response;
  }
}
```

- 3 retry attempts on HTTP 429 (Too Many Requests).
- 1.5 second delay between retries.
- 1.2 second delay between sequential platform requests in batch operations.
- Every API call is logged to `api_calls_log` table for usage tracking.

## Field Mapping

The API returns raw field names that differ across platforms. `FIELD_MAP` in `songstats-api.ts` normalizes 60+ API fields into ~40 app stat types. When multiple API fields map to the same stat type, the maximum value is used.

**Core mappings:**

| API Field | App Stat Type |
|-----------|---------------|
| `streams_total` | `streams` |
| `views_total`, `video_views_total` | `views` |
| `monthly_listeners_current` | `monthly_listeners` |
| `followers_total`, `followers` | `followers` |
| `shazams_total` | `shazams` |
| `plays_total` | `plays` |
| `videos_total` | `creates` |
| `playlist_reach_total` | `playlist_reach` |
| `editorial_playlists_total` | `editorial_playlists` |
| `likes_total` | `likes` |
| `comments_total` | `comments` |
| `shares_total` | `shares` |

See `src/lib/songstats-api.ts` for the complete mapping table.

## API Call Budget

A typical daily update uses ~15 API calls:
- 8 platform stat fetches (`/artists/stats` x 8 sources)
- 6 top track fetches (`/artists/top_tracks` x 6 sources)
- 1 top curators fetch (`/artists/top_curators` for TikTok)

Weekly per-track stats add ~4-10 calls depending on how many tracks have `songstats_track_id`.

Historic backfill (first launch): 8 calls (`/artists/historic_stats` x 8 sources).

At 1 update per day and 15 calls/update, that's ~450 calls/month out of the 500 limit.
