import assert from "node:assert/strict";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
console.log(`Checking rooms at ${origin}`);
let checks = 0;
async function request(path, data, session, status = 200, headers = {}) {
  const response = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : { error: await response.text() };
  assert.equal(
    response.status,
    status,
    `${path}: ${body.error || "unexpected status"}`,
  );
  checks++;
  return body;
}
const create = (name) =>
  request("/api/rooms", { name, duration: 15 }, null, 201);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const host = await create("First host");
const code = host.room.code;
assert.equal(host.room.phase, "lobby");
assert.equal(host.room.players.length, 1);
assert.ok(!JSON.stringify(host.room).includes("token"));
await request(`/api/rooms/${code}`, undefined, null, 401);
await request(
  `/api/rooms/${code}`,
  { action: "start", round: 1 },
  host.session,
  409,
);
const friend = await request(
  `/api/rooms/${code}`,
  { action: "join", name: "Second racer" },
  null,
  201,
);
assert.equal(friend.room.players.length, 2);
assert.equal(friend.room.passage, host.room.passage);
assert.deepEqual(host.room.content, { mode: "quotes" });
const codeContent = { mode: "code", language: "typescript", snippet: 0 };
await request(
  `/api/rooms/${code}`,
  { action: "configure", round: 1, duration: 15, content: codeContent },
  friend.session,
  403,
);
const configured = await request(
  `/api/rooms/${code}`,
  { action: "configure", round: 1, duration: 15, content: codeContent },
  host.session,
);
assert.deepEqual(configured.room.content, codeContent);
assert.ok(configured.room.passage.includes("values: number[]"));
host.room = configured.room;
await request(
  `/api/rooms/${code}`,
  { action: "start", round: 1 },
  friend.session,
  403,
);
const other = await create("Other room");
await request(`/api/rooms/${code}`, undefined, other.session, 401);
await request("/api/rooms", { name: "<script>", duration: 15 }, null, 400);
await request("/api/rooms", { name: "Invalid time", duration: 1 }, null, 400);
await request("/api/rooms", { name: "Cross origin", duration: 15 }, null, 403, {
  Origin: "https://unrelated.example",
});
const started = await request(
  `/api/rooms/${code}`,
  { action: "start", round: 1 },
  host.session,
);
assert.equal(started.room.phase, "countdown");
await request(
  `/api/rooms/${code}`,
  { action: "start", round: 1 },
  host.session,
  409,
);
const peer = await request(`/api/rooms/${code}`, undefined, friend.session);
assert.equal(peer.room.startAt, started.room.startAt);
assert.deepEqual(peer.room.content, codeContent);
assert.equal(peer.room.passage, configured.room.passage);
await request(
  `/api/rooms/${code}`,
  { action: "configure", round: 1, duration: 30, content: { mode: "words" } },
  host.session,
  409,
);
await request(
  `/api/rooms/${code}`,
  { action: "join", name: "Late racer" },
  null,
  409,
);
const early = await request(
  `/api/rooms/${code}`,
  {
    action: "sync",
    round: 1,
    seq: 1,
    typed: host.room.passage.slice(0, 5),
    strokes: 5,
    errors: 0,
  },
  host.session,
);
assert.equal(
  early.room.players.find((p) => p.id === host.session.id).correct,
  0,
);
await sleep(Math.max(0, started.room.startAt - Date.now() + 150));
const prefix = host.room.passage.slice(0, 12);
const progress = await request(
  `/api/rooms/${code}`,
  { action: "sync", round: 1, seq: 2, typed: prefix, strokes: 13, errors: 1 },
  host.session,
);
assert.equal(
  progress.room.players.find((p) => p.id === host.session.id).correct,
  12,
);
assert.equal(
  progress.room.players.find((p) => p.id === host.session.id).accuracy,
  92.3,
);
const observed = await request(`/api/rooms/${code}`, undefined, friend.session);
assert.equal(
  observed.room.players.find((p) => p.id === host.session.id).correct,
  12,
);
await request(
  `/api/rooms/${code}`,
  { action: "sync", round: 1, seq: 3, typed: prefix, strokes: 13, errors: 14 },
  host.session,
  400,
);
await request(
  `/api/rooms/${code}`,
  {
    action: "sync",
    round: 1,
    seq: 4,
    typed: host.room.passage,
    strokes: host.room.passage.length,
    errors: 1,
  },
  host.session,
  400,
);
const stale = await request(
  `/api/rooms/${code}`,
  { action: "sync", round: 1, seq: 1, typed: "", strokes: 0, errors: 0 },
  host.session,
);
assert.equal(
  stale.room.players.find((p) => p.id === host.session.id).correct,
  12,
);
const concurrentProgress = await Promise.all(
  [5, 6].map((seq) =>
    request(
      `/api/rooms/${code}`,
      {
        action: "sync",
        round: 1,
        seq,
        typed: host.room.passage.slice(0, seq + 12),
        strokes: seq + 13,
        errors: 1,
      },
      host.session,
    ),
  ),
);
assert.ok(
  concurrentProgress.every((r) => r.room.revision >= progress.room.revision),
);
const afterProgress = await request(
  `/api/rooms/${code}`,
  undefined,
  friend.session,
);
assert.equal(
  afterProgress.room.players.find((p) => p.id === host.session.id).correct,
  18,
);
await request(
  `/api/rooms/${code}`,
  { action: "rematch", round: 1 },
  host.session,
  409,
);
const capacity = await create("Capacity host");
const attempts = await Promise.all(
  Array.from({ length: 8 }, async (_, i) => {
    const response = await fetch(`${origin}/api/rooms/${capacity.room.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name: `Guest ${i}` }),
    });
    return response.status;
  }),
);
assert.equal(attempts.filter((n) => n === 201).length, 5);
assert.equal(attempts.filter((n) => n === 409).length, 3);
checks += 2;
await sleep(Math.max(0, started.room.startAt + 15050 - Date.now()));
const done = await request(`/api/rooms/${code}`, undefined, friend.session);
assert.equal(done.room.phase, "finished");
assert.equal(done.room.players.find((p) => p.id === host.session.id).wpm, 14);
const rematches = await Promise.all(
  [0, 1].map(async () => {
    const response = await fetch(`${origin}/api/rooms/${code}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${host.session.token}`,
      },
      body: JSON.stringify({ action: "rematch", round: 1 }),
    });
    return { status: response.status, body: await response.json() };
  }),
);
assert.deepEqual(rematches.map((r) => r.status).sort(), [200, 409]);
checks += 2;
const rematch = rematches.find((r) => r.status === 200).body;
assert.equal(rematch.room.round, 2);
assert.equal(rematch.room.phase, "lobby");
assert.deepEqual(rematch.room.content, codeContent);
assert.equal(rematch.room.passage, configured.room.passage);
assert.ok(
  rematch.room.players.every((p) => p.correct === 0 && p.strokes === 0),
);
await request(
  `/api/rooms/${code}`,
  { action: "sync", round: 1, seq: 5, typed: prefix, strokes: 13, errors: 1 },
  host.session,
  409,
);
await request(
  `/api/rooms/${code}`,
  { action: "rematch", round: 1 },
  host.session,
  409,
);
const intact = await request(`/api/rooms/${code}`, undefined, friend.session);
assert.equal(intact.room.round, 2);
for (const content of [
  { mode: "words" },
  { mode: "quotes" },
  {
    mode: "custom",
    text: "Everyone will type this same custom passage in the room.",
  },
  {
    mode: "code",
    language: "python",
    snippet: -1,
    text: "def hello():\n    return 123",
  },
]) {
  const selected = await request(
    `/api/rooms/${code}`,
    { action: "configure", round: 2, duration: 30, content },
    host.session,
  );
  assert.deepEqual(selected.room.content, content);
  const shared = await request(`/api/rooms/${code}`, undefined, friend.session);
  assert.deepEqual(shared.room.content, content);
  assert.equal(shared.room.passage, selected.room.passage);
  assert.equal(shared.room.duration, 30);
  if (content.text) assert.equal(shared.room.passage, content.text);
}
await request(
  "/api/rooms",
  {
    name: "Invalid content",
    duration: 15,
    content: { mode: "code", language: "invalid", snippet: 0 },
  },
  null,
  400,
);
await request(
  `/api/rooms/${code}`,
  {
    action: "configure",
    round: 2,
    duration: 30,
    content: { mode: "custom", text: "too short" },
  },
  host.session,
  400,
);
await request(`/api/rooms/${code}`, { action: "leave" }, host.session);
const transferred = await request(
  `/api/rooms/${code}`,
  undefined,
  friend.session,
);
assert.equal(transferred.room.hostId, friend.session.id);
await request(`/api/rooms/${code}`, { action: "leave" }, friend.session);
await request(`/api/rooms/${code}`, undefined, friend.session, 404);
await request(
  `/api/rooms/${other.room.code}`,
  { action: "leave" },
  other.session,
);
console.log(
  `Room smoke checks passed: ${checks}. Shared countdown, two-player progress, isolation, permissions, concurrent capacity, results, rematch and host transfer verified.`,
);
