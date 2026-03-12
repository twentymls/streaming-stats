export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("it-IT");
}

export const HERO_STAT_PRIORITY: Record<string, string[]> = {
  spotify: ["monthly_listeners", "streams", "followers"],
  youtube: ["views", "followers"],
  tiktok: ["views", "creates", "followers"],
  shazam: ["shazams"],
  soundcloud: ["plays", "followers"],
  apple_music: ["streams", "playlist_reach"],
  deezer: ["streams", "followers"],
  amazon: ["streams", "followers"],
};

export function getHeroStat(
  source: string,
  stats: Record<string, number>
): { key: string; value: number } | null {
  const priority = HERO_STAT_PRIORITY[source] ?? [
    "streams",
    "views",
    "creates",
    "shazams",
    "plays",
  ];
  for (const key of priority) {
    if (stats[key] != null) return { key, value: stats[key] };
  }
  const first = Object.entries(stats)[0];
  return first ? { key: first[0], value: first[1] } : null;
}
