# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
