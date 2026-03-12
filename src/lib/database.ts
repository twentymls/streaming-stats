import Database from "@tauri-apps/plugin-sql";
import { DailyStat, TopTrack, TopCurator } from "./types";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:streaming_stats.db");
    await runMigrations(db);
  }
  return db;
}

async function runMigrations(database: Database): Promise<void> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      stat_type TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(date, source, stat_type)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS api_calls_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      source TEXT,
      status_code INTEGER,
      called_at TEXT DEFAULT (datetime('now')),
      month_year TEXT NOT NULL
    )
  `);

  await database.execute(`CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)`);
  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_daily_stats_source ON daily_stats(source)`
  );
  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_api_calls_month ON api_calls_log(month_year)`
  );

  await database.execute(`
    CREATE TABLE IF NOT EXISTS top_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      rank INTEGER NOT NULL,
      title TEXT NOT NULL,
      streams INTEGER NOT NULL DEFAULT 0,
      artwork_url TEXT,
      UNIQUE(date, source, rank)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS top_curators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      rank INTEGER NOT NULL,
      curator_name TEXT NOT NULL,
      followers_total TEXT,
      image_url TEXT,
      external_url TEXT,
      UNIQUE(date, source, rank)
    )
  `);

  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_top_tracks_date_source ON top_tracks(date, source)`
  );
  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_top_curators_date_source ON top_curators(date, source)`
  );
}

export async function saveDailyStat(
  date: string,
  source: string,
  statType: string,
  value: number
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT OR REPLACE INTO daily_stats (date, source, stat_type, value) VALUES ($1, $2, $3, $4)`,
    [date, source, statType, value]
  );
}

export async function getLatestStats(): Promise<DailyStat[]> {
  const database = await getDb();
  const result = await database.select<DailyStat[]>(
    `SELECT * FROM daily_stats WHERE date = (SELECT MAX(date) FROM daily_stats) ORDER BY source, stat_type`
  );
  return result;
}

export async function getStatsRange(
  startDate: string,
  endDate: string,
  source?: string
): Promise<DailyStat[]> {
  const database = await getDb();
  if (source) {
    return database.select<DailyStat[]>(
      `SELECT * FROM daily_stats WHERE date BETWEEN $1 AND $2 AND source = $3 ORDER BY date, stat_type`,
      [startDate, endDate, source]
    );
  }
  return database.select<DailyStat[]>(
    `SELECT * FROM daily_stats WHERE date BETWEEN $1 AND $2 ORDER BY date, source, stat_type`,
    [startDate, endDate]
  );
}

export async function logApiCall(
  endpoint: string,
  source: string,
  statusCode: number
): Promise<void> {
  const database = await getDb();
  const monthYear = new Date().toISOString().slice(0, 7);
  await database.execute(
    `INSERT INTO api_calls_log (endpoint, source, status_code, month_year) VALUES ($1, $2, $3, $4)`,
    [endpoint, source, statusCode, monthYear]
  );
}

export async function getMonthlyApiCount(): Promise<number> {
  const database = await getDb();
  const monthYear = new Date().toISOString().slice(0, 7);
  const result = await database.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM api_calls_log WHERE month_year = $1`,
    [monthYear]
  );
  return result[0]?.count ?? 0;
}

export async function getLastFetchDate(): Promise<string | null> {
  const database = await getDb();
  const result = await database.select<{ date: string }[]>(
    `SELECT MAX(date) as date FROM daily_stats`
  );
  return result[0]?.date ?? null;
}

export async function saveTopTracks(
  date: string,
  source: string,
  tracks: TopTrack[]
): Promise<void> {
  const database = await getDb();
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    await database.execute(
      `INSERT OR REPLACE INTO top_tracks (date, source, rank, title, streams, artwork_url) VALUES ($1, $2, $3, $4, $5, $6)`,
      [date, source, i + 1, t.title, t.streams, t.artwork_url ?? null]
    );
  }
}

export async function saveTopCurators(
  date: string,
  source: string,
  curators: TopCurator[]
): Promise<void> {
  const database = await getDb();
  for (let i = 0; i < curators.length; i++) {
    const c = curators[i];
    await database.execute(
      `INSERT OR REPLACE INTO top_curators (date, source, rank, curator_name, followers_total, image_url, external_url) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        date,
        source,
        i + 1,
        c.curator_name,
        c.followers_total ?? null,
        c.image_url ?? null,
        c.external_url ?? null,
      ]
    );
  }
}

export async function getLatestTopTracks(source: string): Promise<TopTrack[]> {
  const database = await getDb();
  const rows = await database.select<
    { title: string; streams: number; artwork_url: string | null }[]
  >(
    `SELECT title, streams, artwork_url FROM top_tracks WHERE source = $1 AND date = (SELECT MAX(date) FROM top_tracks WHERE source = $1) ORDER BY rank ASC`,
    [source]
  );
  return rows.map((r) => ({
    title: r.title,
    streams: r.streams,
    artwork_url: r.artwork_url ?? undefined,
  }));
}

export async function getLatestTopCurators(source: string): Promise<TopCurator[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      curator_name: string;
      followers_total: string | null;
      image_url: string | null;
      external_url: string | null;
    }[]
  >(
    `SELECT curator_name, followers_total, image_url, external_url FROM top_curators WHERE source = $1 AND date = (SELECT MAX(date) FROM top_curators WHERE source = $1) ORDER BY rank ASC`,
    [source]
  );
  return rows.map((r) => ({
    curator_name: r.curator_name,
    followers_total: r.followers_total ?? undefined,
    image_url: r.image_url ?? undefined,
    external_url: r.external_url ?? undefined,
  }));
}

export async function getTopTrackDeltas(source: string): Promise<Map<string, number>> {
  const database = await getDb();
  const rows = await database.select<{ title: string; delta: number }[]>(
    `SELECT t1.title, (t1.streams - t2.streams) as delta
     FROM top_tracks t1
     JOIN top_tracks t2 ON t1.source = t2.source AND t1.title = t2.title
     WHERE t1.source = $1
       AND t1.date = (SELECT MAX(date) FROM top_tracks WHERE source = $1)
       AND t2.date = (SELECT MAX(date) FROM top_tracks WHERE source = $1 AND date < (SELECT MAX(date) FROM top_tracks WHERE source = $1))
       AND (t1.streams - t2.streams) > 0`,
    [source]
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.title, r.delta);
  }
  return map;
}

export async function getAllCachedTopTracks(): Promise<Map<string, TopTrack[]>> {
  const database = await getDb();
  const rows = await database.select<
    { source: string; title: string; streams: number; artwork_url: string | null; rank: number }[]
  >(
    `SELECT t.source, t.title, t.streams, t.artwork_url, t.rank FROM top_tracks t
     INNER JOIN (SELECT source, MAX(date) as max_date FROM top_tracks GROUP BY source) m
     ON t.source = m.source AND t.date = m.max_date
     ORDER BY t.source, t.rank`
  );
  const map = new Map<string, TopTrack[]>();
  for (const r of rows) {
    if (!map.has(r.source)) map.set(r.source, []);
    map
      .get(r.source)!
      .push({ title: r.title, streams: r.streams, artwork_url: r.artwork_url ?? undefined });
  }
  return map;
}

export async function getAllCachedTopCurators(): Promise<Map<string, TopCurator[]>> {
  const database = await getDb();
  const rows = await database.select<
    {
      source: string;
      curator_name: string;
      followers_total: string | null;
      image_url: string | null;
      external_url: string | null;
      rank: number;
    }[]
  >(
    `SELECT t.source, t.curator_name, t.followers_total, t.image_url, t.external_url, t.rank FROM top_curators t
     INNER JOIN (SELECT source, MAX(date) as max_date FROM top_curators GROUP BY source) m
     ON t.source = m.source AND t.date = m.max_date
     ORDER BY t.source, t.rank`
  );
  const map = new Map<string, TopCurator[]>();
  for (const r of rows) {
    if (!map.has(r.source)) map.set(r.source, []);
    map.get(r.source)!.push({
      curator_name: r.curator_name,
      followers_total: r.followers_total ?? undefined,
      image_url: r.image_url ?? undefined,
      external_url: r.external_url ?? undefined,
    });
  }
  return map;
}
