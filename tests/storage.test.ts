import test from "node:test";
import assert from "node:assert/strict";
import { readSavedValue, removeSavedValue } from "../lib/storage.ts";

test("CodePace reads legacy data and gives current values precedence", () => {
  const values = new Map<string, string>([["keylane:history", "old results"]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  assert.equal(readSavedValue(storage, "codepace:history"), "old results");
  values.set("codepace:history", "[]");
  assert.equal(readSavedValue(storage, "codepace:history"), "[]");
  values.set("codepace:history", "");
  assert.equal(readSavedValue(storage, "codepace:history"), "");
  assert.equal(readSavedValue(storage, "codepace:settings:v2"), null);
});

test("leaving a room removes both current and legacy sessions", () => {
  const values = new Map<string, string>([
    ["keylane:room", "old session"],
    ["codepace:room", "current session"],
    ["codepace:history", "saved results"],
  ]);
  removeSavedValue(
    {
      removeItem: (key) => {
        values.delete(key);
      },
    },
    "codepace:room",
  );
  assert.equal(values.has("keylane:room"), false);
  assert.equal(values.has("codepace:room"), false);
  assert.equal(values.get("codepace:history"), "saved results");
});
