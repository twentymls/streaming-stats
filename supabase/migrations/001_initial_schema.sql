-- Supabase schema for Streaming Stats cloud sync
-- Run this in the Supabase SQL editor after creating your project

-- daily_stats
CREATE TABLE daily_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, source, stat_type)
);

-- top_tracks
CREATE TABLE top_tracks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  streams BIGINT NOT NULL DEFAULT 0,
  artwork_url TEXT,
  songstats_track_id TEXT,
  songstats_url TEXT,
  UNIQUE(user_id, date, source, rank)
);

-- top_curators
CREATE TABLE top_curators (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  rank INTEGER NOT NULL,
  curator_name TEXT NOT NULL,
  followers_total TEXT,
  image_url TEXT,
  external_url TEXT,
  UNIQUE(user_id, date, source, rank)
);

-- track_stats
CREATE TABLE track_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  songstats_track_id TEXT NOT NULL,
  source TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  UNIQUE(user_id, date, songstats_track_id, source, stat_type)
);

-- user_settings
CREATE TABLE user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  artist_name TEXT,
  spotify_artist_id TEXT,
  rapidapi_key TEXT,
  enabled_sources TEXT[] NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX idx_top_tracks_user_date ON top_tracks(user_id, date, source);
CREATE INDEX idx_top_curators_user_date ON top_curators(user_id, date, source);
CREATE INDEX idx_track_stats_user_id_source ON track_stats(user_id, songstats_track_id, source);

-- Table grants for authenticated role
GRANT ALL ON daily_stats TO authenticated;
GRANT ALL ON top_tracks TO authenticated;
GRANT ALL ON top_curators TO authenticated;
GRANT ALL ON track_stats TO authenticated;
GRANT ALL ON user_settings TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Row Level Security
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON daily_stats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE top_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON top_tracks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE top_curators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON top_curators FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE track_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON track_stats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_data" ON user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
