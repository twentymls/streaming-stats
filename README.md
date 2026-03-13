# Streaming Stats

A cross-platform app for desktop and mobile that tracks streaming stats for music artists across 8 platforms using the [Songstats API](https://rapidapi.com/songstats-app-songstats-app-default/api/songstats). Built with Tauri 2 (Rust + React). Runs on macOS, Windows, iOS, and Android.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="720" />
</p>

## Download

**[Download the latest release](https://github.com/petemiles/streaming-stats/releases/latest)**

### macOS

1. Download the `.dmg` file from the latest release
2. Open the DMG and drag **Streaming Stats** to your Applications folder
3. On first launch: right-click the app > **Open** (required for unsigned apps)

> Windows, iOS, and Android builds are coming soon.

## Supported Targets

| Platform | Status |
|----------|--------|
| macOS | Stable |
| Windows | Supported |
| iOS | Supported |
| Android | Supported |

## Supported Music Platforms

Spotify, Apple Music, YouTube, TikTok, Deezer, Amazon Music, Shazam, SoundCloud

## Screenshots

<details>
<summary><b>Dashboard</b> — KPI cards, daily growth chart, platform share breakdown</summary>
<br />
<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard view showing platform cards, KPI row, stacked bar chart, and growth share" width="720" />
</p>
</details>

<details>
<summary><b>Spotify Detail</b> — Monthly listeners, top tracks, trend charts</summary>
<br />
<p align="center">
  <img src="docs/screenshots/spotify-detail.png" alt="Spotify detail view with stats grid, top tracks, and monthly listeners chart" width="720" />
</p>
</details>

<details>
<summary><b>TikTok Detail</b> — Views, top tracks, top curators</summary>
<br />
<p align="center">
  <img src="docs/screenshots/tiktok-detail.png" alt="TikTok detail view with stats, top tracks by video count, and top curators" width="720" />
</p>
</details>

## How It Works

1. **Setup** — Enter your RapidAPI key and a Spotify artist ID/URL. The app validates both before proceeding.
2. **Daily tracking** — The app automatically fetches stats on launch (max 1x/day). All data is stored locally in a SQLite database.
3. **Dashboard** — View current stats per platform, KPI cards (daily growth, Spotify streams/day, YouTube views/day), a stacked bar chart of daily growth by platform, and a growth share breakdown. Filter by 7/30/60/90 day periods. Toggle smoothing for 7-day rolling averages.
4. **Platform detail** — Click any platform card to see full stats, top tracks with Songstats links, trend charts, and (for TikTok) top curators. All detail data is served from the local cache — no API calls on view.
5. **Backfill** — One-time download of up to 90 days of historical data from Songstats (Settings > Backfill historic data).

### Data & Privacy

All data is stored **locally on your machine**:
- Stats in a SQLite database (`streaming_stats.db`)
- Settings (API key, artist ID) in Tauri's encrypted store

No data is sent anywhere except the Songstats API calls to fetch stats.

### API Usage

The app uses the Songstats API via RapidAPI. The **BASIC plan** allows 500 requests/month. The daily update uses ~15 API calls (8 platform stats + 6 top tracks + 1 top curators). Per-track stats are refreshed weekly (~10 calls). Once-a-day updates keep monthly usage under 500 calls. Top tracks and curators are stored in the local DB during the daily fetch, so detail views read directly from the database without making API calls. A backfill uses ~8 calls. The dashboard shows your current monthly usage.

A 1.2 second delay is added between platform requests to stay within the per-second rate limit.

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri system dependencies — see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- A [RapidAPI](https://rapidapi.com/) account with a Songstats API subscription

**For Windows development:**
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (included in Windows 11; auto-installed on Windows 10 by the NSIS installer)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload

**For iOS development:**
- Xcode 15+
- CocoaPods: `sudo gem install cocoapods`
- Rust targets: `rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim`

**For Android development:**
- Android Studio with NDK v26+ (install via SDK Manager)
- Environment variables: `ANDROID_HOME`, `NDK_HOME`
- Rust targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`

### Install

```bash
git clone <repo-url>
cd streaming-stats
npm install
```

### Add Cargo to PATH (one-time)

Rust/Cargo is installed at `~/.cargo/bin` but isn't on the default shell PATH. Add it permanently:

```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

After this, all commands below work without the `export PATH` prefix.

### Run in dev mode

```bash
npx tauri dev
```

This starts the Vite dev server on `localhost:5173` and compiles the Rust backend. The app window opens automatically with hot-reload for frontend changes.

```bash
# iOS Simulator
npx tauri ios dev

# Android Emulator
npx tauri android dev
```

### Build for production

```bash
# Desktop (macOS)
npx tauri build --bundles app

# Desktop (Windows) — must be run on a Windows machine
npx tauri build --bundles nsis

# iOS
npx tauri ios build

# Android
npx tauri android build
```

Desktop output:
```
src-tauri/target/release/bundle/macos/Streaming Stats.app              # macOS
src-tauri/target/release/bundle/nsis/Streaming Stats_0.1.0_x64-setup.exe  # Windows
```

### Tests

```bash
npm test                                        # Frontend (Vitest)
cd src-tauri && cargo test                      # Backend (Rust)
```

### Lint & Format

```bash
npm run lint:fix && npm run format              # Frontend
cd src-tauri && cargo clippy && cargo fmt       # Backend
```

## Project Structure

```
streaming-stats/
├── src/                        # React 19 frontend (TypeScript)
│   ├── components/
│   │   ├── Dashboard.tsx       # Main view with stats, charts, auto-fetch
│   │   ├── PlatformCard.tsx    # Individual platform stat card
│   │   ├── PlatformDetail.tsx  # Detail view with stats, top tracks, curators
│   │   ├── KpiRow.tsx          # 6-card KPI summary row
│   │   ├── DailyGrowthChart.tsx # Stacked bar chart by platform
│   │   ├── GrowthShare.tsx     # Platform growth share bars
│   │   ├── StatsChart.tsx      # Trend line chart
│   │   ├── Setup.tsx           # 3-step onboarding flow
│   │   └── Settings.tsx        # Config, platform toggles, backfill
│   ├── lib/
│   │   ├── songstats-api.ts    # Songstats API client with retry logic
│   │   ├── database.ts         # Tauri IPC wrappers for Rust DB commands
│   │   ├── settings.ts         # Encrypted settings store
│   │   ├── utils.ts            # Data aggregation and formatting
│   │   ├── constants.ts        # Platform names, colors, stat labels
│   │   └── types.ts            # TypeScript interfaces
│   └── styles/
│       └── globals.css         # Dark theme with CSS custom properties
├── src-tauri/                  # Rust backend (Tauri 2)
│   └── src/
│       ├── lib.rs              # App setup (plugins, tray, DB pool)
│       ├── commands.rs         # 16 Tauri IPC commands
│       ├── db.rs               # SQLite pool and migrations
│       ├── models.rs           # Serde models for IPC boundary
│       └── error.rs            # Error types
├── docs/                       # Detailed documentation
└── package.json
```

See [`docs/`](docs/README.md) for detailed documentation on architecture, database schema, API integration, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Platforms | macOS, Windows, iOS, Android |
| App framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | React 19, TypeScript 5.9, Vite 6 |
| Backend | Rust (Edition 2021) |
| Database | SQLite (via sqlx) |
| Settings | tauri-plugin-store (encrypted) |
| HTTP | tauri-plugin-http (reqwest) |
| Charts | Chart.js + react-chartjs-2 |
| Dates | date-fns 4 |
| API | [Songstats via RapidAPI](https://rapidapi.com/songstats-app-songstats-app-default/api/songstats) |
