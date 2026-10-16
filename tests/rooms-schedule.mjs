import assert from "node:assert/strict";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
console.log(`Checking scheduled races at ${origin}`);
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
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (result.session) sessions.push(result.session);
  assert.equal(response.status, expected, result.error);
  checks++;
  return result;
}
const create = (name) =>
  request(null, { name, duration: 15, content: { mode: "words" } }, 201);
try {
  const created = await create("Schedule host");
  const host = created.session;
  const guest = (
    await request(host, { action: "join", name: "Schedule guest" }, 201)
  ).session;
  const peer = (
    await request(host, { action: "join", name: "Schedule peer" }, 201)
  ).session;
  const schedule = (scheduledAt, session = host, round = 1, status = 200) =>
    request(session, { action: "schedule", round, scheduledAt }, status);
  await schedule(Date.now() + 3600000, guest, 1, 403);
  await schedule(Date.now() - 1000, host, 1, 400);
  await schedule(Date.now() + 8 * 86400000, host, 1, 400);
  await schedule(Date.now() + 3600000, host, 99, 409);
  const future = await schedule(Date.now() + 6 * 3600000);
  assert.equal(future.room.phase, "lobby");
  assert.equal(future.room.startAt, null);
  assert.ok(future.room.expiresAt >= future.room.scheduledAt + 7200000);
  assert.equal(future.room.passage, created.room.passage);
  const observed = await request(guest);
  assert.equal(observed.room.scheduledAt, future.room.scheduledAt);
  assert.equal((await request(host)).room.scheduledAt, future.room.scheduledAt);
  const late = (
    await request(host, { action: "join", name: "Early arrival" }, 201)
  ).session;
  assert.equal((await request(late)).room.phase, "lobby");
  await request(
    host,
    {
      action: "configure",
      round: 1,
      duration: 15,
      content: { mode: "quotes" },
    },
    409,
  );
  await request(guest, { action: "cancel_schedule", round: 1 }, 403);
  const moved = await schedule(Date.now() + 7200000);
  assert.notEqual(moved.room.scheduledAt, future.room.scheduledAt);
  assert.equal(moved.room.expiresAt, moved.room.scheduledAt + 7200000);
  const cancelled = await request(host, {
    action: "cancel_schedule",
    round: 1,
  });
  assert.equal(cancelled.room.scheduledAt, null);
  assert.equal(cancelled.room.phase, "lobby");
  assert.ok(cancelled.room.expiresAt <= cancelled.room.serverNow + 7200000);
  assert.ok(cancelled.room.expiresAt > cancelled.room.serverNow + 7190000);
  const planned = Date.now() + 15000;
  await schedule(planned);
  let room;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const snapshots = await Promise.all([request(guest), request(peer)]);
    room = snapshots.find((result) => result.room.startAt !== null)?.room;
    if (room) break;
    await sleep(250);
  }
  assert.ok(
    room,
    "The race must start without the host making a Start request.",
  );
  assert.equal(room.startAt, planned);
  assert.equal(room.phase, "countdown");
  assert.equal((await request(peer)).room.startAt, planned);
  await request(host, { action: "cancel_schedule", round: 1 }, 409);
  await request(host, { action: "start", round: 1 }, 409);
  await request(host, { action: "join", name: "Too late" }, 409);
  await sleep(Math.max(0, room.startAt - room.serverNow + 100));
  const typing = await request(guest, {
    action: "sync",
    round: 1,
    seq: 1,
    typed: room.passage.slice(0, 3),
    strokes: 3,
    errors: 0,
  });
  assert.equal(typing.room.phase, "running");
  assert.equal(
    typing.room.players.find((player) => player.id === guest.id).correct,
    3,
  );
  await sleep(Math.max(0, typing.room.startAt + 15100 - typing.room.serverNow));
  assert.equal((await request(guest)).room.phase, "finished");
  const rematch = await request(host, { action: "rematch", round: 1 });
  assert.equal(rematch.room.phase, "lobby");
  assert.equal(rematch.room.scheduledAt, null);
  assert.equal(rematch.room.startAt, null);
  const solo = (await create("Waiting host")).session;
  const waitingAt = Date.now() + 11000;
  await request(solo, { action: "schedule", round: 1, scheduledAt: waitingAt });
  await sleep(Math.max(0, waitingAt - Date.now() + 100));
  const waiting = await request(solo);
  assert.equal(waiting.room.phase, "lobby");
  assert.equal(waiting.room.startAt, null);
  const joined = await request(
    solo,
    { action: "join", name: "Second player" },
    201,
  );
  assert.equal(joined.room.phase, "countdown");
  assert.ok(joined.room.startAt > joined.room.serverNow + 3000);
  assert.ok(joined.room.expiresAt >= joined.room.startAt + 7200000);
  const override = (await create("Override host")).session;
  await request(override, { action: "join", name: "Override guest" }, 201);
  await request(override, {
    action: "schedule",
    round: 1,
    scheduledAt: Date.now() + 3600000,
  });
  const immediate = await request(override, { action: "start", round: 1 });
  assert.equal(immediate.room.phase, "countdown");
  assert.equal(immediate.room.scheduledAt, null);
  assert.equal(immediate.room.expiresAt, immediate.room.startAt + 7200000);
  console.log(
    `Scheduled race checks passed: ${checks}. Permissions, validation, room expiry, arrivals, rescheduling, cancellation, automatic start without host input, waiting for two, typing, rematch and Start now verified.`,
  );
} finally {
  const failures = [];
  for (const session of sessions) {
    try {
      await request(session, { action: "leave" });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Schedule test cleanup failed.");
  console.log(`Removed all ${sessions.length} schedule-test participants.`);
}
