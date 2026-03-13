export const DSP_COLORS: Record<string, string> = {
  spotify: "#1DB954",
  apple_music: "#FC3C44",
  youtube: "#FF0000",
  tiktok: "#010101",
  deezer: "#A238FF",
  amazon: "#00A8E1",
  shazam: "#0088FF",
  soundcloud: "#FF5500",
};

/** Chart-safe colors — overrides TikTok's #010101 which is invisible on dark backgrounds */
export const DSP_CHART_COLORS: Record<string, string> = {
  ...DSP_COLORS,
  tiktok: "#69C9D0",
};

export const DSP_NAMES: Record<string, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
  tiktok: "TikTok",
  deezer: "Deezer",
  amazon: "Amazon Music",
  shazam: "Shazam",
  soundcloud: "SoundCloud",
};

export const DSP_STAT_LABELS: Record<string, string> = {
  // Core play counts
  streams: "Streams",
  views: "Views",
  plays: "Plays",
  creates: "Creations",
  shazams: "Shazam",

  // Followers & audience
  followers: "Followers",
  monthly_listeners: "Monthly Listeners",
  monthly_audience: "Monthly Audience",
  popularity: "Popularity",

  // Playlists
  playlist_reach: "Playlist Reach",
  playlist_reach_total: "Playlist Reach (All Time)",
  playlist_count: "Playlists",
  playlists_total: "Playlists (All Time)",
  editorial_playlists: "Editorial Playlists",
  editorial_playlists_total: "Editorial Playlists (All Time)",

  // Charts
  chart_entries: "Chart Entries",
  current_charts: "Current Charts",
  charted_tracks: "Charted Tracks",
  charted_tracks_total: "Charted Tracks (All Time)",
  charted_cities: "Charted Cities",
  charted_countries: "Charted Countries",

  // Engagement
  likes: "Likes",
  video_comments: "Video Comments",
  short_likes: "Short Likes",
  short_comments: "Short Comments",
  comments: "Comments",
  shares: "Shares",
  reposts: "Reposts",
  favorites: "Favorites",
  engagement_rate: "Engagement Rate",
  video_engagement: "Video Engagement Rate",
  short_engagement: "Short Engagement Rate",

  // YouTube-specific
  videos: "Videos",
  shorts: "Shorts",
  channel_views: "Channel Views",
  short_views: "Short Views",
  creator_reach: "Creator Reach",

  // TikTok-specific
  profile_likes: "Profile Likes",
  profile_videos: "Profile Videos",
};

export const DEFAULT_SOURCES = [
  "spotify",
  "apple_music",
  "youtube",
  "tiktok",
  "deezer",
  "amazon",
  "shazam",
  "soundcloud",
];

export const CHART_THEME = {
  gridColor: "#1e2230",
  tickColor: "#6b7280",
  legendColor: "#9ba1b0",
  tooltipBg: "#232738",
  tooltipBorder: "#3a4058",
  tooltipText: "#eaedf3",
} as const;

export const RAPIDAPI_HOST = "songstats.p.rapidapi.com";
export const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;
