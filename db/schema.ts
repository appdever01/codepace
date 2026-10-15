import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable(
  "rooms",
  {
    code: text("code").primaryKey(),
    hostId: text("host_id").notNull(),
    passage: text("passage").notNull(),
    duration: integer("duration").notNull(),
    round: integer("round").notNull().default(1),
    startAt: integer("start_at"),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("rooms_expiry_idx").on(table.expiresAt)],
);

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code")
      .notNull()
      .references(() => rooms.code, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull(),
    joinedAt: integer("joined_at").notNull(),
    seenAt: integer("seen_at").notNull(),
    round: integer("round").notNull().default(1),
    typed: text("typed").notNull().default(""),
    strokes: integer("strokes").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    finishedAt: integer("finished_at"),
    seq: integer("seq").notNull().default(0),
  },
  (table) => [index("players_room_idx").on(table.roomCode)],
);

export const limits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("limits_expiry_idx").on(table.expiresAt)],
);
