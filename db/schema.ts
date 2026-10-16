import { pgTable, text, integer, bigint, index } from "drizzle-orm/pg-core";

export const rooms = pgTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    hostId: text("host_id").notNull(),
    passage: text("passage").notNull(),
    duration: integer("duration").notNull(),
    round: integer("round").notNull().default(1),
    revision: integer("revision").notNull().default(1),
    startAt: bigint("start_at", { mode: "number" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (table) => [index("rooms_expiry_idx").on(table.expiresAt)],
);

export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code")
      .notNull()
      .references(() => rooms.code, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull(),
    joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
    seenAt: bigint("seen_at", { mode: "number" }).notNull(),
    round: integer("round").notNull().default(1),
    typed: text("typed").notNull().default(""),
    strokes: integer("strokes").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    finishedAt: bigint("finished_at", { mode: "number" }),
    seq: integer("seq").notNull().default(0),
  },
  (table) => [
    index("players_room_idx").on(table.roomCode),
    index("players_session_idx").on(table.roomCode, table.tokenHash),
  ],
);

export const limits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (table) => [index("limits_expiry_idx").on(table.expiresAt)],
);
