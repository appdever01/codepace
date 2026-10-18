import test from "node:test";
import assert from "node:assert/strict";
import {
  BAN_STORAGE_KEY,
  destroyLocalPlay,
  fairCharacterLimit,
  isBanned,
  isImpossibleProgress,
  MAX_FAIR_WPM,
} from "../lib/fair-play.ts";
import { roomRaceFinished, roomTimedOut } from "../lib/room-race.ts";

test("200 wpm or faster is treated as automated typing", () => {
  assert.equal(isImpossibleProgress(0, 30000), false);
  assert.equal(isImpossibleProgress(50, 15000), false);
  assert.equal(isImpossibleProgress(250, 30000), false);
  assert.equal(isImpossibleProgress(250, 15000), true);
  assert.equal(isImpossibleProgress(50, 500), false);
  assert.equal(isImpossibleProgress(120, 500), false);
  assert.equal(isImpossibleProgress(58, 2000), true);
  assert.equal(MAX_FAIR_WPM, 200);
  assert.ok(fairCharacterLimit(60000) >= 1000);
});

test("a friend room stays open until every connected racer finishes", () => {
  const now = 1_000_000;
  assert.equal(
    roomRaceFinished({
      startAt: now - 2000,
      now,
      players: [
        { finishedAt: now - 500, seenAt: now },
        { finishedAt: null, seenAt: now },
      ],
    }),
    false,
  );
  assert.equal(
    roomRaceFinished({
      startAt: now - 2000,
      now,
      players: [
        { finishedAt: now - 500, seenAt: now },
        { finishedAt: now - 200, seenAt: now },
      ],
    }),
    true,
  );
  assert.equal(
    roomRaceFinished({
      startAt: now - 2000,
      now,
      players: [
        { finishedAt: now - 500, seenAt: now },
        { finishedAt: null, seenAt: now - 60_000 },
      ],
    }),
    true,
  );
  assert.equal(
    roomRaceFinished({
      startAt: now - 45_000,
      now,
      players: [
        { finishedAt: now - 1000, seenAt: now },
        { finishedAt: null, seenAt: now },
      ],
    }),
    false,
  );
  assert.equal(roomTimedOut(now - 45_000, 30, now), true);
});

test("a banned session wipes local play data", () => {
  const store = new Map<string, string>([
    ["codepace:history", "[]"],
    ["codepace:settings:v2", "{}"],
    ["keylane:history", "[]"],
  ]);
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  const session = {
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  destroyLocalPlay(storage, session);
  assert.equal(isBanned(storage), true);
  assert.equal(store.get("codepace:history"), undefined);
  assert.equal(store.get("keylane:history"), undefined);
  assert.equal(store.get(BAN_STORAGE_KEY), "1");
});
