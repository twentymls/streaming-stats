export const FIELD_MAP: Record<string, string> = {
  // Core play counts
  streams_total: "streams",
  views_total: "views",
  video_views_total: "views",
  plays_total: "plays",
  creates_total: "creates",
  shazams_total: "shazams",

  // Followers / subscribers
  followers_total: "followers",
  subscribers_total: "followers",

  // Audience metrics
  monthly_listeners_current: "monthly_listeners",
  monthly_listeners: "monthly_listeners",
  monthly_audience_current: "monthly_audience",
  monthly_audience: "monthly_audience",
  popularity_current: "popularity",

  // Playlists
  playlist_reach_current: "playlist_reach",
  playlist_reach: "playlist_reach",
  playlist_reach_total: "playlist_reach_total",
  playlists_current: "playlist_count",
  playlists_total: "playlists_total",
  playlists_editorial_current: "editorial_playlists",
  playlists_editorial_total: "editorial_playlists_total",

  // Charts
  charts_total: "chart_entries",
  charts_current: "current_charts",
  charted_tracks_current: "charted_tracks",
  charted_tracks_total: "charted_tracks_total",
  charted_cities_total: "charted_cities",
  charted_countries_total: "charted_countries",

  // Engagement
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

  // YouTube-specific
  videos_total: "videos",
  shorts_total: "shorts",
  channel_views_total: "channel_views",
  short_views_total: "short_views",
  creator_reach_total: "creator_reach",

  // TikTok-specific
  profile_likes_total: "profile_likes",
  profile_videos_total: "profile_videos",
};

export function mapStatFields(rawData: Record<string, number>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [apiField, value] of Object.entries(rawData)) {
    const statType = FIELD_MAP[apiField];
    if (statType) {
      // When multiple API fields map to the same stat type (e.g. views_total
      // and video_views_total both -> "views"), take the max to avoid
      // inconsistent cumulative values that cause spikes in rolling averages.
      stats[statType] = stats[statType] != null ? Math.max(stats[statType], value) : value;
    }
  }
  return stats;
}
