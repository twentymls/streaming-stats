# Streaming Stats

A desktop app that tracks streaming stats for music artists across 8 platforms using the [Songstats API](https://rapidapi.com/songstats-app-songstats-app-default/api/songstats). Built with Tauri (Rust + React).

## Supported Platforms

Spotify, Apple Music, YouTube, TikTok, Deezer, Amazon Music, Shazam, SoundCloud

## How It Works

1. **Setup** — Enter your RapidAPI key and a Spotify artist ID/URL. The app validates both before proceeding.
2. **Daily tracking** — The app automatically fetches stats on launch (max 2x/day, at least 8 hours apart). All data is stored locally in a SQLite database.
3. **Dashboard** — View current stats per platform, trend charts over time, and a distribution breakdown. Filter by 7/30/60/90 day periods.
4. **Backfill** — One-time download of up to 90 days of historical data from Songstats (Settings > Backfill historic data).

### Data & Privacy

All data is stored **locally on your machine**:
- Stats in a SQLite database (`streaming_stats.db`)
- Settings (API key, artist ID) in Tauri's encrypted store

No data is sent anywhere except the Songstats API calls to fetch stats.

### API Usage

The app uses the Songstats API via RapidAPI. The **BASIC plan** allows 500 requests/month. Each "Update" uses ~9 API calls (1 artist info + 8 platforms). A backfill uses ~8 calls. The dashboard shows your current monthly usage.

A 1.2 second delay is added between platform requests to stay within the per-second rate limit.

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri system dependencies — see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
- A [RapidAPI](https://rapidapi.com/) account with a Songstats API subscription

### Install

```bash
git clone <repo-url>
cd streaming-stats
npm install
```

### Run in dev mode

```bash
npx tauri dev
```

This starts the Vite dev server on `localhost:5173` and compiles the Rust backend. The app window opens automatically with hot-reload for frontend changes.

### Build for production

```bash
npx tauri build --bundles app
```

The built app is output to:
```
src-tauri/target/release/bundle/macos/Streaming Stats.app
```

## Project Structure

```
streaming-stats/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component (setup vs dashboard routing)
│   ├── main.tsx                # React entry point
│   ├── components/
│   │   ├── Setup.tsx           # 3-step onboarding flow
│   │   ├── Dashboard.tsx       # Main view with stats, charts, auto-fetch
│   │   ├── PlatformCard.tsx    # Individual platform stat card
│   │   ├── StatsChart.tsx      # Trend line chart + distribution doughnut
│   │   └── Settings.tsx        # Config, platform toggles, backfill button
│   ├── lib/
│   │   ├── songstats-api.ts    # Songstats API integration
│   │   ├── database.ts         # SQLite operations (daily_stats, api_calls_log)
│   │   ├── settings.ts         # Tauri store for app settings
│   │   ├── constants.ts        # Platform names, colors, stat labels
│   │   └── types.ts            # TypeScript interfaces
│   └── styles/
│       └── globals.css         # Dark theme styling
├── src-tauri/                  # Rust backend
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri app config (window, CSP, plugins)
│   └── src/
│       ├── lib.rs              # Tauri app setup (plugins, tray, invoke handler)
│       └── commands.rs         # Rust commands exposed to frontend
├── index.html                  # HTML shell
├── vite.config.ts              # Vite bundler config
├── tsconfig.json               # TypeScript config
└── package.json                # Node dependencies and scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Tauri v2](https://v2.tauri.app/) |
| Frontend | React 19, TypeScript, Vite |
| Backend | Rust |
| Database | SQLite (via tauri-plugin-sql) |
| Settings storage | tauri-plugin-store |
| HTTP client | tauri-plugin-http (reqwest with brotli/gzip) |
| Charts | Chart.js + react-chartjs-2 |
| Date utils | date-fns |
| API | [Songstats via RapidAPI](https://rapidapi.com/songstats-app-songstats-app-default/api/songstats) |
