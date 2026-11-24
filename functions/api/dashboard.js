function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DASHBOARD_SECRET) {
    return Response.json(
      { error: "DASHBOARD_SECRET belum dikonfigurasi di Environment Variables." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!timingSafeEqual(token, env.DASHBOARD_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.DB) {
    return Response.json(
      { error: "D1 binding (DB) belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const rawDays = Number(url.searchParams.get("days") || 7);
  const days = Number.isFinite(rawDays)
    ? Math.max(1, Math.min(14, Math.trunc(rawDays)))
    : 7;
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Cache 12 jam di Cloudflare Edge agar D1 tetap <= 20 rows read/hari
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/__internal_dashboard_v1?days=${days}`);

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const hitRes = new Response(cached.body, cached);
      hitRes.headers.set("X-Cache", "HIT");
      return hitRes;
    }
  }

  const { results } = await env.DB.prepare(
    `SELECT date, sessions, games_started, games_over, komplit_count, total_score, max_score, offline_syncs, updated_at
     FROM daily_stats
     ORDER BY date DESC
     LIMIT ?1`
  )
    .bind(days)
    .all();

  const payload = {
    days,
    fetchedAt: new Date().toISOString(),
    rowsRead: results.length,
    rows: results,
  };

  const res = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=43200",
      "X-Cache": "MISS",
    },
  });

  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
