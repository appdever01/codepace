import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import CodePace from "../app/codepace";
import { BAN_STORAGE_KEY, MAX_FAIR_WPM } from "../lib/fair-play.ts";

test("a stored ban shows the removed session instead of the game", async () => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(BAN_STORAGE_KEY, "1");
  try {
    await act(async () => {
      render(<CodePace />);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    assert.ok(screen.getByRole("heading", { name: "This session was removed." }));
    assert.ok(screen.getByText(new RegExp(`${MAX_FAIR_WPM} wpm`)));
    assert.equal(screen.queryByRole("navigation", { name: "Main navigation" }), null);
  } finally {
    cleanup();
    localStorage.clear();
  }
});

test("dumping a long passage at impossible speed removes the local session", async () => {
  const clock = Date.now;
  let offset = 0;
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  try {
    await act(async () => {
      render(<CodePace />);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    fireEvent.click(screen.getByRole("button", { name: "Race" }));
    fireEvent.click(screen.getByRole("button", { name: /Start race/ }));
    offset += 3100;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 130));
    });
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    const text = input.labels![0].textContent!.replace(
      "Type this passage: ",
      "",
    );
    offset += 2000;
    fireEvent.change(input, { target: { value: text.slice(0, 200) } });
    assert.ok(screen.getByRole("heading", { name: "This session was removed." }));
    assert.equal(localStorage.getItem(BAN_STORAGE_KEY), "1");
    const history = localStorage.getItem("codepace:history");
    assert.ok(history === null || history === "[]");
  } finally {
    Date.now = clock;
    cleanup();
    localStorage.clear();
  }
});
