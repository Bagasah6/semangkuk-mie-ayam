import { DurableObject } from "cloudflare:workers";

// Flush ke D1 setiap 3 jam -> maksimal 8x/hari (<= 16 rows written/hari)
const FLUSH_INTERVAL_MS = 3 * 60 * 60 * 1000;

function todayWIB() {
  // Format YYYY-MM-DD zona waktu Asia/Jakarta (WIB)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export class AnalyticsBuffer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS pending_daily (
          date TEXT PRIMARY KEY,
          sessions INTEGER NOT NULL DEFAULT 0,
          games_started INTEGER NOT NULL DEFAULT 0,
          games_over INTEGER NOT NULL DEFAULT 0,
          komplit_count INTEGER NOT NULL DEFAULT 0,
          total_score INTEGER NOT NULL DEFAULT 0,
          max_score INTEGER NOT NULL DEFAULT 0,
          offline_syncs INTEGER NOT NULL DEFAULT 0
        )
      `);
    });
  }

  async record(payload) {
    const date = typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : todayWIB();

    this.ctx.storage.sql.exec(
      `INSERT INTO pending_daily (date, sessions, games_started, games_over, komplit_count, total_score, max_score, offline_syncs)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT(date) DO UPDATE SET
         sessions = sessions + excluded.sessions,
         games_started = games_started + excluded.games_started,
         games_over = games_over + excluded.games_over,
         komplit_count = komplit_count + excluded.komplit_count,
         total_score = total_score + excluded.total_score,
         max_score = MAX(max_score, excluded.max_score),
         offline_syncs = offline_syncs + excluded.offline_syncs`,
      date,
      payload.sessions,
      payload.gamesStarted,
      payload.gamesOver,
      payload.komplit,
      payload.totalScore,
      payload.maxScore,
      payload.offlineSyncs
    );

    const existingAlarm = await this.ctx.storage.getAlarm();
    if (!existingAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
    }

    return { buffered: true, date };
  }

  async flushNow() {
    const flushed = await this.flushToD1();
    return { flushed };
  }

  async alarm() {
    await this.flushToD1();
  }

  async flushToD1() {
    const rows = this.ctx.storage.sql
      .exec("SELECT * FROM pending_daily")
      .toArray();

    if (rows.length === 0) return 0;

    const now = new Date().toISOString();
    const stmt = this.env.DB.prepare(`
      INSERT INTO daily_stats (date, sessions, games_started, games_over, komplit_count, total_score, max_score, offline_syncs, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(date) DO UPDATE SET
        sessions = sessions + excluded.sessions,
        games_started = games_started + excluded.games_started,
        games_over = games_over + excluded.games_over,
        komplit_count = komplit_count + excluded.komplit_count,
        total_score = total_score + excluded.total_score,
        max_score = MAX(max_score, excluded.max_score),
        offline_syncs = offline_syncs + excluded.offline_syncs,
        updated_at = excluded.updated_at
    `);

    const batch = rows.map((r) =>
      stmt.bind(
        r.date,
        r.sessions,
        r.games_started,
        r.games_over,
        r.komplit_count,
        r.total_score,
        r.max_score,
        r.offline_syncs,
        now
      )
    );

    await this.env.DB.batch(batch);

    // Hapus buffer lokal hanya setelah D1 batch berhasil
    for (const r of rows) {
      this.ctx.storage.sql.exec("DELETE FROM pending_daily WHERE date = ?1", r.date);
    }

    return rows.length;
  }
}

export default {
  async fetch() {
    return new Response("Semangkuk Mie Ayam Analytics Buffer", { status: 200 });
  },
};
