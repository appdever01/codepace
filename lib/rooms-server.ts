import { timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { getPool } from "../db/index";
import { makeRoomPassage, type RoomContent } from "./room-content";
import { roomContentSchema } from "./room-content-schema";
import { correctPrefix, wpm, accuracy } from "./scoring";
import type { RoomSnapshot } from "./room-types";
import { ROOM_CAPACITY } from "./room-limits";
import {
  ROOM_COUNTDOWN_MS,
  scheduleProblem,
  scheduledStartTime,
} from "./room-schedule";

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
type StoredRoom = {
  code: string;
  host_id: string;
  passage: string;
  content: RoomContent;
  duration: number;
  round: number;
  revision: number;
  start_at: number | null;
  scheduled_at: number | null;
  created_at: number;
  expires_at: number;
  players: StoredPlayer[];
};
type Queryable = Pick<PoolClient, "query">;
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
  z.object({
    action: z.literal("configure"),
    round: z.number().int().positive(),
    content: roomContentSchema,
    duration: durationSchema,
  }),
  z.object({ action: z.literal("start"), round: z.number().int().positive() }),
  z.object({
    action: z.literal("schedule"),
    round: z.number().int().positive(),
    scheduledAt: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("cancel_schedule"),
    round: z.number().int().positive(),
  }),
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
    throw new ApiError(403, "Open CodePace directly to use friend rooms.");
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
  const ip =
    request.headers
      .get(process.env.VERCEL ? "x-vercel-forwarded-for" : "x-forwarded-for")
      ?.split(",")[0]
      .trim() || "local";
  const now = Date.now();
  const key = await hash(`${bucket}:${ip}:${Math.floor(now / 3600000)}`);
  const { rows } = await getPool().query<{ count: number }>(
    "INSERT INTO rate_limits (key, count, expires_at) VALUES ($1, 1, $2) ON CONFLICT(key) DO UPDATE SET count = rate_limits.count + 1 RETURNING count",
    [key, now + 3600000],
  );
  if (rows[0].count > maximum)
    throw new ApiError(429, "Too many attempts. Try again in an hour.");
}
function checkCode(code: string) {
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new ApiError(404, "Room not found. Check the six-character code.");
}
async function getRoom(code: string, db: Queryable = getPool(), lock = false) {
  checkCode(code);
  if (lock)
    await db.query("SELECT code FROM rooms WHERE code = $1 FOR UPDATE", [code]);
  const { rows } = await db.query<StoredRoom>(
    `SELECT r.*, COALESCE(json_agg(p ORDER BY p.joined_at, p.id) FILTER (WHERE p.id IS NOT NULL), '[]') AS players
     FROM rooms r LEFT JOIN players p ON p.room_code = r.code
     WHERE r.code = $1 AND r.expires_at > $2 GROUP BY r.code`,
    [code, Date.now()],
  );
  if (!rows[0])
    throw new ApiError(
      404,
      "This room has expired or does not exist. Create a new one.",
    );
  return rows[0];
}
async function member(request: Request, room: StoredRoom) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.length > 200)
    throw new ApiError(401, "Join this room to continue.");
  const digest = Buffer.from(await hash(token));
  const player = room.players.find((candidate) => {
    const stored = Buffer.from(candidate.token_hash);
    return stored.length === digest.length && timingSafeEqual(stored, digest);
  });
  if (!player)
    throw new ApiError(401, "Your room session has ended. Join again.");
  return player;
}
async function startScheduledRoom(
  room: StoredRoom,
  db: Queryable,
  now: number,
) {
  if (room.start_at !== null) return;
  const startAt = scheduledStartTime(
    room.scheduled_at,
    room.players.filter((player) => player.seen_at > now - 30000).length,
    now,
  );
  if (startAt === null) return;
  const { rows } = await db.query<{ revision: number }>(
    "UPDATE rooms SET start_at = $1, expires_at = GREATEST(expires_at, $1 + 7200000::bigint), revision = revision + 1 WHERE code = $2 RETURNING revision",
    [startAt, room.code],
  );
  room.start_at = startAt;
  room.expires_at = Math.max(room.expires_at, startAt + 7200000);
  room.revision = rows[0].revision;
}
function snapshot(room: StoredRoom): RoomSnapshot {
  const now = Date.now();
  const started = room.start_at !== null && now >= room.start_at;
  const finished =
    started &&
    (now >= room.start_at! + room.duration * 1000 ||
      room.players.every((p) => p.finished_at !== null));
  return {
    code: room.code,
    hostId: room.host_id,
    round: room.round,
    revision: room.revision,
    passage: room.passage,
    content: room.content,
    duration: room.duration,
    startAt: room.start_at,
    scheduledAt: room.scheduled_at,
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
    players: room.players.map((p) => ({
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
async function transaction<T>(operation: (db: PoolClient) => Promise<T>) {
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    const result = await operation(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function handleApi(operation: () => Promise<Response>) {
  const started = performance.now();
  try {
    if (!process.env.DATABASE_URL)
      throw new ApiError(
        503,
        "Friend rooms are temporarily unavailable. Solo races still work.",
      );
    const response = await operation();
    response.headers.set(
      "Server-Timing",
      `app;dur=${(performance.now() - started).toFixed(1)}`,
    );
    return response;
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
    .object({
      name: nameSchema,
      duration: durationSchema,
      content: roomContentSchema.default({ mode: "quotes" }),
    })
    .parse(await body(request));
  await rateLimit(request, "create", 30);
  const now = Date.now();
  await getPool().query(
    "DELETE FROM rooms WHERE code IN (SELECT code FROM rooms WHERE expires_at < $1 LIMIT 100)",
    [now],
  );
  await getPool().query(
    "DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < $1 LIMIT 100)",
    [now],
  );
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const id = crypto.randomUUID();
  const token = secret();
  const tokenHash = await hash(token);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (n) => alphabet[n % alphabet.length],
    ).join("");
    try {
      const room = await transaction(async (db) => {
        await db.query(
          "INSERT INTO rooms (code, host_id, passage, duration, created_at, expires_at, content) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            code,
            id,
            makeRoomPassage(input.content, now, input.duration),
            input.duration,
            now,
            now + 7200000,
            JSON.stringify(input.content),
          ],
        );
        await db.query(
          "INSERT INTO players (id, room_code, token_hash, name, joined_at, seen_at) VALUES ($1, $2, $3, $4, $5, $5)",
          [id, code, tokenHash, input.name, now],
        );
        return snapshot(await getRoom(code, db));
      });
      return reply({ session: { code, id, token }, room }, 201);
    } catch (error) {
      if ((error as { code?: string }).code !== "23505" || attempt === 3)
        throw error;
    }
  }
  throw new ApiError(503, "Could not create a room. Try again.");
}
export async function readRoom(request: Request, code: string) {
  let room = await getRoom(code);
  let player = await member(request, room);
  if (
    room.start_at === null &&
    room.scheduled_at !== null &&
    room.scheduled_at <= Date.now() + ROOM_COUNTDOWN_MS
  ) {
    const refreshed = await transaction(async (db) => {
      const current = await getRoom(code, db, true);
      const self = await member(request, current);
      await startScheduledRoom(current, db, Date.now());
      return { room: current, player: self };
    });
    room = refreshed.room;
    player = refreshed.player;
  }
  return reply({
    room: snapshot(room),
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
  checkCode(code);
  if (input.action === "join") await rateLimit(request, "join", 100);
  const result = await transaction(async (db) => {
    const room = await getRoom(code, db, true);
    const now = Date.now();
    await startScheduledRoom(room, db, now);
    if (input.action === "join") {
      if (room.start_at !== null || room.players.length >= ROOM_CAPACITY)
        throw new ApiError(
          409,
          "This room is full or racing. Ask the host to open the next round.",
        );
      const id = crypto.randomUUID();
      const token = secret();
      await db.query(
        "INSERT INTO players (id, room_code, token_hash, name, joined_at, seen_at, round) VALUES ($1, $2, $3, $4, $5, $5, $6)",
        [id, code, await hash(token), input.name, now, room.round],
      );
      await db.query(
        "UPDATE rooms SET revision = revision + 1 WHERE code = $1",
        [code],
      );
      const joinedRoom = await getRoom(code, db);
      await startScheduledRoom(joinedRoom, db, Date.now());
      return {
        session: { code, id, token },
        room: snapshot(joinedRoom),
      };
    }
    const player = await member(request, room);
    let changed = false;
    if ("round" in input && input.round !== room.round)
      throw new ApiError(409, "The room has moved to a new round.");
    if (input.action === "configure") {
      if (player.id !== room.host_id)
        throw new ApiError(403, "Only the host can choose the room content.");
      if (room.start_at !== null)
        throw new ApiError(409, "Change the selection before the race starts.");
      if (room.scheduled_at !== null)
        throw new ApiError(
          409,
          "Cancel the scheduled start before changing the selection.",
        );
      await db.query(
        "UPDATE rooms SET content = $1, duration = $2, passage = $3 WHERE code = $4",
        [
          JSON.stringify(input.content),
          input.duration,
          makeRoomPassage(input.content, now, input.duration),
          code,
        ],
      );
      changed = true;
    }
    if (input.action === "start") {
      if (player.id !== room.host_id)
        throw new ApiError(403, "Only the host can start the race.");
      if (
        room.start_at !== null ||
        room.players.filter((p) => p.seen_at > now - 30000).length < 2
      )
        throw new ApiError(
          409,
          "Wait for two connected racers, or refresh the room.",
        );
      await db.query(
        "UPDATE rooms SET start_at = $1, expires_at = CASE WHEN scheduled_at IS NOT NULL THEN $1 + 7200000::bigint ELSE expires_at END, scheduled_at = NULL WHERE code = $2",
        [now + ROOM_COUNTDOWN_MS, code],
      );
      changed = true;
    }
    if (input.action === "schedule" || input.action === "cancel_schedule") {
      if (player.id !== room.host_id)
        throw new ApiError(403, "Only the host can schedule the race.");
      if (room.start_at !== null)
        throw new ApiError(409, "The countdown has already started.");
      if (input.action === "schedule") {
        const problem = scheduleProblem(input.scheduledAt, now);
        if (problem) throw new ApiError(400, problem);
        await db.query(
          "UPDATE rooms SET scheduled_at = $1, expires_at = $1 + 7200000::bigint WHERE code = $2",
          [input.scheduledAt, code],
        );
      } else {
        await db.query(
          "UPDATE rooms SET scheduled_at = NULL, expires_at = $1 WHERE code = $2",
          [now + 7200000, code],
        );
      }
      changed = true;
    }
    if (input.action === "rematch") {
      if (player.id !== room.host_id)
        throw new ApiError(403, "Only the host can open the next round.");
      if (snapshot(room).phase !== "finished")
        throw new ApiError(409, "Finish this race first.");
      await db.query(
        "UPDATE rooms SET start_at = NULL, scheduled_at = NULL, round = round + 1, passage = $1 WHERE code = $2",
        [makeRoomPassage(room.content, now, room.duration), code],
      );
      await db.query(
        "UPDATE players SET typed = '', strokes = 0, errors = 0, correct = 0, seq = 0, finished_at = NULL, round = $1 WHERE room_code = $2",
        [room.round + 1, code],
      );
      changed = true;
    }
    if (input.action === "reclaim") {
      if (
        !room.players.some(
          (p) => p.id === room.host_id && p.seen_at >= now - 30000,
        )
      ) {
        await db.query("UPDATE rooms SET host_id = $1 WHERE code = $2", [
          player.id,
          code,
        ]);
        changed = true;
      }
    }
    if (input.action === "leave") {
      await db.query("DELETE FROM players WHERE id = $1 AND room_code = $2", [
        player.id,
        code,
      ]);
      const remaining = room.players
        .filter((p) => p.id !== player.id)
        .sort(
          (a, b) =>
            Number(b.seen_at >= now - 30000) -
              Number(a.seen_at >= now - 30000) ||
            a.joined_at - b.joined_at ||
            a.id.localeCompare(b.id),
        );
      if (!remaining.length)
        await db.query("DELETE FROM rooms WHERE code = $1", [code]);
      else
        await db.query(
          "UPDATE rooms SET host_id = $1, revision = revision + 1 WHERE code = $2",
          [player.id === room.host_id ? remaining[0].id : room.host_id, code],
        );
      return { left: true };
    }
    if (input.action === "sync") {
      const elapsed = room.start_at === null ? -1 : now - room.start_at;
      if (
        elapsed >= 0 &&
        elapsed <= room.duration * 1000 + 2000 &&
        player.finished_at === null &&
        input.seq > player.seq
      ) {
        if (
          input.errors > input.strokes ||
          input.strokes < input.typed.length ||
          input.strokes < player.strokes ||
          input.errors < player.errors
        )
          throw new ApiError(400, "Invalid typing progress.");
        const correct = correctPrefix(input.typed, room.passage);
        if (correct > Math.max(30, (elapsed / 60000) * 400 * 5))
          throw new ApiError(
            400,
            "Progress arrived too quickly. Type the passage without pasting.",
          );
        const finishedAt =
          correct === room.passage.length
            ? Math.min(now, room.start_at! + room.duration * 1000)
            : null;
        if (
          input.typed !== player.typed ||
          input.strokes !== player.strokes ||
          input.errors !== player.errors
        ) {
          Object.assign(player, {
            typed: input.typed,
            strokes: input.strokes,
            errors: input.errors,
            correct,
            seq: input.seq,
            finished_at: finishedAt,
          });
          changed = true;
        }
      }
      if (changed || player.seen_at < now - 10000) {
        player.seen_at = now;
        const { rows } = await db.query<{ revision: number }>(
          `WITH progress AS (
            UPDATE players SET typed = $1, strokes = $2, errors = $3, correct = $4,
              seq = $5, finished_at = $6, seen_at = $7 WHERE id = $8 AND room_code = $9
            RETURNING id
          )
          UPDATE rooms SET revision = revision + 1
          WHERE code = $9 AND EXISTS (SELECT 1 FROM progress) RETURNING revision`,
          [
            player.typed,
            player.strokes,
            player.errors,
            player.correct,
            player.seq,
            player.finished_at,
            player.seen_at,
            player.id,
            code,
          ],
        );
        if (!rows[0]) throw new Error("Room progress could not be saved.");
        room.revision = rows[0].revision;
      }
      return { room: snapshot(room) };
    }
    if (!changed && player.seen_at < now - 10000) {
      await db.query("UPDATE players SET seen_at = $1 WHERE id = $2", [
        now,
        player.id,
      ]);
      changed = true;
    }
    if (changed)
      await db.query(
        "UPDATE rooms SET revision = revision + 1 WHERE code = $1",
        [code],
      );
    return { room: snapshot(await getRoom(code, db)) };
  });
  return reply(result, input.action === "join" ? 201 : 200);
}
