import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
console.log(`Load testing rooms at ${origin}`);
const timings = [];
const sessions = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(path, data, token, expected = 200) {
  const start = performance.now();
  const response = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, result.error);
  timings.push({
    action: data?.action || (data ? "create" : "read"),
    totalMs: performance.now() - start,
    serverMs: Number(
      response.headers.get("server-timing")?.match(/app;dur=([\d.]+)/)?.[1],
    ),
  });
  return result;
}
try {
  const created = await request(
    "/api/rooms",
    { name: "Load host", duration: 60 },
    undefined,
    201,
  );
  sessions.push(created.session);
  const path = `/api/rooms/${created.room.code}`;
  await Promise.all(
    Array.from({ length: 5 }, async (_, i) => {
      const joined = await request(
        path,
        { action: "join", name: `Load racer ${i}` },
        undefined,
        201,
      );
      sessions.push(joined.session);
    }),
  );
  const started = await request(
    path,
    { action: "start", round: 1 },
    sessions[0].token,
  );
  await sleep(Math.max(0, started.room.startAt - started.room.serverNow + 150));
  const revisions = sessions.map(() => 0);
  for (let seq = 1; seq <= 16; seq++) {
    await Promise.all(
      sessions.map(async (session, i) => {
        const typed = created.room.passage.slice(0, seq * 2);
        const { room } = await request(
          path,
          {
            action: "sync",
            round: 1,
            seq,
            typed,
            strokes: typed.length,
            errors: 0,
          },
          session.token,
        );
        assert.equal(room.players.length, 6);
        assert.equal(
          room.players.find((p) => p.id === session.id).correct,
          typed.length,
        );
        assert.ok(room.revision >= revisions[i]);
        revisions[i] = room.revision;
      }),
    );
    await sleep(500);
  }
  const { room } = await request(path, undefined, sessions[0].token);
  assert.ok(room.players.every((player) => player.correct === 32));
  const summary = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length
      ? {
          medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
          p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
          maxMs: Math.round(sorted.at(-1)),
        }
      : null;
  };
  console.log(
    JSON.stringify({
      origin,
      players: sessions.length,
      requests: timings.length,
      errors: 0,
      total: summary(timings.map((timing) => timing.totalMs)),
      progress: summary(
        timings
          .filter((timing) => timing.action === "sync")
          .map((timing) => timing.totalMs),
      ),
      server: summary(timings.map((timing) => timing.serverMs)),
    }),
  );
} finally {
  for (const session of sessions)
    await request(
      `/api/rooms/${session.code}`,
      { action: "leave" },
      session.token,
    );
}
