import { env } from "cloudflare:workers";
import { z } from "zod";
import { makePassage } from "./passages";
import { correctPrefix, wpm, accuracy } from "./scoring";
import type { RoomSnapshot } from "./room-types";

type StoredRoom = {
  code: string;
  host_id: string;
  passage: string;
  duration: number;
  round: number;
  start_at: number | null;
  created_at: number;
  expires_at: number;
};
type StoredPlayer = {
  id: string;
  room_code: string;
  name: string;
  token_hash: string;
  joined_at: number;
  seen_at: number;
  round: number;
  typed: string;
  strokes: number;
  errors: number;
  correct: number;
  finished_at: number | null;
  seq: number;
};
const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(24, "Use 24 characters or fewer.")
  .regex(
    /^[\p{L}\p{N} _.-]+$/u,
    "Use letters, numbers, spaces, dots or dashes.",
  );
const durationSchema = z.union([z.literal(15), z.literal(30), z.literal(60)]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), name: nameSchema }),
  z.object({ action: z.literal("start"), round: z.number().int().positive() }),
  z.object({
    action: z.literal("rematch"),
    round: z.number().int().positive(),
  }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("reclaim") }),
  z.object({
    action: z.literal("sync"),
    round: z.number().int().positive(),
    seq: z.number().int().min(0).max(100000),
    typed: z.string().max(3000),
    strokes: z.number().int().min(0).max(100000),
    errors: z.number().int().min(0).max(100000),
  }),
]);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function database() {
  if (!env.DB)
    throw new ApiError(
      503,
      "Friend rooms are temporarily unavailable. Solo races still work.",
    );
  return env.DB;
}
function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
function secret() {
  return crypto.randomUUID() + crypto.randomUUID();
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Send JSON data.");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "Open Keylane directly to use friend rooms.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request data.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new ApiError(413, "That request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "The request data could not be read.");
  }
}
async function rateLimit(request: Request, bucket: string, maximum: number) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  const key = await hash(`${bucket}:${ip}:${Math.floor(now / 3600000)}`);
  const row = await database()
    .prepare(
      "INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(key, now + 3600000)
    .first<{ count: number }>();
  if (!row || row.count > maximum)
    throw new ApiError(429, "Too many attempts. Try again in an hour.");
}
async function getRoom(code: string) {
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new ApiError(404, "Room not found. Check the six-character code.");
  const room = await database()
    .prepare("SELECT * FROM rooms WHERE code = ? AND expires_at > ?")
    .bind(code, Date.now())
    .first<StoredRoom>();
  if (!room)
    throw new ApiError(
      404,
      "This room has expired or does not exist. Create a new one.",
    );
  return room;
}
async function member(request: Request, room: StoredRoom) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.length > 200)
    throw new ApiError(401, "Join this room to continue.");
  const player = await database()
    .prepare("SELECT * FROM players WHERE room_code = ? AND token_hash = ?")
    .bind(room.code, await hash(token))
    .first<StoredPlayer>();
  if (!player)
    throw new ApiError(401, "Your room session has ended. Join again.");
  return player;
}
async function snapshot(room: StoredRoom): Promise<RoomSnapshot> {
  const now = Date.now();
  const { results } = await database()
    .prepare("SELECT * FROM players WHERE room_code = ? ORDER BY joined_at, id")
    .bind(room.code)
    .all<StoredPlayer>();
  const started = room.start_at !== null && now >= room.start_at;
  const allDone =
    results.length > 0 && results.every((p) => p.finished_at !== null);
  const finished =
    started && (now >= room.start_at! + room.duration * 1000 || allDone);
  return {
    code: room.code,
    hostId: room.host_id,
    round: room.round,
    passage: room.passage,
    duration: room.duration,
    startAt: room.start_at,
    expiresAt: room.expires_at,
    serverNow: now,
    phase:
      room.start_at === null
        ? "lobby"
        : !started
          ? "countdown"
          : finished
            ? "finished"
            : "running",
    players: results.map((p) => ({
      id: p.id,
      name: p.name,
      joinedAt: p.joined_at,
      seenAt: p.seen_at,
      round: p.round,
      correct: p.correct,
      strokes: p.strokes,
      errors: p.errors,
      finishedAt: p.finished_at,
      wpm: started
        ? wpm(
            p.correct,
            Math.max(
              0,
              Math.min(
                p.finished_at ?? now,
                room.start_at! + room.duration * 1000,
              ) - room.start_at!,
            ),
          )
        : 0,
      accuracy: accuracy(p.strokes, p.errors),
    })),
  };
}
export async function handleApi(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError)
      return reply({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return reply(
        { error: error.issues[0]?.message || "Check your details." },
        400,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "room_request_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return reply(
      { error: "The room could not be updated. Please try again." },
      500,
    );
  }
}
export async function createRoom(request: Request) {
  const input = z
    .object({ name: nameSchema, duration: durationSchema })
    .parse(await body(request));
  await rateLimit(request, "create", 30);
  const db = database();
  const now = Date.now();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n % alphabet.length],
  ).join("");
  const id = crypto.randomUUID();
  const token = secret();
  await db.batch([
    db.prepare("DELETE FROM rooms WHERE expires_at < ?").bind(now),
    db.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now),
    db
      .prepare(
        "INSERT INTO rooms (code, host_id, passage, duration, round, created_at, expires_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      )
      .bind(
        code,
        id,
        makePassage("quotes", now, "", [], input.duration),
        input.duration,
        now,
        now + 7200000,
      ),
    db
      .prepare(
        "INSERT INTO players (id, room_code, token_hash, name, joined_at, seen_at, round) VALUES (?, ?, ?, ?, ?, ?, 1)",
      )
      .bind(id, code, await hash(token), input.name, now, now),
  ]);
  return reply(
    { session: { code, id, token }, room: await snapshot(await getRoom(code)) },
    201,
  );
}
export async function readRoom(request: Request, code: string) {
  const room = await getRoom(code);
  const player = await member(request, room);
  return reply({
    room: await snapshot(room),
    self: {
      typed: player.typed,
      strokes: player.strokes,
      errors: player.errors,
      seq: player.seq,
    },
  });
}
export async function updateRoom(request: Request, code: string) {
  const input = actionSchema.parse(await body(request));
  let room = await getRoom(code);
  const db = database();
  const now = Date.now();
  if (input.action === "join") {
    await rateLimit(request, "join", 100);
    const id = crypto.randomUUID();
    const token = secret();
    const inserted = await db
      .prepare(
        "INSERT INTO players (id, room_code, token_hash, name, joined_at, seen_at, round) SELECT ?, code, ?, ?, ?, ?, round FROM rooms WHERE code = ? AND start_at IS NULL AND (SELECT COUNT(*) FROM players WHERE room_code = ?) < 6",
      )
      .bind(id, await hash(token), input.name, now, now, code, code)
      .run();
    if (!inserted.meta.changes)
      throw new ApiError(
        409,
        "This room is full or racing. Ask the host to open the next round.",
      );
    return reply(
      {
        session: { code, id, token },
        room: await snapshot(await getRoom(code)),
      },
      201,
    );
  }
  const player = await member(request, room);
  if (input.action === "start") {
    if (player.id !== room.host_id)
      throw new ApiError(403, "Only the host can start the race.");
    const started = await db
      .prepare(
        "UPDATE rooms SET start_at = ? WHERE code = ? AND host_id = ? AND round = ? AND start_at IS NULL AND (SELECT COUNT(*) FROM players WHERE room_code = ? AND seen_at > ?) >= 2",
      )
      .bind(now + 4000, code, player.id, input.round, code, now - 30000)
      .run();
    if (!started.meta.changes)
      throw new ApiError(
        409,
        "Wait for two connected racers, or refresh the room.",
      );
  }
  if (input.action === "rematch") {
    if (player.id !== room.host_id)
      throw new ApiError(403, "Only the host can open the next round.");
    const current = await snapshot(room);
    if (current.phase !== "finished")
      throw new ApiError(409, "Finish this race first.");
    const next = input.round + 1;
    const updates = await db.batch([
      db
        .prepare(
          "UPDATE rooms SET start_at = NULL, round = round + 1, passage = ? WHERE code = ? AND host_id = ? AND round = ?",
        )
        .bind(
          makePassage("quotes", now, "", [], room.duration),
          code,
          player.id,
          input.round,
        ),
      db
        .prepare(
          "UPDATE players SET typed = '', strokes = 0, errors = 0, correct = 0, seq = 0, finished_at = NULL, round = ? WHERE room_code = ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND round = ? AND start_at IS NULL)",
        )
        .bind(next, code, code, next),
    ]);
    if (!updates[0].meta.changes)
      throw new ApiError(
        409,
        "The next round is already open. Refresh the room.",
      );
  }
  if (input.action === "reclaim") {
    await db
      .prepare(
        "UPDATE rooms SET host_id = ? WHERE code = ? AND host_id = ? AND EXISTS (SELECT 1 FROM players WHERE id = ? AND seen_at < ?)",
      )
      .bind(player.id, code, room.host_id, room.host_id, now - 30000)
      .run();
  }
  if (input.action === "leave") {
    await db.batch([
      db
        .prepare(
          "UPDATE rooms SET host_id = COALESCE((SELECT id FROM players WHERE room_code = ? AND id != ? ORDER BY joined_at, id LIMIT 1), host_id) WHERE code = ? AND host_id = ?",
        )
        .bind(code, player.id, code, player.id),
      db
        .prepare("DELETE FROM players WHERE id = ? AND room_code = ?")
        .bind(player.id, code),
      db
        .prepare(
          "DELETE FROM rooms WHERE code = ? AND NOT EXISTS (SELECT 1 FROM players WHERE room_code = ?)",
        )
        .bind(code, code),
    ]);
    return reply({ left: true });
  }
  if (input.action === "sync") {
    if (input.round !== room.round)
      throw new ApiError(409, "The room has moved to a new round.");
    const elapsed = room.start_at === null ? 0 : now - room.start_at;
    if (
      elapsed >= 0 &&
      room.start_at !== null &&
      elapsed <= room.duration * 1000 + 2000 &&
      player.finished_at === null
    ) {
      const correct = correctPrefix(input.typed, room.passage);
      if (input.seq > player.seq) {
        if (
          input.errors > input.strokes ||
          input.strokes < input.typed.length ||
          input.strokes < player.strokes ||
          input.errors < player.errors
        )
          throw new ApiError(400, "Invalid typing progress.");
        if (correct > Math.max(30, (elapsed / 60000) * 400 * 5))
          throw new ApiError(
            400,
            "Progress arrived too quickly. Type the passage without pasting.",
          );
        const finishedAt =
          correct === room.passage.length
            ? Math.min(now, room.start_at + room.duration * 1000)
            : null;
        await db
          .prepare(
            "UPDATE players SET typed = ?, strokes = ?, errors = ?, correct = ?, seq = ?, finished_at = ?, seen_at = ? WHERE id = ? AND room_code = ? AND round = ? AND seq < ? AND finished_at IS NULL",
          )
          .bind(
            input.typed,
            input.strokes,
            input.errors,
            correct,
            input.seq,
            finishedAt,
            now,
            player.id,
            code,
            room.round,
            input.seq,
          )
          .run();
      }
    }
    await db
      .prepare("UPDATE players SET seen_at = ? WHERE id = ? AND room_code = ?")
      .bind(now, player.id, code)
      .run();
  }
  room = await getRoom(code);
  return reply({ room: await snapshot(room) });
}
