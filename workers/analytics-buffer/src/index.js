import { DurableObject } from "cloudflare:workers";

// Flush ke D1 setiap 3 jam -> maksimal 8x/hari (<= 16 rows written/hari)
const FLUSH_INTERVAL_MS = 3 * 60 * 60 * 1000;

function todayWIB() {
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
          offline_syncs INTEGER NOT NULL DEFAULT 0,
          trakteer_clicks INTEGER NOT NULL DEFAULT 0,
          shares INTEGER NOT NULL DEFAULT 0,
          pwa_installs INTEGER NOT NULL DEFAULT 0,
          returning_sessions INTEGER NOT NULL DEFAULT 0
        )
      `);
      for (const col of ["trakteer_clicks", "shares", "pwa_installs", "returning_sessions"]) {
        try {
          this.ctx.storage.sql.exec(
            `ALTER TABLE pending_daily ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`
          );
        } catch {
          // Kolom sudah ada
        }
      }
    });
  }

  async record(payload) {
    const date = typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : todayWIB();

    this.ctx.storage.sql.exec(
      `INSERT INTO pending_daily (
         date, sessions, games_started, games_over, komplit_count, total_score, max_score,
         offline_syncs, trakteer_clicks, shares, pwa_installs, returning_sessions
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT(date) DO UPDATE SET
         sessions = sessions + excluded.sessions,
         games_started = games_started + excluded.games_started,
         games_over = games_over + excluded.games_over,
         komplit_count = komplit_count + excluded.komplit_count,
         total_score = total_score + excluded.total_score,
         max_score = MAX(max_score, excluded.max_score),
         offline_syncs = offline_syncs + excluded.offline_syncs,
         trakteer_clicks = trakteer_clicks + excluded.trakteer_clicks,
         shares = shares + excluded.shares,
         pwa_installs = pwa_installs + excluded.pwa_installs,
         returning_sessions = returning_sessions + excluded.returning_sessions`,
      date,
      payload.sessions || 0,
      payload.gamesStarted || 0,
      payload.gamesOver || 0,
      payload.komplit || 0,
      payload.totalScore || 0,
      payload.maxScore || 0,
      payload.offlineSyncs || 0,
      payload.trakteerClicks || 0,
      payload.shares || 0,
      payload.pwaInstalls || 0,
      payload.returningSessions || 0
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
      INSERT INTO daily_stats (
        date, sessions, games_started, games_over, komplit_count, total_score, max_score,
        offline_syncs, trakteer_clicks, shares, pwa_installs, returning_sessions, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
      ON CONFLICT(date) DO UPDATE SET
        sessions = sessions + excluded.sessions,
        games_started = games_started + excluded.games_started,
        games_over = games_over + excluded.games_over,
        komplit_count = komplit_count + excluded.komplit_count,
        total_score = total_score + excluded.total_score,
        max_score = MAX(max_score, excluded.max_score),
        offline_syncs = offline_syncs + excluded.offline_syncs,
        trakteer_clicks = trakteer_clicks + excluded.trakteer_clicks,
        shares = shares + excluded.shares,
        pwa_installs = pwa_installs + excluded.pwa_installs,
        returning_sessions = returning_sessions + excluded.returning_sessions,
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
        r.trakteer_clicks || 0,
        r.shares || 0,
        r.pwa_installs || 0,
        r.returning_sessions || 0,
        now
      )
    );

    await this.env.DB.batch(batch);

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
