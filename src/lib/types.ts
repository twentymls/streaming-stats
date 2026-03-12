export interface AppSettings {
  api_key: string;
  spotify_artist_id: string;
  artist_name?: string;
  enabled_sources: string[];
  fetch_hour: number;
}

export interface DailyStat {
  id?: number;
  date: string;
  source: string;
  stat_type: string;
  value: number;
}

export interface ArtistInfo {
  songstats_artist_id: string;
  name: string;
  avatar_url: string;
  sources: Record<string, string>;
}

export interface PlatformStats {
  source: string;
  stats: Record<string, number>;
}

export interface ApiCallLog {
  endpoint: string;
  source: string;
  status_code: number;
  month_year: string;
}

export interface TopTrack {
  title: string;
  streams: number;
  artwork_url?: string;
}
