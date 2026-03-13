use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
pub type DbPool = tokio::sync::Mutex<SqlitePool>;

/// Represents one row of PRAGMA table_info() output.
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct ColumnInfo {
    cid: i64,
    name: String,
    r#type: String,
    notnull: i64,
    dflt_value: Option<String>,
    pk: i64,
}

pub async fn create_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
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

async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS daily_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            source TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            value INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(date, source, stat_type)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS api_calls_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint TEXT NOT NULL,
            source TEXT,
            status_code INTEGER,
            called_at TEXT DEFAULT (datetime('now')),
            month_year TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_daily_stats_source ON daily_stats(source)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_api_calls_month ON api_calls_log(month_year)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS top_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            source TEXT NOT NULL,
            rank INTEGER NOT NULL,
            title TEXT NOT NULL,
            streams INTEGER NOT NULL DEFAULT 0,
            artwork_url TEXT,
            UNIQUE(date, source, rank)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS top_curators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            source TEXT NOT NULL,
            rank INTEGER NOT NULL,
            curator_name TEXT NOT NULL,
            followers_total TEXT,
            image_url TEXT,
            external_url TEXT,
            UNIQUE(date, source, rank)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_top_tracks_date_source ON top_tracks(date, source)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_top_curators_date_source ON top_curators(date, source)",
    )
    .execute(pool)
    .await?;

    // Add songstats_track_id and songstats_url columns to top_tracks if they don't exist
    let columns: Vec<ColumnInfo> = sqlx::query_as("PRAGMA table_info(top_tracks)")
        .fetch_all(pool)
        .await?;
    let col_names: Vec<&str> = columns.iter().map(|c| c.name.as_str()).collect();

    if !col_names.contains(&"songstats_track_id") {
        sqlx::query("ALTER TABLE top_tracks ADD COLUMN songstats_track_id TEXT")
            .execute(pool)
            .await?;
    }
    if !col_names.contains(&"songstats_url") {
        sqlx::query("ALTER TABLE top_tracks ADD COLUMN songstats_url TEXT")
            .execute(pool)
            .await?;
    }

    // Per-track stats table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS track_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            songstats_track_id TEXT NOT NULL,
            source TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            value REAL NOT NULL DEFAULT 0,
            UNIQUE(date, songstats_track_id, source, stat_type)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_track_stats_id_source ON track_stats(songstats_track_id, source)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn create_pool_and_run_migrations() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let pool = create_pool(&db_path).await.unwrap();

        // Verify tables exist by querying them
        let result: Vec<DailyStatCheck> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        let table_names: Vec<&str> = result.iter().map(|r| r.name.as_str()).collect();
        assert!(table_names.contains(&"daily_stats"));
        assert!(table_names.contains(&"api_calls_log"));
        assert!(table_names.contains(&"top_tracks"));
        assert!(table_names.contains(&"top_curators"));
        assert!(table_names.contains(&"track_stats"));
    }

    #[tokio::test]
    async fn migrations_are_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let pool = create_pool(&db_path).await.unwrap();
        pool.close().await;

        // Run migrations again — should not error
        let pool2 = create_pool(&db_path).await.unwrap();

        let result: Vec<DailyStatCheck> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool2)
                .await
                .unwrap();

        let table_names: Vec<&str> = result.iter().map(|r| r.name.as_str()).collect();
        assert!(table_names.contains(&"daily_stats"));
    }

    #[derive(sqlx::FromRow)]
    struct DailyStatCheck {
        name: String,
    }
}
