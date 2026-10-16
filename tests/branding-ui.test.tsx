import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CodePace from "../app/codepace";

test("the CodePace rename preserves previous results, profile, code and audio preferences", async () => {
  localStorage.clear();
  sessionStorage.clear();
  const result = {
    id: "legacy-result",
    date: new Date().toISOString(),
    mode: "Race",
    duration: 30,
    wpm: 42,
    accuracy: 98,
    correct: 105,
    errors: 2,
    consistency: 90,
    samples: [40, 44],
    missed: { a: 2 },
  };
  const settings = {
    name: "Ada",
    avatarSeed: "saved-avatar",
    pace: 85,
    sound: false,
    light: true,
  };
  const coding = {
    language: "rust",
    kind: "snippets",
    snippet: 0,
    problemId: "0001-two-sum",
  };
  const music = { enabled: false, volume: 0.35 };
  for (const [key, value] of Object.entries({
    history: [result],
    "settings:v2": settings,
    "coding:v1": coding,
    "music:v1": music,
  })) {
    localStorage.setItem(`keylane:${key}`, JSON.stringify(value));
  }
  try {
    await act(async () => {
      render(<CodePace />);
    });
    assert.ok(screen.getByRole("button", { name: "CodePace home" }));
    await waitFor(() => {
      assert.deepEqual(JSON.parse(localStorage.getItem("codepace:history")!), [
        result,
      ]);
      assert.deepEqual(
        JSON.parse(localStorage.getItem("codepace:settings:v2")!),
        settings,
      );
      assert.deepEqual(
        JSON.parse(localStorage.getItem("codepace:coding:v1")!),
        coding,
      );
      assert.deepEqual(
        JSON.parse(localStorage.getItem("codepace:music:v1")!),
        music,
      );
    });
    assert.ok(
      screen
        .getByRole("combobox", { name: "Language" })
        .textContent?.includes("Rust"),
    );
    assert.equal(document.documentElement.dataset.theme, "light");
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    assert.ok(screen.getByRole("cell", { name: "42 wpm" }));
  } finally {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
});
