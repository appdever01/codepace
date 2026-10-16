import type { RoomContent } from "./room-content.ts";

export type RoomPlayer = {
  id: string;
  name: string;
  joinedAt: number;
  seenAt: number;
  round: number;
  correct: number;
  strokes: number;
  errors: number;
  finishedAt: number | null;
  wpm: number;
  accuracy: number;
};
export type RoomSnapshot = {
  code: string;
  hostId: string;
  round: number;
  passage: string;
  content?: RoomContent;
  revision: number;
  duration: number;
  startAt: number | null;
  serverNow: number;
  expiresAt: number;
  phase: "lobby" | "countdown" | "running" | "finished";
  players: RoomPlayer[];
};
export type RoomSession = { code: string; id: string; token: string };
