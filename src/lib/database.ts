import Database from "@tauri-apps/plugin-sql";
import { DailyStat } from "./types";

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

  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)`
  );
  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_daily_stats_source ON daily_stats(source)`
  );
  await database.execute(
    `CREATE INDEX IF NOT EXISTS idx_api_calls_month ON api_calls_log(month_year)`
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
