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
import CodePace from "../app/codepace";

test("Code is the first navigation item, opens by default and is the home destination", async () => {
  localStorage.clear();
  sessionStorage.clear();
  try {
    await act(async () => {
      render(<CodePace />);
    });
    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    assert.deepEqual(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent),
      ["Code", "Race", "Practice", "Friends", "Progress"],
    );
    assert.equal(
      within(navigation)
        .getByRole("button", { name: "Code" })
        .getAttribute("aria-current"),
      "page",
    );
    assert.ok(
      screen.getByRole("heading", { name: "Code typing practice", level: 1 }),
    );
    assert.ok(document.querySelector(".coding-panel"));
    assert.ok(screen.getByRole("button", { name: "Full code" }));
    assert.equal(screen.queryByRole("button", { name: "Passages" }), null);
    fireEvent.click(within(navigation).getByRole("button", { name: "Race" }));
    assert.ok(screen.getByRole("heading", { name: "Typing race", level: 1 }));
    assert.ok(screen.getByRole("button", { name: "30 s" }));
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Practice" }),
    );
    assert.ok(screen.getByRole("button", { name: "Custom" }));
    assert.equal(document.querySelector(".coding-panel"), null);
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Progress" }),
    );
    assert.ok(screen.getByRole("heading", { name: "Your progress." }));
    assert.equal(document.querySelector(".code-main"), null);
    fireEvent.click(screen.getByRole("button", { name: /home$/ }));
    assert.ok(
      screen.getByRole("heading", { name: "Code typing practice", level: 1 }),
    );
    assert.ok(screen.getByRole("button", { name: "Full code" }));
  } finally {
    cleanup();
  }
});

test("a friend invitation still opens the room entry screen instead of Code", async () => {
  localStorage.clear();
  sessionStorage.clear();
  try {
    await act(async () => {
      render(<CodePace initialRoom="ABC234" />);
    });
    assert.equal(
      screen
        .getByRole("button", { name: "Friends" })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      (screen.getByLabelText("Room code") as HTMLInputElement).value,
      "ABC234",
    );
    assert.equal(document.querySelector(".coding-panel"), null);
    assert.equal(document.querySelector(".code-main"), null);
  } finally {
    cleanup();
  }
});
