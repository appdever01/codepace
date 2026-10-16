import test from "node:test";
import assert from "node:assert/strict";
import {
  api,
  isNewerRoom,
  pollDelay,
  RequestError,
  restoreRoom,
  synchronizeRoom,
  type RoomResponse,
} from "../lib/room-client.ts";
import type { RoomSnapshot } from "../lib/room-types.ts";

const room: RoomSnapshot = {
  code: "ABC234",
  hostId: "host",
  round: 1,
  revision: 2,
  passage: "Shared text",
  duration: 15,
  startAt: null,
  serverNow: 100,
  expiresAt: 100000,
  phase: "lobby",
  players: [],
};
const response = (snapshot = room) => ({ room: snapshot }) as RoomResponse;
const session = { code: room.code, id: "host", token: "secret" };
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("room revisions reject delayed progress and rematch responses", () => {
  assert.equal(
    isNewerRoom({ ...room, revision: 1, serverNow: 200 }, room),
    false,
  );
  assert.equal(
    isNewerRoom({ ...room, revision: 3, serverNow: 90 }, room),
    true,
  );
  assert.equal(
    isNewerRoom({ ...room, round: 1, serverNow: 400 }, { ...room, round: 2 }),
    false,
  );
  assert.equal(isNewerRoom({ ...room, serverNow: 99 }, room), false);
});

test("polling slows down in idle tabs and backs off during outages", () => {
  assert.equal(pollDelay("running", 0), 500);
  assert.equal(pollDelay("lobby", 0), 1200);
  assert.equal(pollDelay("running", 0, true), 5000);
  assert.equal(pollDelay("running", 1), 1000);
  assert.equal(pollDelay("running", 20), 8000);
});

test("unchanged rooms use reads, changed typing writes, and stop cancels pending work", async () => {
  let typed = "";
  let seq = 0;
  const writes: unknown[] = [];
  const signals: AbortSignal[] = [];
  const sync = synchronizeRoom({
    session,
    progress: () => ({
      round: 1,
      seq: ++seq,
      typed,
      strokes: typed.length,
      errors: 0,
    }),
    phase: () => "running",
    onRoom() {},
    onError(error) {
      throw error;
    },
    request: async (_path, data, _token, signal) => {
      writes.push(data);
      signals.push(signal!);
      return response();
    },
  });
  try {
    await settle();
    sync.push();
    await settle();
    assert.equal(writes.length, 2);
    assert.equal(writes[1], undefined);
    typed = "Sh";
    sync.push();
    await settle();
    assert.equal((writes[2] as { typed: string }).typed, "Sh");
    sync.stop();
    sync.push();
    await settle();
    assert.equal(writes.length, 3);
    assert.ok(signals.every((signal) => signal.aborted));
  } finally {
    sync.stop();
  }
});

test("a final update waits for the current request without overlapping it", async () => {
  let release!: (value: RoomResponse) => void;
  const writes: unknown[] = [];
  let typed = "";
  const sync = synchronizeRoom({
    session,
    progress: () => ({
      round: 1,
      seq: 1,
      typed,
      strokes: typed.length,
      errors: 0,
    }),
    phase: () => "finished",
    onRoom() {},
    onError(error) {
      throw error;
    },
    request: async (_path, data) => {
      writes.push(data);
      return writes.length === 1
        ? new Promise((resolve) => {
            release = resolve;
          })
        : response();
    },
  });
  try {
    typed = "Shared";
    sync.push();
    sync.push();
    assert.equal(writes.length, 1);
    release(response());
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(writes.length, 2);
    assert.equal((writes[1] as { typed: string }).typed, "Shared");
  } finally {
    sync.stop();
  }
});

test("stale rounds refresh their snapshot and propagate expired-session errors", async () => {
  const calls: unknown[] = [];
  let accepted = 0;
  let error: unknown;
  const sync = synchronizeRoom({
    session,
    progress: () => ({ round: 1, seq: 1, typed: "", strokes: 0, errors: 0 }),
    phase: () => "ready",
    onRoom(snapshot) {
      accepted = snapshot.round;
    },
    onError(value) {
      error = value;
    },
    request: async (_path, data) => {
      calls.push(data);
      if (calls.length === 1) throw new RequestError("New round", 409);
      if (calls.length === 2) return response({ ...room, round: 2 });
      throw new RequestError("Expired", 401);
    },
  });
  try {
    await settle();
    assert.equal(calls[1], undefined);
    assert.equal(accepted, 2);
    sync.push();
    await settle();
    assert.equal((error as RequestError).status, 401);
  } finally {
    sync.stop();
  }
});

test("HTML gateway errors produce a recoverable request error", async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("Gateway unavailable", { status: 502 });
  try {
    await assert.rejects(
      api("/api/rooms"),
      (error: unknown) => error instanceof RequestError && error.status === 502,
    );
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test("saved room restoration retries outages and preserves the recovered typing", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let retries = 0;
  const controller = new AbortController();
  const restored = restoreRoom(
    session,
    controller.signal,
    () => retries++,
    async () => {
      calls++;
      if (calls < 3) throw new TypeError("Offline");
      return {
        ...response(),
        self: { typed: "Shared", strokes: 7, errors: 1, seq: 12 },
      };
    },
  );
  await settle();
  context.mock.timers.tick(1000);
  await settle();
  context.mock.timers.tick(2000);
  await settle();
  const result = await restored;
  assert.equal(retries, 2);
  assert.equal(result.data.self?.typed, "Shared");
  assert.equal(result.data.self?.seq, 12);
  context.mock.timers.reset();
});

test("expired saved sessions stop retrying and unmount cancels recovery", async () => {
  const controller = new AbortController();
  await assert.rejects(
    restoreRoom(
      session,
      controller.signal,
      () => assert.fail("No retry for expired sessions"),
      async () => {
        throw new RequestError("Expired", 404);
      },
    ),
    (error: unknown) => error instanceof RequestError && error.status === 404,
  );
  let retries = 0;
  const pending = restoreRoom(
    session,
    controller.signal,
    () => retries++,
    async () => {
      throw new TypeError("Offline");
    },
  );
  const rejected = assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
  await settle();
  controller.abort();
  await rejected;
  assert.equal(retries, 1);
});
