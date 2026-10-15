import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInput,
  botProgress,
  consistency,
  emptyTyping,
  localDay,
  readHistory,
  stats,
} from "../lib/race.ts";
import { accuracy, correctPrefix, wpm } from "../lib/scoring.ts";
import { makePassage } from "../lib/passages.ts";
import { dailyPassage } from "../lib/daily.ts";

test("speed uses five correct characters per word and avoids an initial spike", () => {
  assert.equal(wpm(250, 30000), 100);
  assert.equal(wpm(1, 1), 6);
  assert.equal(wpm(1, 0), 0);
  assert.equal(wpm(0, 30000), 0);
});
test("corrected errors still count against accuracy", () => {
  let state = applyInput(emptyTyping(), "c", "cat");
  state = applyInput(state, "cx", "cat");
  assert.equal(stats(state, "cat", 10000).correct, 1);
  state = applyInput(state, "c", "cat");
  state = applyInput(state, "cat", "cat");
  assert.equal(state.errors, 1);
  assert.equal(state.strokes, 4);
  assert.equal(stats(state, "cat", 10000).accuracy, 75);
  assert.equal(state.missed.a, 1);
  assert.equal(correctPrefix(state.typed, "cat"), 3);
  assert.equal(state.streak, 2);
  assert.equal(state.bestStreak, 2);
});

test("clean-key streaks stop on errors and do not grow behind an unresolved mistake", () => {
  let state = applyInput(emptyTyping(), "typing", "typing practice");
  assert.equal(state.streak, 6);
  state = applyInput(state, "typingXpractice", "typing practice");
  assert.equal(state.streak, 0);
  assert.equal(state.bestStreak, 6);
  assert.equal(
    dailyPassage(new Date(2026, 9, 15, 9)),
    dailyPassage(new Date(2026, 9, 15, 21)),
  );
  assert.notEqual(
    dailyPassage(new Date(2026, 9, 15)),
    dailyPassage(new Date(2026, 9, 16)),
  );
});
test("edits in the middle cannot skip a mistake and typing is capped at passage length", () => {
  const state = applyInput(emptyTyping(), "wrong", "right");
  assert.deepEqual(applyInput(state, "right", "right"), state);
  assert.equal(
    applyInput(emptyTyping(), "right extra", "right").typed,
    "right",
  );
  assert.equal(accuracy(0, 0), 100);
});
test("pace bots stop at the passage end and never move before the start", () => {
  assert.equal(botProgress(60, 30000, 1000), 150);
  assert.equal(botProgress(60, -1, 1000), 0);
  assert.equal(botProgress(60, 60000, 20), 20);
});
test("consistency distinguishes steady and uneven races", () => {
  assert.equal(consistency([60, 60, 60]), 100);
  assert.ok(consistency([10, 100, 10]) < 50);
  assert.equal(consistency([0, 0]), 0);
});
test("damaged or unexpected saved history cannot break the app", () => {
  assert.deepEqual(readHistory("broken"), []);
  assert.deepEqual(readHistory("{}"), []);
  assert.deepEqual(readHistory('[null, 2, {}, {"wpm": "100"}]'), []);
  assert.equal(localDay(new Date(2026, 9, 15)), "2026-9-15");
});

test("race passages fit the selected time and custom Unicode text remains intact", () => {
  const short = makePassage("quotes", 74, "", [], 15);
  const long = makePassage("quotes", 74, "", [], 60);
  assert.ok(short.length >= 100 && short.length <= 150);
  assert.ok(long.length > short.length && long.length <= 600);
  assert.equal(short, makePassage("quotes", 74, "", [], 15));
  assert.equal(
    makePassage("custom", 74, "  Hello 🌍\nagain!  "),
    "Hello 🌍 again!",
  );
  assert.ok(makePassage("words", 74, "", ["q"], 30).length > 100);
});
