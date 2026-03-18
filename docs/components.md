# Frontend Components

All components are React 19 function components located in `src/components/`.

---

## App (`src/App.tsx`)

Root component. Routes between Setup and Dashboard based on whether an API key exists.

**Logic:**
1. On mount, checks `hasApiKey()` from the settings store.
2. If no key exists, renders `Setup`. After setup completes, switches to `Dashboard`.
3. If key exists, renders `Dashboard` directly.
4. `handleReset()` clears state and returns to setup.

---

## Setup (`src/components/Setup.tsx`)

Three-step onboarding wizard for first-time configuration.

### Step 1: API Key

- User pastes their RapidAPI key.
- `testApiKey()` validates by calling `/artists/info` with a known Spotify ID.
- Shows error if key is invalid or rate-limited.

### Step 2: Artist ID

- User enters a Spotify artist ID or full Spotify URL.
- The component extracts the ID from URLs like `https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg`.
- `getArtistInfo()` fetches the artist name and platform links.
- Displays artist name for confirmation.

### Step 3: Confirmation

- Shows artist name and lists all 8 supported platforms as toggleable checkboxes.
- All platforms enabled by default.
- `handleFinish()` saves settings to encrypted store.

---

## Dashboard (`src/components/Dashboard.tsx`)

Main view. Manages all app state, data loading, and auto-fetch logic.

### State

| State | Type | Purpose |
|-------|------|---------|
| `settings` | `AppSettings \| null` | Loaded settings (API key, artist ID, sources) |
| `latestStats` | `Map<string, Record<string, number>>` | Latest stats grouped by platform |
| `historicStats` | `DailyStat[]` | 90 days of historic data (always loaded in full) |
| `period` | `number` | Selected chart period: 7, 30, 60, or 90 days |
| `smoothed` | `boolean` | Whether charts use rolling average |
| `loading` | `boolean` | Fetch in progress |
| `initialLoading` | `boolean` | First-time auto-fetch overlay |
| `fetchesToday` | `number` | Number of fetches today (max 10) |
| `selectedPlatform` | `string \| null` | Currently selected platform for detail view |
| `cachedTopTracks` | `Map<string, TopTrack[]>` | Cached top tracks by source |
| `cachedTopCurators` | `Map<string, TopCurator[]>` | Cached top curators by source |
| `topTrackDeltas` | `Map<string, Map<string, number>>` | Daily track stream gains |
| `trackStats` | `Map<string, Record<string, number>>` | Per-track statistics |

### Auto-fetch logic

On mount, the dashboard checks whether to auto-fetch:
- **First launch**: Always fetches. Also backfills 90 days of historic data and fetches artist info.
- **New day**: Fetches if no fetch has been recorded today.
- **Limit**: Max 1 auto-fetch per day. Manual "Update" button allows up to 10 total.

### Derived data (useMemo)

- `dashboardHistoric` -- `historicStats` filtered to the selected `period`.
- `chartData` -- `computeAllPlatformDeltas(dashboardHistoric, smoothed)` returns daily points, platform summaries, and aggregate KPIs.
- `kpiPlatformDeltas` -- Rolling-average daily values for Spotify and YouTube (14-day window), used for KPI cards.

### Rendering

When `selectedPlatform` is set, renders `PlatformDetail`. When `showSettings` is true, renders `Settings`. Otherwise renders the main dashboard:

1. **Header**: Artist name, last update date, API counter, Update button, Settings button.
2. **Platform cards grid**: One `PlatformCard` per enabled source. Empty cards for sources without data.
3. **Charts section** (if data exists):
   - Period selector (7d / 30d / 60d / 90d)
   - Smooth toggle checkbox
   - `KpiRow` -- 6 aggregate KPI cards
   - `DailyGrowthChart` -- stacked bar chart
   - `GrowthShare` -- platform share bars

---

## PlatformCard (`src/components/PlatformCard.tsx`)

Compact card showing a single platform's key stats. Clickable to navigate to detail view.

**Display:**
- Platform name with colored dot and left border.
- Main stat: chosen from `getPlayCountStat()` (streams for Spotify, views for YouTube, etc.).
- Up to 3 sub-stats: remaining stats excluding the main one.

**Props:**
- `source` -- platform key
- `stats` -- `Record<string, number>` of current stats
- `onClick` -- navigation callback

---

## PlatformDetail (`src/components/PlatformDetail.tsx`)

Full drilldown view for a single platform.

**Sections:**
1. **Hero stat**: Large formatted number (e.g., "16.2M") with stat label. Yesterday delta badge if available.
2. **Stats grid**: All stats for the platform in a responsive card grid. Each card shows a value and label. Yesterday delta badges on each.
3. **Top tracks list** (if cached): Rank, artwork, title, stream count, Songstats link. Per-track stat badges (if available). Daily stream delta (if TikTok/YouTube).
4. **Top curators list** (TikTok only): Curator name, follower count, profile link.
5. **Trend chart**: Line chart of the platform's primary stat over the selected period. Falls back through stat types if preferred one isn't available.
6. **Daily deltas chart**: Rolling-average line chart (14-day window) showing smoothed daily growth.

**Period selector**: Same 7/30/60/90 day options as dashboard. Filters historic data locally (no new API calls).

---

## KpiRow (`src/components/KpiRow.tsx`)

Six KPI cards in a 3-column grid.

| Card | Value | Styling |
|------|-------|---------|
| Today's Growth | Aggregate delta from last day | Green if positive, red if negative |
| Spotify Streams/day | 14-day rolling average | Spotify green color |
| YouTube Views/day | 14-day rolling average | YouTube red color |
| Avg Daily Growth | Grand total / number of days | Default text color |
| Best Day | Highest single-day total + date | Default text color |
| Top Platform | Platform name + share percentage | Platform brand color |

**Props:**
- `stats` -- `AggregateStats` object
- `platformDeltas` -- optional `Record<string, number>` with rolling-average values per platform

---

## DailyGrowthChart (`src/components/DailyGrowthChart.tsx`)

Stacked bar chart showing daily growth broken down by platform.

**Features:**
- One bar per day, segmented by platform.
- Each segment colored with `DSP_CHART_COLORS` (TikTok uses teal `#69C9D0` instead of invisible `#010101`).
- Tooltip shows each platform's value and a footer with the total.
- Responsive with `maintainAspectRatio: false`.

**Props:**
- `dailyPoints` -- array of `{ date, deltas: Record<string, number>, total }`.

**Empty state:** Shows "No growth data available" text.

---

## GrowthShare (`src/components/GrowthShare.tsx`)

Horizontal bar leaderboard showing each platform's share of total growth.

**Each row displays:**
- Platform name (in brand color)
- Horizontal bar (width proportional to share)
- Share percentage (e.g., "58.2%")
- Average daily growth (e.g., "+27.5K/day")

**Props:**
- `summaries` -- `PlatformSummary[]` sorted by total growth
- `onPlatformClick` -- callback to navigate to platform detail

**Empty state:** Shows "No growth data available".

---

## StatsChart (`src/components/StatsChart.tsx`)

Line chart for trend visualization. Used in `PlatformDetail` for both cumulative stats and daily deltas.

**Exports:**
- `TrendChart` -- multi-series line chart.

**Features:**
- Groups data by source, plots each as a separate line.
- Dates formatted as MM-DD on x-axis.
- Dark theme grid and label colors.
- Tension 0.3 for smooth curves, point radius 2.

**Props:**
- `stats` -- `DailyStat[]`
- `title` -- chart heading
- `statType` -- which stat to plot

---

## Settings (`src/components/Settings.tsx`)

Configuration page accessible from the dashboard header.

**Sections:**
1. **API Key**: Editable text field (masked).
2. **Spotify Artist ID**: Editable text field.
3. **Enabled Platforms**: Grid of 8 checkboxes to toggle which platforms are fetched.
4. **API Usage**: Progress bar showing current month's usage (X/500).
5. **Cloud Sync** (shown when Supabase is configured): Sign in/sign up form, or (when signed in) email display + "Sync all history" button + sign out. Errors from sync are displayed inline.
6. **Actions**: Save and Cancel buttons.
7. **Danger Zone**: Full Reset button (returns to Setup, clears all data).

---

## LoginPage (`src/components/LoginPage.tsx`)

PWA-only email/password login page. Used by `PwaApp` as the auth gate.

**Features:**
- Toggle between Sign In and Sign Up modes.
- Uses `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`.
- Error messages displayed inline.
- Styled with existing `.setup-page`, `.setup-card` CSS classes.

**Props:**
- `onAuth` -- callback when authentication succeeds (receives `User` object)

---

## PwaApp (`src/PwaApp.tsx`)

PWA root component. Replaces `App` in the PWA build.

**Logic:**
1. On mount, checks Supabase session via `supabase.auth.getSession()`.
2. If no session, renders `LoginPage`.
3. If authenticated, renders `Dashboard` with `readOnly` prop.
4. Listens for `onAuthStateChange` to handle sign-out.

---

## Dashboard `readOnly` mode

When `readOnly` is true (PWA):
- Auto-fetch `useEffect` is skipped entirely.
- Header hides: API usage badge, fetch status/countdown, Settings button, Update button.
- Header shows: "Synced: {date}" with last update timestamp.
- All chart/card/KPI rendering works identically to the desktop version.
