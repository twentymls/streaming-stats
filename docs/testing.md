# Testing Guide

## Test Stack

- **Frontend**: Vitest + @testing-library/react + jsdom
- **Backend**: Rust's built-in test framework + tokio + tempfile

## Running Tests

```bash
# Frontend (all tests, single run)
npm test

# Frontend (watch mode, re-runs on file changes)
npm run test:watch

# Backend (Rust tests)
export PATH="$HOME/.cargo/bin:$PATH"
cd src-tauri && cargo test
```

## Frontend Test Setup

### Mock configuration (`src/test/setup.ts`)

Tauri plugins and cloud dependencies don't work outside the Tauri runtime. The test setup mocks them:

```typescript
// @tauri-apps/plugin-store -> in-memory Map
vi.mock("@tauri-apps/plugin-store", () => { /* ... */ });

// @tauri-apps/api/core -> invoke() returns empty array
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));

// @tauri-apps/plugin-http -> fetch() returns 200 OK
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" })) }));

// @tauri-apps/plugin-shell -> open() is no-op
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn(async () => {}) }));

// @supabase/supabase-js -> null client
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => null) }));

// ../lib/sync -> no-op sync functions (prevents real Supabase calls)
vi.mock("../lib/sync", () => ({
  syncToSupabase: vi.fn(async () => {}),
  syncAllHistory: vi.fn(async () => null),
  syncSettings: vi.fn(async () => {}),
}));
```

Tests that need to test the real sync module (e.g., `sync.test.ts`) use `vi.unmock()` to opt out of the global mock.

### Vitest configuration (`vitest.config.ts`)

- `globals: true` -- `describe`, `it`, `expect`, `vi` available without imports.
- `environment: "jsdom"` -- DOM simulation for component rendering.
- `setupFiles: ["./src/test/setup.ts"]` -- Plugin mocks loaded before every test.
- `css: false` -- CSS not processed in tests.

## Test Files & Coverage

### Library tests

| File | Tests | What's covered |
|------|-------|---------------|
| `src/lib/utils.test.ts` | 42 | `formatNumber` (K/M suffixes), `getHeroStat` (priority fallback), `getPlayCountStat` (per-platform selection), `computeDailyDeltas` (cumulative-to-delta, clamping, sorting), `computeRollingAverageDeltas` (smoothing, window, edge cases), `computeYesterdayDelta` (latest pair, null cases), `computeAllPlatformDeltas` (multi-platform aggregation, summaries, share %, best day, smoothing, unknown platforms) |
| `src/lib/constants.test.ts` | 5 | All 8 platforms have colors, names, and stat labels. `DEFAULT_SOURCES` completeness. |
| `src/lib/database.test.ts` | 19 | All `invoke()` wrapper functions called with correct command names and argument shapes. |
| `src/lib/settings.test.ts` | 11 | `loadSettings`, `saveSettings`, `hasApiKey`, `getAutoFetchState` (date reset logic), `recordFetch` (counter increment). |
| `src/lib/songstats-api.test.ts` | 17 | `mapStatFields` (all 60+ field mappings), `testApiKey` (valid/invalid/rate-limited), retry on 429. |
| `src/lib/songstats-fields.test.ts` | 8 | `FIELD_MAP` completeness, `mapStatFields` normalization, max-value dedup, empty input. |
| `src/lib/sync.test.ts` | 4 | `syncToSupabase` daily push, `syncAllHistory` bulk sync with batching, error collection, `syncSettings` upsert. |
| `src/lib/database-web.test.ts` | 7 | All Supabase-backed database functions: query construction, user_id filtering, write no-ops. |
| `src/lib/settings-web.test.ts` | 6 | `loadSettings` from Supabase, `hasApiKey` session check, `getScheduledFetchInfo` always-no-fetch, write stubs. |

### Component tests

| File | Tests | What's covered |
|------|-------|---------------|
| `src/components/Dashboard.test.tsx` | 2 | Loading overlay during auto-fetch, no overlay when fetch not needed. |
| `src/components/PlatformCard.test.tsx` | 6 | Main stat detection (streams/views), sub-stat limit (max 3), onClick handler, unknown source fallback. |
| `src/components/PlatformDetail.test.tsx` | 13 | Hero stat rendering, yesterday delta badges, top tracks list (artwork, links, stat badges), curators, trend chart, daily deltas chart, period selector. |
| `src/components/KpiRow.test.tsx` | 10 | All 6 KPI cards render, positive/negative styling, platform deltas (Spotify/YouTube), zero values, missing deltas. |
| `src/components/DailyGrowthChart.test.tsx` | 3 | Chart renders with data, empty state, dataset structure passed to Chart.js. |
| `src/components/GrowthShare.test.tsx` | 6 | Platform rows render, percentages, daily averages, click handler, empty state, heading. |
| `src/components/LoginPage.test.tsx` | 3 | Renders login form, label-input association, sign in/sign up toggle. |
| `src/PwaApp.test.tsx` | 2 | Renders login when no session, renders dashboard when authenticated. |

### Component test patterns

**Mocking child components** -- Heavy components (charts, detail views) are mocked in parent tests:

```typescript
vi.mock("./DailyGrowthChart", () => ({
  DailyGrowthChart: () => <div data-testid="daily-growth-chart" />,
}));
```

**Mocking Chart.js** -- Chart.js doesn't work in jsdom. Tests mock `react-chartjs-2`:

```typescript
vi.mock("react-chartjs-2", () => ({
  Bar: (props) => <div data-testid="bar-chart" data-datasets={JSON.stringify(props.data)} />,
}));
```

**Mocking database layer** -- All `invoke()` calls are mocked to return appropriate empty values:

```typescript
vi.mock("../lib/database", () => ({
  getLatestStats: vi.fn(async () => []),
  getStatsRange: vi.fn(async () => []),
  // ...
}));
```

### Backend tests

| File | Tests | What's covered |
|------|-------|---------------|
| `src-tauri/src/commands.rs` | 14 | All 16 commands tested with real SQLite (tempfile). Upsert behavior, query filters, transaction integrity, delta calculations. |
| `src-tauri/src/db.rs` | 2 | Pool creation, migration execution, migration idempotency. |

Backend tests create temporary SQLite databases using the `tempfile` crate, so they test real SQL queries without touching the user's data.

## Writing New Tests

### For utility functions

Add tests to `src/lib/utils.test.ts`. Test pure input/output:

```typescript
it("computes correct delta", () => {
  const stats = [
    { date: "2025-01-01", source: "spotify", stat_type: "streams", value: 1000 },
    { date: "2025-01-02", source: "spotify", stat_type: "streams", value: 1200 },
  ];
  const result = computeDailyDeltas(stats, "streams");
  expect(result[0].value).toBe(200);
});
```

### For components

1. Mock heavy dependencies (Chart.js, database, API).
2. Use `@testing-library/react` for rendering and querying.
3. Test what the user sees, not implementation details.

```typescript
it("renders platform name", () => {
  render(<PlatformCard source="spotify" stats={{ streams: 1000 }} />);
  expect(screen.getByText("Spotify")).toBeInTheDocument();
});
```

### For Rust commands

Use `tempfile::NamedTempFile` for isolated databases:

```rust
#[tokio::test]
async fn test_save_and_get() {
  let tmp = tempfile::NamedTempFile::new().unwrap();
  let pool = create_pool(tmp.path().to_str().unwrap()).await.unwrap();
  // ... run command, assert result
}
```
