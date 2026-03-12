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
  streams: "Streams",
  views: "Views",
  creates: "Creations",
  shazams: "Shazam",
  followers: "Followers",
  playlist_reach: "Playlist Reach",
  playlist_count: "Playlist",
  chart_entries: "Chart Entries",
  likes: "Likes",
  plays: "Plays",
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

export const RAPIDAPI_HOST = "songstats.p.rapidapi.com";
export const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;
