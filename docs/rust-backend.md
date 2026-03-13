# Rust Backend

The Rust backend lives in `src-tauri/` and handles database operations, system tray, and app lifecycle.

## Module Overview

```
src-tauri/src/
  lib.rs       -- App setup: plugins, tray, DB pool, command registration
  main.rs      -- Entry point (hides Windows console)
  commands.rs  -- 16 Tauri IPC command handlers
  db.rs        -- SQLite pool creation and migrations
  models.rs    -- Serde serialization models
  error.rs     -- Error types
```

## App Initialization (`lib.rs`)

The `run()` function builds the Tauri app:

1. **Register plugins:**
   - `tauri-plugin-store` -- encrypted settings storage
   - `tauri-plugin-http` -- HTTP client (reqwest)
   - `tauri-plugin-shell` -- open external URLs
   - `tauri-plugin-log` (debug only) -- console logging

2. **Setup callback:**
   - Creates SQLite database at `{app_data}/streaming-stats.db`
   - Runs migrations (see db.rs)
   - Stores `DbPool` (= `tokio::sync::Mutex<SqlitePool>`) as managed state

3. **System tray:**
   - "Open Dashboard" -- focuses the main window
   - "Quit" -- exits the app

4. **Register commands:**
   All 16 commands registered via `tauri::generate_handler![]`.

## Commands (`commands.rs`)

Every command follows this pattern:

```rust
#[tauri::command]
async fn command_name(
    pool: tauri::State<'_, DbPool>,
    arg1: String,
    arg2: i64,
) -> Result<ReturnType, String> {
    let db = pool.lock().await;
    // Run query with sqlx
    // Return Result
}
```

### Read commands

| Command | SQL | Returns |
|---------|-----|---------|
| `get_latest_stats` | `SELECT * FROM daily_stats WHERE date = (SELECT MAX(date) FROM daily_stats)` | `Vec<DailyStat>` |
| `get_stats_range(startDate, endDate, source?)` | `SELECT * WHERE date >= ? AND date <= ? [AND source = ?]` | `Vec<DailyStat>` |
| `get_monthly_api_count` | `SELECT COUNT(*) FROM api_calls_log WHERE month_year = ?` | `i64` |
| `get_last_fetch_date` | `SELECT MAX(date) FROM daily_stats` | `Option<String>` |
| `get_latest_top_tracks(source)` | Latest date's top 5 tracks for source | `Vec<TopTrack>` |
| `get_latest_top_curators(source)` | Latest date's curators for source | `Vec<TopCurator>` |
| `get_top_track_deltas(source)` | Compares latest 2 dates' tracks | `HashMap<String, i64>` |
| `get_all_cached_top_tracks` | All sources' latest top tracks | `HashMap<String, Vec<TopTrack>>` |
| `get_all_cached_top_curators` | All sources' latest curators | `HashMap<String, Vec<TopCurator>>` |
| `get_latest_track_stats(trackId, source)` | Latest per-track stats | `Vec<TrackStat>` |
| `get_track_stats_last_fetch(source)` | `SELECT MAX(date) FROM track_stats WHERE source = ?` | `Option<String>` |

### Write commands

| Command | SQL | Notes |
|---------|-----|-------|
| `save_daily_stat(date, source, statType, value)` | `INSERT OR REPLACE INTO daily_stats` | Upsert on unique constraint |
| `save_top_tracks(date, source, tracks)` | Transaction: INSERT OR REPLACE x5 | Batch insert with rank |
| `save_top_curators(date, source, curators)` | Transaction: INSERT OR REPLACE x10 | Batch insert with rank |
| `log_api_call(endpoint, source, statusCode)` | `INSERT INTO api_calls_log` | Records month_year for counting |
| `save_track_stats(date, trackId, source, stats)` | Transaction: INSERT OR REPLACE per stat | Batch per-track stats |

### Track delta computation (`get_top_track_deltas`)

This command computes stream gains between the two most recent dates:

```rust
// 1. Get latest date's tracks
let latest = query("SELECT * FROM top_tracks WHERE date = MAX(date) AND source = ?");

// 2. Get previous date's tracks
let prev = query("SELECT * FROM top_tracks WHERE date = MAX(date WHERE date < latest) AND source = ?");

// 3. Build HashMap<title, latestStreams - prevStreams>
let mut deltas = HashMap::new();
for track in latest {
    if let Some(prev_track) = prev.iter().find(|t| t.title == track.title) {
        let delta = track.streams - prev_track.streams;
        if delta > 0 {
            deltas.insert(track.title, delta);
        }
    }
}
```

## Models (`models.rs`)

All models derive `Serialize` and `Deserialize` with `#[serde(rename_all = "camelCase")]` for JS naming.

```rust
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DailyStat {
    pub id: Option<i64>,
    pub date: String,
    pub source: String,
    pub stat_type: String,
    pub value: i64,
}
```

**DB layer structs** (e.g., `TopTrackRow`, `TopCuratorRow`) extend the public models with extra fields like `source` and `rank` that are needed for DB queries but not sent to the frontend.

## Database (`db.rs`)

### Pool creation

```rust
pub async fn create_pool(db_path: &str) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;
    run_migrations(&pool).await?;
    Ok(pool)
}
```

Single connection pool (SQLite doesn't benefit from multiple connections for writes).

### Migrations

All migrations are idempotent:
- `CREATE TABLE IF NOT EXISTS` for new tables
- `PRAGMA table_info()` check before `ALTER TABLE ADD COLUMN`
- Safe to run on every app startup

See [database.md](database.md) for full schema.

## Error Handling (`error.rs`)

```rust
#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
}

impl From<DbError> for String {
    fn from(err: DbError) -> String {
        err.to_string()
    }
}
```

Commands return `Result<T, String>`. The `From<DbError>` impl allows using `?` in command handlers, which converts sqlx errors to strings that Tauri serializes to the frontend as rejected promises.

## Dependencies (`Cargo.toml`)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.10.3 | App framework (with tray-icon feature) |
| `tauri-plugin-store` | 2.4.2 | Encrypted settings storage |
| `tauri-plugin-http` | 2.5.7 | HTTP client for API calls |
| `tauri-plugin-shell` | 2.3.5 | Open external URLs |
| `tauri-plugin-log` | 2 | Debug logging |
| `sqlx` | 0.8 | SQLite with tokio runtime |
| `tokio` | 1.50.0 | Async runtime (time, rt features) |
| `serde` | 1.0 | Serialization (derive feature) |
| `serde_json` | 1.0 | JSON parsing |
| `chrono` | 0.4 | Date formatting (serde feature) |
| `thiserror` | 2 | Error derive macros |
| `log` | 0.4 | Logging facade |
| `reqwest` | 0.12 | HTTP client (brotli, gzip, deflate) |
