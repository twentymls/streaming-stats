# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0-beta.3] - 2026-03-14

### Added

- Instagram as a 9th platform source with follower trend chart, icon, and brand color
- Custom app icon (bar chart logo)
- Scheduled daily fetch with configurable fetch hour (default 2 PM)
- Daily play rate display on platform detail pages
- Auto-backfill historic data for newly added platforms

### Fixed

- Track stat badges showing cross-platform data on detail pages
- Hardened URL handling and security for open-source release

## [0.1.0-beta.2] - 2026-03-13

### Fixed

- Fix daily fetch limit check allowing up to 10 fetches instead of 1

## [0.1.0-beta.1] - 2026-03-13

### Added

- Dashboard with KPI cards (daily growth, Spotify streams/day, YouTube views/day), stacked bar chart of daily growth by platform, and growth share breakdown
- Support for 8 music platforms: Spotify, Apple Music, YouTube, TikTok, Deezer, Amazon Music, Shazam, SoundCloud
- Platform detail views with full stats, trend charts, and top tracks with Songstats links
- TikTok top curators view
- Daily auto-fetch on app launch (max 1x/day) with local SQLite storage
- Backfill up to 90 days of historical data from Songstats
- 3-step onboarding flow with API key and artist ID validation
- Settings page with platform toggles, backfill controls, and API usage tracking
- 7/30/60/90 day period filters with optional 7-day rolling average smoothing
- Dark theme UI with platform-specific brand colors and icons
- macOS desktop build (DMG)
