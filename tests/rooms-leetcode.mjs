import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
const catalog = JSON.parse(
  readFileSync(new URL("../lib/coding-catalog.json", import.meta.url), "utf8"),
);
const sessions = [];
let checks = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(session, data, expected = 200) {
  const path = session ? `/api/rooms/${session.code}` : "/api/rooms";
  const response = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (result.session) sessions.push(result.session);
  assert.equal(response.status, expected, result.error);
  checks++;
  return result;
}
const content = (language, problemId = "0001-two-sum") => ({
  mode: "code",
  language,
  snippet: 0,
  problemId,
});
const bundle = (language) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/coding/${language}.json`, import.meta.url),
      "utf8",
    ),
  );
console.log(`Checking multiplayer LeetCode at ${origin}`);
try {
  await request(
    null,
    {
      name: "Invalid library",
      duration: 15,
      content: content("python", "missing"),
    },
    400,
  );
  const created = await request(
    null,
    {
      name: "Library host",
      duration: 15,
      content: { ...content("python"), text: "untrusted solution" },
    },
    201,
  );
  const host = created.session;
  const guest = (
    await request(host, { action: "join", name: "Library guest" }, 201)
  ).session;
  assert.equal(created.room.passage, bundle("python")["0001-two-sum"]);
  assert.equal("text" in created.room.content, false);
  const configure = (selection, session = host, expected = 200) =>
    request(
      session,
      { action: "configure", round: 1, duration: 15, content: selection },
      expected,
    );
  await configure(content("java"), guest, 403);
  for (const language of [
    "python",
    "javascript",
    "typescript",
    "java",
    "cpp",
    "go",
    "rust",
  ]) {
    const chosen = await configure(content(language));
    const peer = await request(guest);
    assert.equal(chosen.room.passage, bundle(language)["0001-two-sum"]);
    assert.equal(peer.room.passage, chosen.room.passage);
    assert.deepEqual(peer.room.content, content(language));
  }
  const unavailable = catalog.find(
    (problem) =>
      problem.languages.includes("python") &&
      !problem.languages.includes("rust"),
  );
  await configure(content("rust", unavailable.id), host, 400);
  await configure(content("python", "../../etc/passwd"), host, 400);
  const [longestId, fullCode] = Object.entries(bundle("javascript")).sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  const selected = await configure(content("javascript", longestId));
  assert.ok(fullCode.length > 3000);
  assert.equal(selected.room.passage, fullCode);
  const planned = Date.now() + 12000;
  await request(host, { action: "schedule", round: 1, scheduledAt: planned });
  await configure(content("python"), host, 409);
  let started;
  const deadline = Date.now() + 18000;
  while (Date.now() < deadline) {
    const { room } = await request(guest);
    assert.equal(room.passage, fullCode);
    if (room.phase === "running") {
      started = room;
      break;
    }
    await sleep(250);
  }
  assert.ok(
    started,
    "The guest must trigger the scheduled race without the host pressing Start.",
  );
  assert.equal(started.startAt, planned);
  await configure(content("python"), host, 409);
  const typed = "x".repeat(3500);
  const synced = await request(guest, {
    action: "sync",
    round: 1,
    seq: 1,
    typed,
    strokes: typed.length,
    errors: typed.length,
  });
  assert.equal(
    synced.room.players.find((player) => player.id === guest.id).errors,
    typed.length,
  );
  const restored = await request(guest);
  assert.equal(restored.self.typed, typed);
  await request(
    guest,
    {
      action: "sync",
      round: 1,
      seq: 2,
      typed: "x".repeat(fullCode.length + 1),
      strokes: fullCode.length + 1,
      errors: fullCode.length + 1,
    },
    400,
  );
  await request(
    guest,
    {
      action: "sync",
      round: 1,
      seq: 2,
      typed: "x".repeat(20001),
      strokes: 20001,
      errors: 20001,
    },
    400,
  );
  await request(
    guest,
    {
      action: "sync",
      round: 1,
      seq: 2,
      typed: "x".repeat(132000),
      strokes: 100000,
      errors: 0,
    },
    413,
  );
  const hostProgress = await request(host, {
    action: "sync",
    round: 1,
    seq: 1,
    typed: fullCode.slice(0, 3),
    strokes: 3,
    errors: 0,
  });
  assert.equal(
    hostProgress.room.players.find((player) => player.id === host.id).correct,
    3,
  );
  assert.equal(
    (await request(guest)).room.players.find((player) => player.id === host.id)
      .correct,
    3,
  );
  await sleep(Math.max(0, started.startAt + 15100 - Date.now()));
  assert.equal((await request(guest)).room.phase, "finished");
  const next = await request(host, { action: "rematch", round: 1 });
  assert.equal(next.room.round, 2);
  assert.equal(next.room.passage, fullCode);
  assert.deepEqual(next.room.content, content("javascript", longestId));
  assert.equal(next.room.scheduledAt, null);
  assert.equal((await request(host)).self.typed, "");
  const ordinary = await request(host, {
    action: "configure",
    round: 2,
    duration: 15,
    content: { mode: "code", language: "python", snippet: 1 },
  });
  assert.equal(ordinary.room.content.problemId, undefined);
  assert.notEqual(ordinary.room.passage, fullCode);
  console.log(
    `Passed ${checks} HTTP checks across seven languages, scheduled start, long input, shared progress and rematch.`,
  );
} finally {
  const cleanup = await Promise.allSettled(
    sessions.map((session) => request(session, { action: "leave" })),
  );
  const failures = cleanup.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Could not remove test participants.",
    );
  if (sessions.length) await request(sessions[0], undefined, 404);
  console.log(`Removed ${sessions.length} test participants.`);
}
