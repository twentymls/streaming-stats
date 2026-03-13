# Utility Functions & Types

All utility functions live in `src/lib/utils.ts`. They handle data formatting, stat selection, and delta computation.

---

## Types

### DashboardChartData

Returned by `computeAllPlatformDeltas()`. Contains everything the dashboard charts need.

```typescript
interface DashboardChartData {
  dailyPoints: Array<{
    date: string;                      // ISO date
    deltas: Record<string, number>;    // Platform key -> daily delta value
    total: number;                     // Sum of all platform deltas for this date
  }>;
  platformSummaries: PlatformSummary[];
  aggregateStats: AggregateStats;
}
```

### PlatformSummary

Per-platform growth statistics over the selected period.

```typescript
interface PlatformSummary {
  source: string;          // Platform key (e.g., "spotify")
  totalGrowth: number;     // Sum of all deltas in the period
  avgDailyGrowth: number;  // totalGrowth / number of days
  sharePercent: number;    // This platform's % of grand total growth
}
```

### AggregateStats

Cross-platform aggregate KPIs.

```typescript
interface AggregateStats {
  todayTotal: number;                          // Total delta on the most recent day
  avgDailyTotal: number;                       // Grand total / number of days
  bestDay: { date: string; total: number };    // Highest single-day total
  topPlatform: { source: string; sharePercent: number };  // Platform with highest share
}
```

---

## Functions

### formatNumber(n: number): string

Formats a number for display:
- `< 1,000`: locale string (e.g., `"999"`)
- `>= 1,000`: K suffix (e.g., `"1.5K"`, `"999.0K"`)
- `>= 1,000,000`: M suffix (e.g., `"1.5M"`, `"10.0M"`)

Uses `it-IT` locale for numbers under 1000 (period as thousands separator).

---

### getHeroStat(source, stats): { key, value } | null

Returns the most important stat for a platform based on `HERO_STAT_PRIORITY`:

| Platform | Priority order |
|----------|---------------|
| spotify | monthly_listeners, streams, followers |
| youtube | views, followers |
| tiktok | views, creates, followers |
| shazam | shazams |
| soundcloud | plays, followers |
| apple_music | streams, playlist_reach |
| deezer | streams, followers |
| amazon | streams, followers |

Falls back to the first available stat if none from the priority list exist. Returns `null` for empty stats.

---

### getPlayCountStat(source, stats): { key, value } | null

Returns the primary play-count metric for a platform using `PLAY_COUNT_STAT`:

| Platform | Stat type |
|----------|-----------|
| spotify | streams |
| apple_music | streams |
| deezer | streams |
| amazon | streams |
| youtube | views |
| tiktok | views |
| soundcloud | plays |
| shazam | shazams |

Falls back through `["streams", "views", "plays", "creates", "shazams"]` for unknown platforms.

---

### computeDailyDeltas(stats, statType): DailyStat[]

Converts cumulative stat values into daily deltas.

**Algorithm:**
1. Filter stats to the specified `statType`.
2. Sort by date ascending.
3. For each consecutive pair: `delta = stats[i].value - stats[i-1].value`.
4. Clamp negative deltas to 0 (handles stat corrections/resets).

**Input:** Array of `DailyStat` (cumulative values).
**Output:** Array of `DailyStat` (daily changes). One fewer element than input.

---

### computeRollingAverageDeltas(stats, statType, windowDays = 14): DailyStat[]

Smooths daily deltas using a rolling window average. This is the primary computation used for display because Songstats reports cumulative totals unevenly (some days get bulk catch-ups that inflate raw deltas).

**Algorithm:**
1. Filter and sort by date.
2. For each data point, find the earliest point within `windowDays`.
3. `dailyAvg = (current.value - windowStart.value) / daysBetween`.
4. Clamp negative values to 0.

**Why 14-day window:** SongStats sometimes reports multiple days of growth in a single update. A 14-day window is wide enough to smooth these irregularities while still reflecting real trends.

**Example:**
- Raw deltas: 3K, 3K, 3K, 3K, 3K, 3K, 82K (bulk catch-up on day 7)
- Rolling average: ~12.5K, ~12.5K, ~12.5K, ... (consistent daily growth)

---

### computeYesterdayDelta(stats, statType): number | null

Returns the delta between the two most recent data points.

- Returns `null` if fewer than 2 data points exist.
- Returns `null` if the delta is zero or negative.
- Sorts by date descending and compares positions 0 and 1.

Used for "yesterday" delta badges in `PlatformDetail`.

---

### computeAllPlatformDeltas(stats, smoothed = false): DashboardChartData

The main aggregation function for dashboard charts. Computes daily growth across all platforms.

**Steps:**
1. Group stats by source.
2. For each platform with a `PLAY_COUNT_STAT` mapping:
   - Compute deltas (raw or rolling average based on `smoothed` flag).
3. Collect all unique dates across all platforms.
4. Build `dailyPoints`: for each date, aggregate per-platform deltas + total.
5. Build `platformSummaries`: total growth, avg daily, share % per platform. Sorted by total growth descending.
6. Build `aggregateStats`: today's total, average daily, best day, top platform.

**Platforms without a `PLAY_COUNT_STAT` mapping are ignored** (e.g., unknown/custom platforms).

---

## Constants

### HERO_STAT_PRIORITY

Maps each platform to an ordered list of preferred hero stats. Used by `getHeroStat()`.

### PLAY_COUNT_STAT

Maps each platform to its primary play-count metric. Used by `getPlayCountStat()`, `computeAllPlatformDeltas()`, and `PlatformDetail`.

```typescript
{
  spotify: "streams",
  apple_music: "streams",
  deezer: "streams",
  amazon: "streams",
  youtube: "views",
  tiktok: "views",
  soundcloud: "plays",
  shazam: "shazams",
}
```
