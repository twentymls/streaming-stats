# Data Flow

This document traces how data moves through the app, from external API to screen.

## Overview

```
Songstats API  -->  songstats-api.ts  -->  database.ts (invoke)  -->  Rust commands  -->  SQLite
                                                                                            |
Screen  <--  React components  <--  Dashboard state  <--  database.ts (invoke)  <--  Rust commands
```

## 1. Fetching Data

### Daily stats flow

```
fetchAllStats(api_key, artist_id, sources)
  for each source in sources:
    getArtistStats(api_key, artist_id, source)
      apiGet("/artists/stats", { spotify_artist_id, source })
        -> HTTP GET via @tauri-apps/plugin-http
        -> 3 retry on 429, 1.5s delay
        -> logApiCall(endpoint, source, statusCode)
      mapStatFields(response.data.stats)
        -> Normalize 60+ API field names to ~40 app stat types
        -> Take max value when multiple fields map to same type
      for each (statType, value) in mapped stats:
        saveDailyStat(today, source, statType, value)
          -> invoke("save_daily_stat", { date, source, statType, value })
          -> INSERT OR REPLACE INTO daily_stats
    sleep(1200ms)  // Rate limit between platforms
```

### Historic backfill flow

```
fetchHistoricStats(api_key, artist_id, sources, days=90)
  for each source in sources:
    apiGet("/artists/historic_stats", { spotify_artist_id, source, start_date })
    for each statType in response.data.stats:
      for each { date, value } in statType.data:
        saveDailyStat(date, source, statType, value)
    sleep(1200ms)
```

### Top content flow

```
fetchAndCacheTopContent(api_key, artist_id, trackSources, curatorSources)
  for each source in trackSources:   // [spotify, tiktok, youtube, apple_music, shazam, soundcloud]
    fetchTopTracks(api_key, artist_id, source)
      apiGet("/artists/top_tracks", { ..., limit: 5, metric: TOP_TRACKS_METRIC[source] })
      saveTopTracks(today, source, tracks)
        -> invoke("save_top_tracks", { date, source, tracks })
        -> BEGIN TRANSACTION
        -> INSERT OR REPLACE INTO top_tracks (x5)
        -> COMMIT
    sleep(1200ms)
  for each source in curatorSources:  // [tiktok]
    fetchTopCurators(api_key, artist_id, source)
      apiGet("/artists/top_curators", { ..., scope: "total" })
      saveTopCurators(today, source, curators)
    sleep(1200ms)
```

## 2. Loading Data

### Dashboard initial load

```
Dashboard.loadData()
  loadSettings() -> encrypted store -> setSettings()
  getLatestStats()
    -> invoke("get_latest_stats")
    -> SELECT * FROM daily_stats WHERE date = MAX(date)
    -> Group into Map<source, Record<statType, value>>
    -> setLatestStats()
  getStatsRange(90daysAgo, today)
    -> invoke("get_stats_range", { startDate, endDate })
    -> SELECT * FROM daily_stats WHERE date >= ? AND date <= ?
    -> setHistoricStats()
  getMonthlyApiCount()
    -> invoke("get_monthly_api_count")
    -> SELECT COUNT(*) FROM api_calls_log WHERE month_year = ?
    -> setApiCount()
  getAllCachedTopTracks()
    -> invoke("get_all_cached_top_tracks")
    -> For each source: SELECT top 5 from max date
    -> setCachedTopTracks()
  getAllCachedTopCurators() -> setCachedTopCurators()
  getTopTrackDeltas("tiktok"), getTopTrackDeltas("youtube")
    -> Compare latest 2 dates' tracks, compute stream differences
    -> setTopTrackDeltas()
  For each track with songstats_track_id:
    getLatestTrackStats(trackId, source) -> setTrackStats()
```

## 3. Computing Chart Data

All chart computations happen in the frontend via `useMemo`. No additional API or DB calls.

### Dashboard charts pipeline

```
historicStats (90 days, all platforms, all stat types)
  |
  v
dashboardHistoric = filter by period (7/30/60/90 days)
  |
  v
computeAllPlatformDeltas(dashboardHistoric, smoothed)
  |
  +-- For each platform:
  |     1. Filter stats by source
  |     2. Look up play-count stat type (PLAY_COUNT_STAT map)
  |     3. If smoothed: computeRollingAverageDeltas(stats, statType, window=14)
  |        If raw:      computeDailyDeltas(stats, statType)
  |
  +-- Merge all platforms' deltas by date
  |     -> dailyPoints: [{ date, deltas: { spotify: N, youtube: M, ... }, total }]
  |
  +-- Aggregate per-platform totals
  |     -> platformSummaries: [{ source, totalGrowth, avgDailyGrowth, sharePercent }]
  |
  +-- Compute aggregate KPIs
       -> aggregateStats: { todayTotal, avgDailyTotal, bestDay, topPlatform }
```

### KPI platform deltas (Spotify/YouTube cards)

```
dashboardHistoric
  |
  v
For source in [spotify, youtube]:
  filter stats by source
  computeRollingAverageDeltas(stats, PLAY_COUNT_STAT[source], window=14)
  take last value -> kpiPlatformDeltas[source]
```

These always use rolling averages (14-day window) regardless of the smooth toggle, because raw daily deltas from Songstats are unreliable due to uneven cumulative reporting.

### Platform detail charts

```
historicStats.filter(s => s.source === selectedPlatform)
  |
  +-- TrendChart: plots cumulative values directly (no delta computation)
  |
  +-- DailyDeltasChart: computeRollingAverageDeltas(stats, playCountKey, window=14)
```

## 4. Delta Computation Logic

### Raw deltas (`computeDailyDeltas`)

For a given stat type, sorts by date, then:
```
delta[i] = max(0, cumulative[i] - cumulative[i-1])
```
Negative deltas are clamped to 0 (can happen with stat corrections).

### Rolling average (`computeRollingAverageDeltas`)

For each data point, finds the earliest point within the window:
```
dailyAvg = max(0, (cumulative[i] - cumulative[windowStart]) / daysBetween)
```

This smooths out SongStats' uneven reporting. For example, if SongStats reports +3K for 6 days then +82K on day 7 (a bulk catch-up), the raw delta shows misleading spikes. The rolling average spreads this evenly (~12.5K/day).

## 5. Auto-Fetch Decision Tree

```
On Dashboard mount:
  1. Load settings
  2. Check getAutoFetchState()
     -> { lastFetchIso, fetchCountToday }
  3. Is it a new day? (lastFetchIso date != today)
     -> Yes: should fetch
  4. Have we fetched today? (fetchCountToday < 1)
     -> No: should fetch
  5. If should fetch:
     a. Is this first launch? (no data in DB)
        -> Yes: fetch artist info + backfill historic
     b. fetchAllStats()
     c. If first fetch of day: fetchAndCacheTopContent()
     d. If weekly interval elapsed: fetchAndCacheTrackStats()
     e. recordFetch() -> store timestamp + increment counter
     f. loadData() -> refresh UI
```
