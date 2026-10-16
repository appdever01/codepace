import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import RaceResults from "../components/race-results";
import CodePace from "../app/codepace";
import type { RaceResult } from "../lib/race";

const result: RaceResult = {
  id: "result-one",
  date: "2026-10-16T00:00:00.000Z",
  mode: "Race",
  duration: 15,
  wpm: 48,
  accuracy: 96.8,
  correct: 60,
  errors: 2,
  consistency: 84,
  samples: [24, 36, 48, 45],
  missed: { a: 2 },
};

test("an untouched timed round shows a retry state without scores, placing, reward or a zero chart", async () => {
  const clock = Date.now;
  let offset = 0;
  Date.now = () => clock() + offset;
  const tick = async (milliseconds: number) => {
    offset += milliseconds;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 130));
    });
  };
  try {
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => {
      render(<CodePace />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    fireEvent.click(screen.getByRole("button", { name: "Race" }));
    fireEvent.click(screen.getByRole("button", { name: "15 s" }));
    fireEvent.click(screen.getByRole("button", { name: /Start race/ }));
    await tick(3100);
    await tick(15000);
    const summary = screen.getByRole("region", { name: "Your result" });
    assert.ok(
      within(summary).getByRole("heading", { name: "No typing recorded" }),
    );
    assert.equal(summary.querySelector(".result-scoreboard"), null);
    assert.equal(summary.querySelector(".result-context"), null);
    assert.equal(summary.querySelector(".result-award"), null);
    assert.equal(within(summary).queryByRole("img"), null);
    assert.ok(within(summary).getByText(/No result was saved/));
    assert.deepEqual(
      JSON.parse(localStorage.getItem("codepace:history") || "[]"),
      [],
    );
    fireEvent.click(screen.getByRole("button", { name: /Race again/ }));
    assert.equal(screen.queryByRole("region", { name: "Your result" }), null);
    assert.ok(document.querySelector(".countdown"));
  } finally {
    Date.now = clock;
    cleanup();
  }
});

test("a recorded result keeps the exact scores, placement, sampled pace and room content", () => {
  try {
    render(
      <RaceResults
        result={result}
        attempted
        practice={false}
        placement={{ position: 2, total: 4 }}
        previousBest={60}
      >
        <h3>Final standings</h3>
      </RaceResults>,
    );
    const summary = screen.getByRole("region", { name: "Your result" });
    assert.ok(within(summary).getByRole("heading", { name: "Race complete" }));
    assert.equal(
      summary.querySelector(".result-speed strong")?.textContent,
      "48WPM",
    );
    const metrics = [...summary.querySelectorAll(".result-details > div")].map(
      (row) => row.textContent,
    );
    assert.deepEqual(metrics, [
      "Accuracy96.8%",
      "Consistency84%",
      "Correct characters60",
      "Mistakes2",
    ]);
    assert.ok(within(summary).getByText("Position 2 of 4"));
    const chart = within(summary).getByRole("img", {
      name: /24, 36, 48, 45 words per minute/,
    });
    const line = chart.querySelector(".result-pace-line")!;
    const positions = line
      .getAttribute("d")!
      .slice(1)
      .split(" L")
      .map((point) => point.split(",").map(Number));
    assert.equal(positions.length, result.samples.length);
    for (const [index, [x, y]] of positions.entries()) {
      assert.equal(x, (index / 3) * 600);
      assert.ok(Math.abs(((96 - y) / 88) * 48 - result.samples[index]) < 0.001);
    }
    assert.ok(
      within(summary).getByRole("heading", { name: "Final standings" }),
    );
    assert.equal(summary.querySelector(".result-award"), null);
  } finally {
    cleanup();
  }
});

test("a personal best gets the reward while real zero measurements and short attempts remain honest", () => {
  try {
    const view = render(
      <RaceResults
        result={result}
        attempted
        practice={false}
        previousBest={40}
      />,
    );
    assert.ok(screen.getByText("Personal best"));
    assert.ok(view.container.querySelector(".result-award"));
    view.rerender(
      <RaceResults
        result={{
          ...result,
          wpm: 0,
          accuracy: 0,
          correct: 0,
          consistency: 0,
          samples: [0],
        }}
        attempted
        practice
        code={{ completed: false, length: 400, fromLibrary: true }}
        previousBest={40}
      />,
    );
    const summary = screen.getByRole("region", { name: "Your result" });
    assert.ok(
      within(summary).getByRole("heading", { name: "Practice time complete." }),
    );
    assert.ok(within(summary).getByText(/0 of 400 characters typed correctly/));
    assert.equal(
      summary.querySelector(".result-speed strong")?.textContent,
      "0WPM",
    );
    assert.equal(
      summary.querySelector(".result-details dd")?.textContent,
      "0%",
    );
    assert.equal(within(summary).queryByRole("img"), null);
    assert.equal(summary.querySelector(".result-award"), null);
    assert.equal(summary.querySelector(".result-context"), null);
    view.rerender(
      <RaceResults
        result={null}
        attempted={false}
        practice
        previousBest={40}
      />,
    );
    assert.ok(screen.getByRole("heading", { name: "No typing recorded" }));
  } finally {
    cleanup();
  }
});
