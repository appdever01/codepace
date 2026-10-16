import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateTime,
  MAX_SCHEDULE_AHEAD_MS,
  parseLocalDateTime,
  ROOM_COUNTDOWN_MS,
  scheduleProblem,
  scheduledStartTime,
} from "../lib/room-schedule.ts";

test("schedules require a real future timestamp within seven days", () => {
  const now = 1792150000000;
  for (const value of [
    NaN,
    Infinity,
    0,
    now - 1,
    now + 9999,
    now + 10000.5,
    now + MAX_SCHEDULE_AHEAD_MS + 1,
  ])
    assert.ok(scheduleProblem(value, now));
  assert.equal(scheduleProblem(now + 10000, now), null);
  assert.equal(scheduleProblem(now + MAX_SCHEDULE_AHEAD_MS, now), null);
});

test("scheduled rooms wait for two connected players and use one shared start time", () => {
  const now = 1792150000000;
  assert.equal(scheduledStartTime(null, 50, now), null);
  assert.equal(scheduledStartTime(now + 5000, 50, now), null);
  assert.equal(scheduledStartTime(now + 4000, 1, now), null);
  assert.equal(scheduledStartTime(now + 4000, 2, now), now + 4000);
  assert.equal(scheduledStartTime(now + 1000, 50, now), now + 1000);
  assert.equal(scheduledStartTime(now - 10000, 1, now), null);
  assert.equal(
    scheduledStartTime(now - 10000, 2, now),
    now + ROOM_COUNTDOWN_MS,
  );
});

test("local start times round trip across time zones without shifting the selected clock time", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Africa/Lagos", "America/New_York"]) {
      process.env.TZ = timezone;
      const value = "2026-10-16T22:00";
      const timestamp = parseLocalDateTime(value);
      assert.ok(Number.isFinite(timestamp));
      assert.equal(localDateTime(timestamp), value);
      assert.equal(new Date(timestamp).getHours(), 22);
      for (const invalid of [
        "",
        "invalid",
        "2026-02-31T22:00",
        "2026-10-16T25:00",
      ])
        assert.ok(Number.isNaN(parseLocalDateTime(invalid)));
    }
    process.env.TZ = "America/New_York";
    assert.ok(Number.isNaN(parseLocalDateTime("2026-03-08T02:30")));
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
