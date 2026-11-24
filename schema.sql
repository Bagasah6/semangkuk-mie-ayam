-- Schema D1 untuk Semangkuk Mie Ayam
-- Mengadopsi skema ketua-rt-analytics (events + stats_snapshot) + daily_stats agregat harian

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  week INTEGER,
  version TEXT,
  device TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_name ON events (event_name);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at);
CREATE INDEX IF NOT EXISTS idx_events_client ON events (client_id);
CREATE INDEX IF NOT EXISTS idx_events_name_created ON events (event_name, created_at);

CREATE TABLE IF NOT EXISTS stats_snapshot (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  sessions INTEGER NOT NULL DEFAULT 0,
  games_started INTEGER NOT NULL DEFAULT 0,
  games_over INTEGER NOT NULL DEFAULT 0,
  komplit_count INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  offline_syncs INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
