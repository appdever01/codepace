import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import CodePace from "../app/codepace";

test("a 15-second race records clean-key streaks without the daily sprint", async () => {
  const clock = Date.now;
  let offset = 0;
  Date.now = () => clock() + offset;
  const tick = async (time: number) => {
    offset += time;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 130));
    });
  };
  try {
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => {
      render(<CodePace />);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    fireEvent.click(screen.getByRole("button", { name: "Race" }));
    assert.equal(screen.queryByRole("heading", { name: "Daily sprint" }), null);
    assert.equal(
      screen.queryByRole("button", { name: "Try today’s sprint" }),
      null,
    );
    assert.ok(screen.getByRole("heading", { name: "Your personal best" }));
    assert.ok(screen.getByRole("heading", { name: "Recent races" }));
    fireEvent.click(screen.getByRole("button", { name: "15 s" }));
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    const text = input.labels![0].textContent!.replace(
      "Type this passage: ",
      "",
    );
    fireEvent.click(screen.getByRole("button", { name: /Start race/ }));
    await tick(3100);
    fireEvent.change(input, { target: { value: text.slice(0, 50) } });
    assert.equal(document.querySelector(".combo-chip b")?.textContent, "50");
    await tick(15000);
    const history = JSON.parse(localStorage.getItem("codepace:history")!);
    assert.equal(history[0].mode, "Race");
    assert.equal(history[0].wpm, 40);
    assert.equal(history[0].accuracy, 100);
    assert.equal(history[0].bestStreak, 50);
    fireEvent.click(screen.getByRole("button", { name: /Race again/ }));
    const next = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    assert.equal(next.disabled, true);
    assert.equal(screen.queryByRole("heading", { name: "Daily sprint" }), null);
  } finally {
    Date.now = clock;
    cleanup();
  }
});
