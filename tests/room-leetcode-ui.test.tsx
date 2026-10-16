import test from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CodePace from "../app/codepace";
import RoomSetup from "../components/room-setup";
import { roomProblems } from "../lib/room-problems";
import type { RoomContent } from "../lib/room-content";
import type { RoomSession } from "../lib/room-types";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function choose(label: string, value: string | RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: value }));
}

test("room library search keeps the selection, supports keyboard choice and recovers from unavailable languages", () => {
  const problem = roomProblems("python").find(
    (entry) => !entry.languages.includes("rust"),
  )!;
  function Setup() {
    const [content, setContent] = useState<RoomContent>({
      mode: "code",
      language: "python",
      snippet: 0,
      problemId: problem.id,
    });
    return (
      <RoomSetup
        content={content}
        duration={30}
        disabled={false}
        onChange={setContent}
      />
    );
  }
  try {
    render(<Setup />);
    assert.ok(
      screen
        .getByRole("combobox", { name: "Problem" })
        .textContent?.includes(problem.title),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search problems" }),
      { target: { value: "no-such-problem" } },
    );
    assert.match(
      screen.getByRole("status").textContent || "",
      /No matching problems/,
    );
    assert.ok(
      screen
        .getByRole("combobox", { name: "Problem" })
        .textContent?.includes(problem.title),
    );
    choose("Language", "Rust");
    assert.ok(
      screen
        .getByRole("combobox", { name: "Problem" })
        .textContent?.includes("Two Sum"),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search problems" }),
      { target: { value: "contains duplicate" } },
    );
    const select = screen.getByRole("combobox", { name: "Problem" });
    fireEvent.keyDown(select, { key: "End" });
    fireEvent.keyDown(select, { key: "Enter" });
    assert.ok(select.textContent?.includes("Contains Duplicate"));
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.keyDown(select, { key: "Escape" });
    assert.equal(select.getAttribute("aria-expanded"), "false");
    assert.equal(document.querySelectorAll("select").length, 0);
    choose("Exercise", "Functions");
    assert.equal(
      Boolean(screen.queryByRole("combobox", { name: "Problem" })),
      false,
    );
    choose("Exercise", "Your code");
    const code = "fn custom() { return 123; }";
    fireEvent.change(screen.getByRole("textbox", { name: "Your code" }), {
      target: { value: code },
    });
    choose("Exercise", "Functions");
    choose("Exercise", "Your code");
    assert.equal(
      (
        screen.getByRole("textbox", {
          name: "Your code",
        }) as HTMLTextAreaElement
      ).value,
      code,
    );
  } finally {
    cleanup();
  }
});

test("host creates a LeetCode room, applies another problem and a guest restores its code and source", async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    nativeFetch(
      typeof input === "string" ? new URL(input, origin) : input,
      init,
    );
  let host: RoomSession | undefined;
  let guest: RoomSession | undefined;
  try {
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => {
      render(<CodePace />);
      await pause(20);
    });
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    fireEvent.change(screen.getByLabelText("Your racer name"), {
      target: { value: "LeetCode UI host" },
    });
    choose("Exercise", "LeetCode");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search problems" }),
      { target: { value: "reverse linked list" } },
    );
    choose("Problem", /#206 Reverse Linked List/);
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() =>
      assert.ok(screen.getByLabelText("Selected LeetCode problem")),
    );
    host = JSON.parse(sessionStorage.getItem("codepace:room")!);
    const joined = await nativeFetch(`${origin}/api/rooms/${host!.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name: "LeetCode UI guest" }),
    }).then((response) => response.json());
    guest = joined.session;
    assert.equal(joined.room.content.problemId, "0206-reverse-linked-list");
    assert.ok(joined.room.passage.includes("\n"));
    fireEvent.click(
      screen.getByRole("button", { name: "Settings" }),
    );
    choose("Language", "JavaScript");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search problems" }),
      { target: { value: "two sum" } },
    );
    choose("Problem", /#1 Two Sum/);
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await waitFor(() =>
      assert.equal(
        Boolean(screen.queryByRole("button", { name: "Apply selection" })),
        false,
      ),
    );
    assert.ok(
      within(screen.getByLabelText("Selected LeetCode problem")).getByText(
        "#1 Two Sum",
      ),
    );
    cleanup();
    sessionStorage.setItem("codepace:room", JSON.stringify(guest));
    await act(async () => {
      render(<CodePace />);
      await pause(50);
    });
    await waitFor(() =>
      assert.ok(screen.getByLabelText("Selected LeetCode problem")),
    );
    assert.equal(
      Boolean(screen.queryByRole("form", { name: "Room setup" })),
      false,
    );
    const details = screen.getByLabelText(
      "Selected LeetCode problem",
    ) as HTMLDetailsElement;
    assert.equal(details.open, false);
    fireEvent.click(within(details).getByText("Problem details"));
    assert.ok(
      screen
        .getByRole("link", { name: "NeetCode solution" })
        .getAttribute("href")
        ?.endsWith("javascript/0001-two-sum.js"),
    );
    assert.equal(
      screen.getByRole("link", { name: "Read problem" }).getAttribute("href"),
      "https://leetcode.com/problems/two-sum/",
    );
    assert.ok(document.querySelectorAll(".code-line").length > 2);
    assert.ok(
      document
        .querySelector(".passage-label")
        ?.textContent?.includes("JavaScript · #1 Two Sum"),
    );
  } finally {
    cleanup();
    globalThis.fetch = nativeFetch;
    for (const session of [host, guest])
      if (session)
        await nativeFetch(`${origin}/api/rooms/${session.code}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ action: "leave" }),
        });
    localStorage.clear();
    sessionStorage.clear();
  }
});
