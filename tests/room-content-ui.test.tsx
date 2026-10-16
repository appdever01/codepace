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
  within,
} from "@testing-library/react";
import CodePace from "../app/codepace";
import type { RoomSession } from "../lib/room-types";

const origin = process.env.CODEPACE_TEST_URL || "http://127.0.0.1:5189";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function choose(label: string, value: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: value }));
}

test("host chooses shared content, changes it before starting and restores code formatting and typing", async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    nativeFetch(
      typeof input === "string" ? new URL(input, origin) : input,
      init,
    );
  let host: RoomSession | undefined;
  let peer: RoomSession | undefined;
  const request = async (data: unknown, session?: RoomSession) => {
    const response = await nativeFetch(`${origin}/api/rooms/${host!.code}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => {
      render(<CodePace />);
      await pause(20);
    });
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    assert.equal(
      screen.getByRole("combobox", { name: "Content" }).textContent,
      "Code",
    );
    choose("Content", "Your text");
    fireEvent.change(screen.getByLabelText("Your racer name"), {
      target: { value: "Content host" },
    });
    assert.equal(
      (
        screen.getByRole("button", {
          name: "Create a room",
        }) as HTMLButtonElement
      ).disabled,
      true,
    );
    const passage =
      "This is the passage every person in this room will type together.";
    fireEvent.change(screen.getByRole("textbox", { name: "Your text" }), {
      target: { value: passage },
    });
    choose("Race length", "15 seconds");
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() =>
      assert.ok(screen.getByRole("group", { name: "Room controls" })),
    );

    host = JSON.parse(sessionStorage.getItem("codepace:room")!);

    const joined = await request({ action: "join", name: "Content guest" });
    assert.equal(joined.status, 201);
    peer = joined.data.session;
    assert.equal(joined.data.room.passage, passage);
    assert.equal(joined.data.room.content.mode, "custom");

    const forbidden = await request(
      {
        action: "configure",
        round: 1,
        duration: 15,
        content: { mode: "words" },
      },
      peer,
    );
    assert.equal(forbidden.status, 403);

    choose("Content", "Words");
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await waitFor(() =>
      assert.equal(
        Boolean(screen.queryByRole("button", { name: "Apply selection" })),
        false,
      ),
    );
    assert.equal(document.querySelectorAll(".code-line").length, 0);

    choose("Content", "Code");
    choose("Language", "JavaScript");

    choose("Exercise", "Your code");
    const code = "const answer = 42;\n    console.log(answer);";
    fireEvent.change(screen.getByRole("textbox", { name: "Your code" }), {
      target: { value: code },
    });
    assert.equal(
      (
        screen.getByRole("button", {
          name: "Start race",
        }) as HTMLButtonElement
      ).disabled,
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply selection" }));
    await waitFor(() =>
      assert.ok(document.querySelectorAll(".code-line").length === 2),
    );
    assert.equal(
      screen.queryByRole("button", { name: "Start coding practice" }),
      null,
    );

    const observed = await nativeFetch(`${origin}/api/rooms/${host!.code}`, {
      headers: { Authorization: `Bearer ${peer!.token}` },
    }).then((r) => r.json());
    assert.equal(observed.room.passage, code);
    assert.equal(observed.room.content.language, "javascript");
    fireEvent.click(screen.getByRole("button", { name: "Start race" }));
    await waitFor(
      () =>
        assert.equal(
          (
            screen.getByRole("textbox", {
              name: /^Type this passage:/,
            }) as HTMLTextAreaElement
          ).disabled,
          false,
        ),
      { timeout: 6500 },
    );
    assert.equal(screen.queryByRole("form", { name: "Room setup" }), null);

    const locked = await request(
      {
        action: "configure",
        round: 1,
        duration: 15,
        content: { mode: "words" },
      },
      host,
    );
    assert.equal(locked.status, 409);
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "const answer = 42;" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Tab" });
    assert.equal(input.value, "const answer = 42;\n    ");
    await act(async () => {
      await pause(1300);
    });

    cleanup();
    await act(async () => {
      render(<CodePace />);
      await pause(50);
    });
    await waitFor(
      () =>
        assert.equal(
          (
            screen.getByRole("textbox", {
              name: /^Type this passage:/,
            }) as HTMLTextAreaElement
          ).value,
          "const answer = 42;\n    ",
        ),
      { timeout: 2500 },
    );
    assert.equal(document.querySelectorAll(".code-line").length, 2);
    assert.ok(
      within(screen.getByRole("group", { name: "Room controls" })).getByText(
        "2/6",
      ),
    );
  } finally {
    cleanup();
    globalThis.fetch = nativeFetch;
    for (const session of [host, peer])
      if (session) await request({ action: "leave" }, session);
    localStorage.clear();
    sessionStorage.clear();
  }
});
