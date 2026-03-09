import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = process.env.DATA_DIR ?? "/data";
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "timestamps.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS community_timestamps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      timestamp_seconds INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_video_id ON community_timestamps (video_id);
  `);

  return _db;
}

export function saveTimestamp(videoId: string, timestampSeconds: number): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO community_timestamps (video_id, timestamp_seconds) VALUES (?, ?)"
  ).run(videoId, timestampSeconds);
}

export function getMedianTimestamp(videoId: string): number | null {
  const db = getDb();
  // Use only the 100 most recent submissions to bound memory and limit poisoning
  const recent = db
    .prepare(
      "SELECT timestamp_seconds FROM community_timestamps WHERE video_id = ? ORDER BY created_at DESC LIMIT 100"
    )
    .all(videoId) as { timestamp_seconds: number }[];

  const rows = recent.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  if (rows.length === 0) return null;

  const mid = Math.floor(rows.length / 2);
  if (rows.length % 2 === 1) {
    return rows[mid].timestamp_seconds;
  }
  return Math.round(
    (rows[mid - 1].timestamp_seconds + rows[mid].timestamp_seconds) / 2
  );
}
