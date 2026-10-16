import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
const duration = Number(process.env.CODEPACE_LOAD_SECONDS || 30);
assert.ok([15, 30, 60].includes(duration), "Use a 15, 30 or 60 second race.");
console.log(`Load testing 50 players for ${duration} seconds at ${origin}`);
const scheduled = process.env.CODEPACE_LOAD_SCHEDULED === "true";
const timings = [];
const sessions = [];
const departed = new Set();
const progress = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let unexpectedErrors = 0;
let rejectedJoins = 0;
let cleanupCount = 0;
let roomPath;
async function request(path, data, token, expected = [200]) {
  const start = performance.now();
  try {
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
    if (result.session) sessions.push(result.session);
    assert.ok(
      expected.includes(response.status),
      `${data?.action || "read"}: HTTP ${response.status} ${result.error || ""}`,
    );
    timings.push({
      action: data?.action || (data ? "create" : "read"),
      totalMs: performance.now() - start,
      serverMs: Number(
        response.headers.get("server-timing")?.match(/app;dur=([\d.]+)/)?.[1] ??
          NaN,
      ),
    });
    return { ...result, status: response.status };
  } catch (error) {
    unexpectedErrors++;
    throw error;
  }
}
async function all(tasks) {
  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      `${failures.length} participant requests failed.`,
    );
  return results.map((result) => result.value);
}
function checkRoom(room, started) {
  assert.equal(room.players.length, 50);
  assert.equal(new Set(room.players.map((player) => player.id)).size, 50);
  assert.equal(room.startAt, started.room.startAt);
  assert.equal(room.passage, started.room.passage);
  assert.equal(room.round, 1);
  assert.ok(!JSON.stringify(room).includes("token"));
}
function summary(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  assert.ok(sorted.length);
  return {
    medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
    p95Ms: Math.round(
      sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    ),
    maxMs: Math.round(sorted.at(-1)),
  };
}
let report;
try {
  const content = {
    mode: "code",
    language: "typescript",
    snippet: -1,
    text: Array.from(
      { length: 70 },
      (_, index) => `const sample${index} = ${index};`,
    ).join("\n"),
  };
  const created = await request(
    "/api/rooms",
    { name: "Load host", duration, content },
    undefined,
    [201],
  );
  const host = created.session;
  roomPath = `/api/rooms/${host.code}`;
  const attempts = await all(
    Array.from({ length: 52 }, (_, index) =>
      request(
        roomPath,
        { action: "join", name: `Load racer ${index + 1}` },
        undefined,
        [201, 409],
      ),
    ),
  );
  assert.equal(attempts.filter((result) => result.status === 201).length, 49);
  rejectedJoins = attempts.filter((result) => result.status === 409).length;
  assert.equal(rejectedJoins, 3);
  assert.equal(sessions.length, 50);
  let startSentAt = Date.now();
  let started = await request(
    roomPath,
    scheduled
      ? { action: "schedule", round: 1, scheduledAt: Date.now() + 15000 }
      : { action: "start", round: 1 },
    host.token,
  );
  if (scheduled) {
    assert.equal(started.room.phase, "lobby");
    const planned = started.room.scheduledAt;
    const deadline = performance.now() + 20000;
    while (started.room.startAt === null && performance.now() < deadline) {
      await sleep(250);
      startSentAt = Date.now();
      started = await request(roomPath, undefined, sessions[1].token);
    }
    assert.equal(started.room.startAt, planned);
    console.log(
      "The scheduled countdown started automatically without a Start request.",
    );
  }
  let clockOffset = started.room.serverNow - (startSentAt + Date.now()) / 2;
  assert.equal(started.room.phase, "countdown");
  const countdowns = await all(
    sessions.map((session) => request(roomPath, undefined, session.token)),
  );
  countdowns.forEach(({ room }) => checkRoom(room, started));
  await sleep(
    Math.max(0, started.room.startAt - Date.now() - clockOffset + 100),
  );
  const readyDeadline = performance.now() + 10000;
  let ready;
  do {
    const sentAt = Date.now();
    ready = await request(roomPath, undefined, host.token);
    checkRoom(ready.room, started);
    clockOffset = ready.room.serverNow - (sentAt + Date.now()) / 2;
    if (ready.room.phase !== "countdown") break;
    await sleep(50);
  } while (performance.now() < readyDeadline);
  assert.equal(ready.room.phase, "running");
  const raceStarted = performance.now();
  const raceDeadline =
    raceStarted +
    started.room.startAt +
    duration * 1000 -
    Date.now() -
    clockOffset -
    250;
  console.log(
    "All 50 joined and received the same passage and start time; 3 overflow joins were refused. Racing…",
  );
  await all(
    sessions.map(async (session, index) => {
      let seq = 0;
      let revision = 0;
      let staleChecked = false;
      while (performance.now() < raceDeadline) {
        const elapsed = Math.max(0, performance.now() - raceStarted);
        const length = Math.min(
          content.text.length - 1,
          Math.floor((elapsed / 1000) * (4 + (index % 5))) + 1,
        );
        const typed = content.text.slice(0, length);
        const previous = progress.get(session.id);
        const data =
          typed === previous?.typed
            ? undefined
            : {
                action: "sync",
                round: 1,
                seq: ++seq,
                typed,
                strokes: typed.length,
                errors: 0,
              };
        const result = await request(roomPath, data, session.token);
        checkRoom(result.room, started);
        assert.ok(result.room.revision >= revision);
        revision = result.room.revision;
        const own = result.room.players.find(
          (player) => player.id === session.id,
        );
        if (data && own.correct === typed.length) {
          progress.set(session.id, {
            typed,
            seq,
            correct: own.correct,
            updates: (previous?.updates || 0) + 1,
          });
        } else if (data) {
          assert.equal(
            result.room.phase,
            "finished",
            "Live typing must be saved.",
          );
        }
        if (index === 0 && seq >= 5 && !staleChecked) {
          const stale = await request(
            roomPath,
            {
              action: "sync",
              round: 1,
              seq: 0,
              typed: "",
              strokes: 0,
              errors: 0,
            },
            session.token,
          );
          assert.equal(
            stale.room.players.find((player) => player.id === session.id)
              .correct,
            own.correct,
          );
          staleChecked = true;
        }
        await sleep(500);
      }
    }),
  );
  await sleep(
    Math.max(
      100,
      started.room.startAt + duration * 1000 - Date.now() - clockOffset + 150,
    ),
  );
  const finishDeadline = performance.now() + 5000;
  let finished;
  do {
    finished = await request(roomPath, undefined, host.token);
    if (finished.room.phase === "finished") break;
    await sleep(50);
  } while (performance.now() < finishDeadline);
  assert.equal(finished.room.phase, "finished");
  const restored = await all(
    sessions.map((session) => request(roomPath, undefined, session.token)),
  );
  restored.forEach((result, index) => {
    checkRoom(result.room, started);
    assert.equal(result.room.phase, "finished");
    const saved = progress.get(sessions[index].id);
    assert.ok(saved, "Every participant must have saved typing progress.");
    assert.ok(
      saved.updates >= Math.floor(duration / 3),
      "Every participant must send sustained live progress.",
    );
    assert.equal(result.self.typed, saved.typed);
    assert.equal(result.self.seq, saved.seq);
    result.room.players.forEach((player) =>
      assert.equal(player.correct, progress.get(player.id).correct),
    );
  });
  const rematch = await request(
    roomPath,
    { action: "rematch", round: 1 },
    host.token,
  );
  assert.equal(rematch.room.round, 2);
  assert.equal(rematch.room.phase, "lobby");
  assert.equal(rematch.room.scheduledAt, null);
  assert.equal(rematch.room.players.length, 50);
  assert.deepEqual(rematch.room.content, content);
  assert.ok(
    rematch.room.players.every(
      (player) => player.correct === 0 && player.strokes === 0,
    ),
  );
  await request(
    roomPath,
    {
      action: "sync",
      round: 1,
      seq: 999,
      typed: "stale",
      strokes: 5,
      errors: 0,
    },
    host.token,
    [409],
  );
  await request(roomPath, { action: "leave" }, host.token);
  departed.add(host.id);
  cleanupCount++;
  const transferred = await request(roomPath, undefined, sessions[1].token);
  assert.notEqual(transferred.room.hostId, host.id);
  assert.equal(transferred.room.players.length, 49);
  const updates = summary(
    timings
      .filter((timing) => timing.action === "sync")
      .map((timing) => timing.totalMs),
  );
  report = {
    origin,
    players: sessions.length,
    durationSeconds: duration,
    scheduledStart: scheduled,
    rejectedJoins,
    requests: timings.length,
    unexpectedErrors,
    progress: updates,
    server: summary(timings.map((timing) => timing.serverMs)),
  };
  assert.ok(
    updates.p95Ms <= 1500,
    `Progress p95 ${updates.p95Ms} ms exceeds 1500 ms.`,
  );
  assert.ok(
    updates.maxMs <= 5000,
    `Progress maximum ${updates.maxMs} ms exceeds 5000 ms.`,
  );
} finally {
  const remaining = sessions.filter((session) => !departed.has(session.id));
  const failures = [];
  for (let index = 0; index < remaining.length; index += 5) {
    const results = await Promise.allSettled(
      remaining.slice(index, index + 5).map(async (session) => {
        const response = await request(
          `/api/rooms/${session.code}`,
          { action: "leave" },
          session.token,
          [200, 401, 404],
        );
        assert.ok(
          response.status === 200 ||
            response.status === 401 ||
            response.status === 404,
        );
        cleanupCount++;
      }),
    );
    failures.push(
      ...results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    );
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Test participants could not all be removed.",
    );
  if (roomPath) await request(roomPath, undefined, undefined, [404]);
  console.log(
    `Removed ${cleanupCount} test participants; the test room no longer exists.`,
  );
}
console.log(
  JSON.stringify({
    ...report,
    cleanupCount,
    requests: timings.length,
    unexpectedErrors,
  }),
);
