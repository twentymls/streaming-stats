# Styling Guide

The app uses a dark theme implemented with CSS custom properties. All styles are in `src/styles/globals.css`. No CSS framework is used -- layouts are built with flexbox and CSS grid.

## CSS Variables (Theme)

Defined in `:root`:

```css
--bg: #1a1a2e          /* Main background */
--bg-card: #16213e     /* Card backgrounds */
--bg-input: #0f3460    /* Input field backgrounds */
--text: #e0e0e0        /* Primary text */
--text-muted: #888     /* Secondary/label text */
--accent: #1db954      /* Primary accent (Spotify green) */
--danger: #e74c3c      /* Destructive actions, errors */
--border: #2a2a4a      /* Borders, dividers */
--radius: 12px         /* Standard border radius */
```

Always use `var(--color-name)` rather than hardcoded hex values.

## Platform Colors

Defined in `src/lib/constants.ts`:

### DSP_COLORS (for platform cards and borders)

| Platform | Color | Hex |
|----------|-------|-----|
| Spotify | Green | `#1DB954` |
| Apple Music | Red | `#FC3C44` |
| YouTube | Red | `#FF0000` |
| TikTok | Black | `#010101` |
| Deezer | Purple | `#A238FF` |
| Amazon Music | Blue | `#00A8E1` |
| Shazam | Blue | `#0088FF` |
| SoundCloud | Orange | `#FF5500` |

### DSP_CHART_COLORS (for charts only)

Same as `DSP_COLORS` except TikTok is overridden to `#69C9D0` (teal) because `#010101` is invisible on the dark background.

## Layout Patterns

### Dashboard grid

```css
.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
```

Auto-fills cards that are at least 220px wide.

### KPI row

```css
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
```

6 cards in a 3x2 grid. On mobile (<=700px), switches to `repeat(2, 1fr)`.

### Growth share row

```css
.growth-share-row {
  display: grid;
  grid-template-columns: 100px 1fr 55px 95px;
  align-items: center;
}
```

Fixed-width columns for name, percent, and avg. Flexible bar track in the middle.

### Charts

```css
.chart-container {
  height: 320px;  /* Fixed height for Chart.js */
}
```

Chart.js uses `responsive: true` and `maintainAspectRatio: false`, so it fills the container.

## Responsive Breakpoints

Only one breakpoint at 700px:

```css
@media (max-width: 700px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .growth-share-row { grid-template-columns: 80px 1fr 45px 80px; }
  .dashboard-header { flex-direction: column; align-items: flex-start; }
}
```

## Button System

```css
.btn          /* Base: bg-card background, bordered */
.btn-primary  /* Green accent background, white text */
.btn-danger   /* Red border, red text; on hover: red bg, white text */
.btn-sm       /* Smaller padding for period selectors */
.btn-sm.active  /* Green accent for selected period */
```

All buttons have `:hover` transitions and `:disabled` styles (opacity 0.5, no pointer).

## Key Class Groups

| Group | Classes | Purpose |
|-------|---------|---------|
| Setup | `.setup-container`, `.setup-card`, `.setup-step`, `.setup-input`, `.setup-button` | Onboarding wizard |
| Dashboard | `.dashboard`, `.dashboard-header`, `.header-left`, `.header-right` | Main layout |
| Platform cards | `.platform-card`, `.platform-header`, `.platform-main-stat`, `.platform-sub-stats` | Platform grid |
| Charts | `.charts-section`, `.charts-toolbar`, `.chart-container`, `.period-selector` | Chart area |
| KPI | `.kpi-row`, `.kpi-card`, `.kpi-value`, `.kpi-label`, `.kpi-positive`, `.kpi-negative` | KPI cards |
| Growth share | `.growth-share`, `.growth-share-row`, `.growth-share-bar-track`, `.growth-share-bar-fill` | Share bars |
| Detail | `.platform-detail`, `.detail-header`, `.detail-hero`, `.detail-stats-grid` | Platform detail |
| Top tracks | `.top-tracks-section`, `.top-track-item`, `.top-track-artwork`, `.track-stat-badge` | Track lists |
| Settings | `.settings-page`, `.settings-section`, `.sources-grid`, `.source-toggle` | Settings page |
| Loading | `.loading-overlay`, `.spinner`, `.loading-screen`, `.empty-state` | Loading states |
| Badges | `.yesterday-badge`, `.yesterday-badge-sm`, `.api-badge` | Delta indicators |
