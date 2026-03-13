use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyStat {
    pub id: Option<i64>,
    pub date: String,
    pub source: String,
    pub stat_type: String,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopTrack {
    pub title: String,
    pub streams: i64,
    pub artwork_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TopTrackRow {
    pub source: String,
    pub title: String,
    pub streams: i64,
    pub artwork_url: Option<String>,
    pub rank: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopCurator {
    pub curator_name: String,
    pub followers_total: Option<String>,
    pub image_url: Option<String>,
    pub external_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TopCuratorRow {
    pub source: String,
    pub curator_name: String,
    pub followers_total: Option<String>,
    pub image_url: Option<String>,
    pub external_url: Option<String>,
    pub rank: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TitleDelta {
    pub title: String,
    pub delta: i64,
}
