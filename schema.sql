-- Schema D1 untuk Semangkuk Mie Ayam (1 row = 1 hari, tanpa index tambahan)
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
