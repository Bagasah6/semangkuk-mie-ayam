function clampInt(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function todayWIB() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Tolak request lintas-origin yang tidak sah
  const reqOrigin = request.headers.get("Origin");
  const selfOrigin = new URL(request.url).origin;
  if (reqOrigin && reqOrigin !== selfOrigin) {
    return Response.json({ error: "Forbidden origin" }, { status: 403 });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const clean = {
    date: typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : todayWIB(),
    sessions: clampInt(body.sessions, 0, 10),
    gamesStarted: clampInt(body.gamesStarted, 0, 50),
    gamesOver: clampInt(body.gamesOver, 0, 50),
    komplit: clampInt(body.komplit, 0, 20),
    totalScore: clampInt(body.totalScore, 0, 500000),
    maxScore: clampInt(body.maxScore, 0, 500000),
    offlineSyncs: clampInt(body.offlineSyncs, 0, 50),
  };

  const hasActivity =
    clean.sessions +
      clean.gamesStarted +
      clean.gamesOver +
      clean.komplit +
      clean.totalScore +
      clean.offlineSyncs >
    0;

  if (!hasActivity) {
    return new Response(null, { status: 204 });
  }

  if (!env.ANALYTICS_BUFFER) {
    return Response.json(
      { error: "ANALYTICS_BUFFER binding not configured" },
      { status: 503 }
    );
  }

  const stub = env.ANALYTICS_BUFFER.getByName("global-buffer");
  await stub.record(clean);

  return Response.json({ ok: true }, { status: 202 });
}
