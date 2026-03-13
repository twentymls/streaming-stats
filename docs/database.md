# Database Schema

The app uses a local SQLite database managed by the Rust backend via `sqlx`. The database file is stored in the Tauri app-data directory. Migrations run automatically on every app startup and are idempotent.

## Tables

### daily_stats

Stores cumulative daily statistics per platform per stat type. This is the core data table.

```sql
CREATE TABLE daily_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,           -- ISO date: "2025-03-13"
  source      TEXT NOT NULL,           -- Platform key: "spotify", "youtube", etc.
  stat_type   TEXT NOT NULL,           -- Metric key: "streams", "views", "followers", etc.
  value       INTEGER NOT NULL DEFAULT 0,  -- Cumulative total at that date
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(date, source, stat_type)
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_daily_stats_source ON daily_stats(source);
```

**Key points:**
- Values are **cumulative totals**, not daily deltas. Daily deltas are computed in the frontend by subtracting consecutive days.
- The `UNIQUE` constraint enables upsert via `INSERT OR REPLACE` -- re-fetching the same day overwrites cleanly.
- One row per (date, source, stat_type) combination. For a single platform on a single day, there may be 10-20 rows (one per stat type).

**Example rows:**

| date | source | stat_type | value |
|------|--------|-----------|-------|
| 2025-03-13 | spotify | streams | 16,234,567 |
| 2025-03-13 | spotify | monthly_listeners | 45,231 |
| 2025-03-13 | spotify | followers | 12,890 |
| 2025-03-13 | youtube | views | 8,912,345 |
| 2025-03-13 | tiktok | views | 2,145,678,901 |

---

### api_calls_log

Tracks API usage for monitoring the 500 requests/month quota.

```sql
CREATE TABLE api_calls_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT NOT NULL,            -- e.g. "/artists/stats"
  source      TEXT,                     -- Platform or null for general endpoints
  status_code INTEGER,                  -- HTTP status: 200, 429, etc.
  called_at   TEXT DEFAULT (datetime('now')),
  month_year  TEXT NOT NULL             -- e.g. "2025-03"
);

CREATE INDEX idx_api_calls_month ON api_calls_log(month_year);
```

**Key points:**
- `month_year` is used to count calls for the current billing period.
- The dashboard header shows "API: X/500" using a `COUNT(*)` query on the current month.

---

### top_tracks

Caches the top 5 tracks per platform. Re-fetched on the first update of each day.

```sql
CREATE TABLE top_tracks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  date                TEXT NOT NULL,
  source              TEXT NOT NULL,
  rank                INTEGER NOT NULL,       -- 1-5
  title               TEXT NOT NULL,
  streams             INTEGER NOT NULL DEFAULT 0,  -- Play count (streams/views/etc.)
  artwork_url         TEXT,
  songstats_track_id  TEXT,                   -- For per-track stats lookup
  songstats_url       TEXT,                   -- Link to Songstats track page
  UNIQUE(date, source, rank)
);

CREATE INDEX idx_top_tracks_date_source ON top_tracks(date, source);
```

**Key points:**
- `streams` is a generic name but stores the platform's primary metric (Spotify streams, YouTube views, TikTok views, etc.).
- `songstats_track_id` and `songstats_url` were added via migration (ALTER TABLE) and may be NULL for older rows.
- Track deltas (daily stream gains) are computed by comparing the latest two dates' data for the same track title.

---

### top_curators

Caches top curators for TikTok. Only populated for the TikTok platform.

```sql
CREATE TABLE top_curators (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  source          TEXT NOT NULL,           -- Always "tiktok" currently
  rank            INTEGER NOT NULL,
  curator_name    TEXT NOT NULL,
  followers_total TEXT,                    -- Stored as text (API returns formatted strings)
  image_url       TEXT,
  external_url    TEXT,                    -- Link to curator's TikTok profile
  UNIQUE(date, source, rank)
);

CREATE INDEX idx_top_curators_date_source ON top_curators(date, source);
```

---

### track_stats

Stores per-track statistics from the Songstats `/tracks/stats` endpoint. Refreshed weekly.

```sql
CREATE TABLE track_stats (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  date                TEXT NOT NULL,
  songstats_track_id  TEXT NOT NULL,
  source              TEXT NOT NULL,
  stat_type           TEXT NOT NULL,
  value               REAL NOT NULL DEFAULT 0,  -- Note: REAL not INTEGER
  UNIQUE(date, songstats_track_id, source, stat_type)
);

CREATE INDEX idx_track_stats_id_source ON track_stats(songstats_track_id, source);
```

**Key points:**
- Uses `REAL` for values (not INTEGER) because some stats are decimal (engagement rates).
- Only fetched for tracks that have a `songstats_track_id` in the `top_tracks` table.
- Currently fetched for TikTok and YouTube sources only.

---

## Query Patterns

### Get latest stats (all platforms)

```sql
SELECT * FROM daily_stats
WHERE date = (SELECT MAX(date) FROM daily_stats)
```

### Get stats for date range

```sql
SELECT * FROM daily_stats
WHERE date >= ? AND date <= ?
ORDER BY date ASC
```

### Upsert a stat

```sql
INSERT OR REPLACE INTO daily_stats (date, source, stat_type, value)
VALUES (?, ?, ?, ?)
```

### Count API calls this month

```sql
SELECT COUNT(*) FROM api_calls_log
WHERE month_year = ?
```

### Get top track deltas

```sql
-- Latest tracks
SELECT * FROM top_tracks
WHERE date = (SELECT MAX(date) FROM top_tracks WHERE source = ?)
AND source = ?
ORDER BY rank

-- Previous day tracks (for delta calculation)
SELECT * FROM top_tracks
WHERE date = (SELECT MAX(date) FROM top_tracks WHERE source = ? AND date < ?)
AND source = ?
ORDER BY rank
```

The delta is computed in Rust by matching track titles between the two dates and subtracting stream counts.

---

## Data Lifecycle

1. **First launch**: `fetchHistoricStats()` backfills ~90 days of daily data (1 API call per platform).
2. **Daily update**: `fetchAllStats()` fetches current stats (1 API call per platform) and upserts into `daily_stats`.
3. **Daily top content**: `fetchAndCacheTopContent()` caches top tracks (6 platforms) and curators (TikTok only).
4. **Weekly track stats**: `fetchAndCacheTrackStats()` fetches per-track data for TikTok and YouTube top tracks.
5. **Reads**: Dashboard and detail views query cached data from SQLite. No API calls are made for rendering.
