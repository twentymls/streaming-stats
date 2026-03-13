use std::collections::HashMap;

use sqlx::SqlitePool;
use tauri::State;

use crate::db::DbPool;
use crate::models::{DailyStat, TitleDelta, TopCurator, TopCuratorRow, TopTrack, TopTrackRow};

#[tauri::command(rename_all = "camelCase")]
pub async fn get_latest_stats(pool: State<'_, DbPool>) -> Result<Vec<DailyStat>, String> {
    let pool = pool.lock().await;
    query_latest_stats(&pool).await.map_err(|e| e.to_string())
}

async fn query_latest_stats(pool: &SqlitePool) -> Result<Vec<DailyStat>, sqlx::Error> {
    sqlx::query_as::<_, DailyStat>(
        "SELECT id, date, source, stat_type, value FROM daily_stats \
         WHERE date = (SELECT MAX(date) FROM daily_stats) \
         ORDER BY source, stat_type",
    )
    .fetch_all(pool)
    .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_stats_range(
    pool: State<'_, DbPool>,
    start_date: String,
    end_date: String,
    source: Option<String>,
) -> Result<Vec<DailyStat>, String> {
    let pool = pool.lock().await;
    query_stats_range(&pool, &start_date, &end_date, source.as_deref())
        .await
        .map_err(|e| e.to_string())
}

async fn query_stats_range(
    pool: &SqlitePool,
    start_date: &str,
    end_date: &str,
    source: Option<&str>,
) -> Result<Vec<DailyStat>, sqlx::Error> {
    match source {
        Some(src) => {
            sqlx::query_as::<_, DailyStat>(
                "SELECT id, date, source, stat_type, value FROM daily_stats \
                 WHERE date BETWEEN ? AND ? AND source = ? \
                 ORDER BY date, stat_type",
            )
            .bind(start_date)
            .bind(end_date)
            .bind(src)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, DailyStat>(
                "SELECT id, date, source, stat_type, value FROM daily_stats \
                 WHERE date BETWEEN ? AND ? \
                 ORDER BY date, source, stat_type",
            )
            .bind(start_date)
            .bind(end_date)
            .fetch_all(pool)
            .await
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_monthly_api_count(pool: State<'_, DbPool>) -> Result<i64, String> {
    let pool = pool.lock().await;
    query_monthly_api_count(&pool)
        .await
        .map_err(|e| e.to_string())
}

async fn query_monthly_api_count(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let month_year = chrono::Local::now().format("%Y-%m").to_string();
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM api_calls_log WHERE month_year = ?")
        .bind(&month_year)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_last_fetch_date(pool: State<'_, DbPool>) -> Result<Option<String>, String> {
    let pool = pool.lock().await;
    query_last_fetch_date(&pool)
        .await
        .map_err(|e| e.to_string())
}

async fn query_last_fetch_date(pool: &SqlitePool) -> Result<Option<String>, sqlx::Error> {
    let row: (Option<String>,) = sqlx::query_as("SELECT MAX(date) FROM daily_stats")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_latest_top_tracks(
    pool: State<'_, DbPool>,
    source: String,
) -> Result<Vec<TopTrack>, String> {
    let pool = pool.lock().await;
    query_latest_top_tracks(&pool, &source)
        .await
        .map_err(|e| e.to_string())
}

async fn query_latest_top_tracks(
    pool: &SqlitePool,
    source: &str,
) -> Result<Vec<TopTrack>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TopTrackRow>(
        "SELECT source, title, streams, artwork_url, rank FROM top_tracks \
         WHERE source = ? AND date = (SELECT MAX(date) FROM top_tracks WHERE source = ?) \
         ORDER BY rank ASC",
    )
    .bind(source)
    .bind(source)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| TopTrack {
            title: r.title,
            streams: r.streams,
            artwork_url: r.artwork_url,
        })
        .collect())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_latest_top_curators(
    pool: State<'_, DbPool>,
    source: String,
) -> Result<Vec<TopCurator>, String> {
    let pool = pool.lock().await;
    query_latest_top_curators(&pool, &source)
        .await
        .map_err(|e| e.to_string())
}

async fn query_latest_top_curators(
    pool: &SqlitePool,
    source: &str,
) -> Result<Vec<TopCurator>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TopCuratorRow>(
        "SELECT source, curator_name, followers_total, image_url, external_url, rank FROM top_curators \
         WHERE source = ? AND date = (SELECT MAX(date) FROM top_curators WHERE source = ?) \
         ORDER BY rank ASC",
    )
    .bind(source)
    .bind(source)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| TopCurator {
            curator_name: r.curator_name,
            followers_total: r.followers_total,
            image_url: r.image_url,
            external_url: r.external_url,
        })
        .collect())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_top_track_deltas(
    pool: State<'_, DbPool>,
    source: String,
) -> Result<HashMap<String, i64>, String> {
    let pool = pool.lock().await;
    query_top_track_deltas(&pool, &source)
        .await
        .map_err(|e| e.to_string())
}

async fn query_top_track_deltas(
    pool: &SqlitePool,
    source: &str,
) -> Result<HashMap<String, i64>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TitleDelta>(
        "SELECT t1.title, (t1.streams - t2.streams) as delta \
         FROM top_tracks t1 \
         JOIN top_tracks t2 ON t1.source = t2.source AND t1.title = t2.title \
         WHERE t1.source = ? \
           AND t1.date = (SELECT MAX(date) FROM top_tracks WHERE source = ?) \
           AND t2.date = (SELECT MAX(date) FROM top_tracks WHERE source = ? AND date < (SELECT MAX(date) FROM top_tracks WHERE source = ?)) \
           AND (t1.streams - t2.streams) > 0",
    )
    .bind(source)
    .bind(source)
    .bind(source)
    .bind(source)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| (r.title, r.delta)).collect())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_all_cached_top_tracks(
    pool: State<'_, DbPool>,
) -> Result<HashMap<String, Vec<TopTrack>>, String> {
    let pool = pool.lock().await;
    query_all_cached_top_tracks(&pool)
        .await
        .map_err(|e| e.to_string())
}

async fn query_all_cached_top_tracks(
    pool: &SqlitePool,
) -> Result<HashMap<String, Vec<TopTrack>>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TopTrackRow>(
        "SELECT t.source, t.title, t.streams, t.artwork_url, t.rank FROM top_tracks t \
         INNER JOIN (SELECT source, MAX(date) as max_date FROM top_tracks GROUP BY source) m \
         ON t.source = m.source AND t.date = m.max_date \
         ORDER BY t.source, t.rank",
    )
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<String, Vec<TopTrack>> = HashMap::new();
    for r in rows {
        map.entry(r.source).or_default().push(TopTrack {
            title: r.title,
            streams: r.streams,
            artwork_url: r.artwork_url,
        });
    }
    Ok(map)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_all_cached_top_curators(
    pool: State<'_, DbPool>,
) -> Result<HashMap<String, Vec<TopCurator>>, String> {
    let pool = pool.lock().await;
    query_all_cached_top_curators(&pool)
        .await
        .map_err(|e| e.to_string())
}

async fn query_all_cached_top_curators(
    pool: &SqlitePool,
) -> Result<HashMap<String, Vec<TopCurator>>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TopCuratorRow>(
        "SELECT t.source, t.curator_name, t.followers_total, t.image_url, t.external_url, t.rank FROM top_curators t \
         INNER JOIN (SELECT source, MAX(date) as max_date FROM top_curators GROUP BY source) m \
         ON t.source = m.source AND t.date = m.max_date \
         ORDER BY t.source, t.rank",
    )
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<String, Vec<TopCurator>> = HashMap::new();
    for r in rows {
        map.entry(r.source).or_default().push(TopCurator {
            curator_name: r.curator_name,
            followers_total: r.followers_total,
            image_url: r.image_url,
            external_url: r.external_url,
        });
    }
    Ok(map)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_daily_stat(
    pool: State<'_, DbPool>,
    date: String,
    source: String,
    stat_type: String,
    value: i64,
) -> Result<(), String> {
    let pool = pool.lock().await;
    query_save_daily_stat(&pool, &date, &source, &stat_type, value)
        .await
        .map_err(|e| e.to_string())
}

async fn query_save_daily_stat(
    pool: &SqlitePool,
    date: &str,
    source: &str,
    stat_type: &str,
    value: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO daily_stats (date, source, stat_type, value) VALUES (?, ?, ?, ?)",
    )
    .bind(date)
    .bind(source)
    .bind(stat_type)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn log_api_call(
    pool: State<'_, DbPool>,
    endpoint: String,
    source: String,
    status_code: i64,
) -> Result<(), String> {
    let pool = pool.lock().await;
    query_log_api_call(&pool, &endpoint, &source, status_code)
        .await
        .map_err(|e| e.to_string())
}

async fn query_log_api_call(
    pool: &SqlitePool,
    endpoint: &str,
    source: &str,
    status_code: i64,
) -> Result<(), sqlx::Error> {
    let month_year = chrono::Local::now().format("%Y-%m").to_string();
    sqlx::query(
        "INSERT INTO api_calls_log (endpoint, source, status_code, month_year) VALUES (?, ?, ?, ?)",
    )
    .bind(endpoint)
    .bind(source)
    .bind(status_code)
    .bind(&month_year)
    .execute(pool)
    .await?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_top_tracks(
    pool: State<'_, DbPool>,
    date: String,
    source: String,
    tracks: Vec<TopTrack>,
) -> Result<(), String> {
    let pool = pool.lock().await;
    query_save_top_tracks(&pool, &date, &source, &tracks)
        .await
        .map_err(|e| e.to_string())
}

async fn query_save_top_tracks(
    pool: &SqlitePool,
    date: &str,
    source: &str,
    tracks: &[TopTrack],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for (i, t) in tracks.iter().enumerate() {
        sqlx::query(
            "INSERT OR REPLACE INTO top_tracks (date, source, rank, title, streams, artwork_url) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(date)
        .bind(source)
        .bind((i + 1) as i64)
        .bind(&t.title)
        .bind(t.streams)
        .bind(&t.artwork_url)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_top_curators(
    pool: State<'_, DbPool>,
    date: String,
    source: String,
    curators: Vec<TopCurator>,
) -> Result<(), String> {
    let pool = pool.lock().await;
    query_save_top_curators(&pool, &date, &source, &curators)
        .await
        .map_err(|e| e.to_string())
}

async fn query_save_top_curators(
    pool: &SqlitePool,
    date: &str,
    source: &str,
    curators: &[TopCurator],
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for (i, c) in curators.iter().enumerate() {
        sqlx::query(
            "INSERT OR REPLACE INTO top_curators (date, source, rank, curator_name, followers_total, image_url, external_url) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(date)
        .bind(source)
        .bind((i + 1) as i64)
        .bind(&c.curator_name)
        .bind(&c.followers_total)
        .bind(&c.image_url)
        .bind(&c.external_url)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_pool;

    async fn test_pool() -> SqlitePool {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        // Leak the tempdir so it lives for the duration of the test
        std::mem::forget(dir);
        create_pool(&db_path).await.unwrap()
    }

    #[tokio::test]
    async fn test_save_and_get_latest_stats() {
        let pool = test_pool().await;
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 50000)
            .await
            .unwrap();
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "followers", 1000)
            .await
            .unwrap();

        let stats = query_latest_stats(&pool).await.unwrap();
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[0].source, "spotify");
        assert_eq!(stats[0].stat_type, "followers");
        assert_eq!(stats[0].value, 1000);
        assert_eq!(stats[1].stat_type, "streams");
        assert_eq!(stats[1].value, 50000);
    }

    #[tokio::test]
    async fn test_get_stats_range_no_source() {
        let pool = test_pool().await;
        query_save_daily_stat(&pool, "2025-01-10", "spotify", "streams", 100)
            .await
            .unwrap();
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 200)
            .await
            .unwrap();
        query_save_daily_stat(&pool, "2025-01-20", "spotify", "streams", 300)
            .await
            .unwrap();

        let stats = query_stats_range(&pool, "2025-01-10", "2025-01-15", None)
            .await
            .unwrap();
        assert_eq!(stats.len(), 2);
        assert_eq!(stats[0].value, 100);
        assert_eq!(stats[1].value, 200);
    }

    #[tokio::test]
    async fn test_get_stats_range_with_source() {
        let pool = test_pool().await;
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 100)
            .await
            .unwrap();
        query_save_daily_stat(&pool, "2025-01-15", "apple", "streams", 200)
            .await
            .unwrap();

        let stats = query_stats_range(&pool, "2025-01-01", "2025-01-31", Some("spotify"))
            .await
            .unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].source, "spotify");
    }

    #[tokio::test]
    async fn test_log_and_get_monthly_api_count() {
        let pool = test_pool().await;
        let month_year = chrono::Local::now().format("%Y-%m").to_string();

        // Insert directly with known month_year to test the count query
        sqlx::query("INSERT INTO api_calls_log (endpoint, source, status_code, month_year) VALUES (?, ?, ?, ?)")
            .bind("test_endpoint")
            .bind("spotify")
            .bind(200i64)
            .bind(&month_year)
            .execute(&pool)
            .await
            .unwrap();

        let count = query_monthly_api_count(&pool).await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn test_get_last_fetch_date() {
        let pool = test_pool().await;

        let date = query_last_fetch_date(&pool).await.unwrap();
        assert!(date.is_none());

        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 100)
            .await
            .unwrap();

        let date = query_last_fetch_date(&pool).await.unwrap();
        assert_eq!(date, Some("2025-01-15".to_string()));
    }

    #[tokio::test]
    async fn test_save_and_get_latest_top_tracks() {
        let pool = test_pool().await;
        let tracks = vec![
            TopTrack {
                title: "Song A".to_string(),
                streams: 1000,
                artwork_url: None,
            },
            TopTrack {
                title: "Song B".to_string(),
                streams: 500,
                artwork_url: Some("http://example.com/art.jpg".to_string()),
            },
        ];

        query_save_top_tracks(&pool, "2025-01-15", "spotify", &tracks)
            .await
            .unwrap();

        let result = query_latest_top_tracks(&pool, "spotify").await.unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].title, "Song A");
        assert_eq!(result[0].streams, 1000);
        assert!(result[0].artwork_url.is_none());
        assert_eq!(result[1].title, "Song B");
        assert_eq!(
            result[1].artwork_url,
            Some("http://example.com/art.jpg".to_string())
        );
    }

    #[tokio::test]
    async fn test_save_and_get_latest_top_curators() {
        let pool = test_pool().await;
        let curators = vec![TopCurator {
            curator_name: "Curator A".to_string(),
            followers_total: Some("10000".to_string()),
            image_url: None,
            external_url: Some("http://example.com".to_string()),
        }];

        query_save_top_curators(&pool, "2025-01-15", "spotify", &curators)
            .await
            .unwrap();

        let result = query_latest_top_curators(&pool, "spotify").await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].curator_name, "Curator A");
        assert_eq!(result[0].followers_total, Some("10000".to_string()));
        assert_eq!(
            result[0].external_url,
            Some("http://example.com".to_string())
        );
    }

    #[tokio::test]
    async fn test_get_top_track_deltas() {
        let pool = test_pool().await;

        let day1_tracks = vec![
            TopTrack {
                title: "Song A".to_string(),
                streams: 1000,
                artwork_url: None,
            },
            TopTrack {
                title: "Song B".to_string(),
                streams: 500,
                artwork_url: None,
            },
        ];
        query_save_top_tracks(&pool, "2025-01-14", "spotify", &day1_tracks)
            .await
            .unwrap();

        let day2_tracks = vec![
            TopTrack {
                title: "Song A".to_string(),
                streams: 1200,
                artwork_url: None,
            },
            TopTrack {
                title: "Song B".to_string(),
                streams: 500,
                artwork_url: None,
            },
        ];
        query_save_top_tracks(&pool, "2025-01-15", "spotify", &day2_tracks)
            .await
            .unwrap();

        let deltas = query_top_track_deltas(&pool, "spotify").await.unwrap();
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas.get("Song A"), Some(&200));
        // Song B has no delta (0 increase), so not included
        assert!(!deltas.contains_key("Song B"));
    }

    #[tokio::test]
    async fn test_get_all_cached_top_tracks() {
        let pool = test_pool().await;

        let spotify_tracks = vec![TopTrack {
            title: "Spotify Song".to_string(),
            streams: 1000,
            artwork_url: None,
        }];
        let apple_tracks = vec![TopTrack {
            title: "Apple Song".to_string(),
            streams: 2000,
            artwork_url: None,
        }];

        query_save_top_tracks(&pool, "2025-01-15", "spotify", &spotify_tracks)
            .await
            .unwrap();
        query_save_top_tracks(&pool, "2025-01-15", "apple_music", &apple_tracks)
            .await
            .unwrap();

        let all = query_all_cached_top_tracks(&pool).await.unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all["spotify"][0].title, "Spotify Song");
        assert_eq!(all["apple_music"][0].title, "Apple Song");
    }

    #[tokio::test]
    async fn test_get_all_cached_top_curators() {
        let pool = test_pool().await;

        let curators = vec![TopCurator {
            curator_name: "Test Curator".to_string(),
            followers_total: None,
            image_url: None,
            external_url: None,
        }];

        query_save_top_curators(&pool, "2025-01-15", "spotify", &curators)
            .await
            .unwrap();

        let all = query_all_cached_top_curators(&pool).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all["spotify"][0].curator_name, "Test Curator");
    }

    #[tokio::test]
    async fn test_save_daily_stat_upsert() {
        let pool = test_pool().await;
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 100)
            .await
            .unwrap();
        query_save_daily_stat(&pool, "2025-01-15", "spotify", "streams", 200)
            .await
            .unwrap();

        let stats = query_latest_stats(&pool).await.unwrap();
        assert_eq!(stats.len(), 1);
        assert_eq!(stats[0].value, 200);
    }

    #[tokio::test]
    async fn test_log_api_call() {
        let pool = test_pool().await;
        query_log_api_call(&pool, "/stats", "spotify", 200)
            .await
            .unwrap();

        let count = query_monthly_api_count(&pool).await.unwrap();
        assert_eq!(count, 1);
    }
}
