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
import Keylane from "../app/keylane";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clock = Date.now;
let offset = 0;
const tick = async (ms: number) => {
  offset += ms;
  await act(async () => {
    await pause(130);
  });
};

test("complete a corrected race, save it, inspect progress and reload it", async () => {
  Date.now = () => clock() + offset;
  try {
    await act(async () => {
      render(<Keylane />);
      await pause(10);
    });
    assert.ok(screen.getByRole("heading", { name: "Typing race", level: 1 }));
    assert.equal(
      document.querySelector<HTMLDetailsElement>(".track-drawer")?.open,
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "15 s" }));
    fireEvent.click(screen.getByRole("button", { name: /Start race/ }));
    await tick(3100);
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    assert.equal(input.disabled, false);
    const text = input.labels![0].textContent!.replace(
      "Type this passage: ",
      "",
    );
    fireEvent.change(input, { target: { value: text.slice(0, 6) } });
    fireEvent.change(input, {
      target: { value: text.slice(0, 6) + (text[6] === "x" ? "z" : "x") },
    });
    assert.ok(screen.getByText("Backspace to fix the highlighted mistake."));
    fireEvent.change(input, { target: { value: text.slice(0, 6) } });
    fireEvent.change(input, { target: { value: text.slice(0, 30) } });
    assert.equal(document.querySelectorAll(".correct-char").length, 30);
    const pasted = new Event("paste", { bubbles: true, cancelable: true });
    fireEvent(input, pasted);
    assert.equal(pasted.defaultPrevented, true);
    assert.equal(input.value, text.slice(0, 30));
    await tick(15000);
    const saved = JSON.parse(localStorage.getItem("keylane:history")!);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].wpm, 24);
    assert.equal(saved[0].accuracy, 96.8);
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    assert.ok(screen.getByRole("table"));
    assert.ok(screen.getByRole("cell", { name: "24 wpm" }));
    cleanup();
    await act(async () => {
      render(<Keylane />);
      await pause(10);
    });
    assert.ok(
      document.querySelector(".personal-best")?.textContent?.includes("24"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open profile and settings" }),
    );
    assert.equal(document.documentElement.dataset.theme, "dark");
    fireEvent.click(screen.getByRole("checkbox", { name: "Light theme" }));
    assert.equal(document.documentElement.dataset.theme, "light");
    fireEvent.click(screen.getByRole("checkbox", { name: "Light theme" }));
    assert.equal(document.documentElement.dataset.theme, "dark");
    fireEvent.click(screen.getByRole("button", { name: "Back to the keys" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }));
    assert.ok(document.querySelector(".app.zen"));
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText(/Your practice text/), {
      target: {
        value: "A short original passage with enough letters to practice.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Start practice/ }));
    await tick(3100);
    const customInput = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    });
    fireEvent.keyDown(customInput, { key: "Escape" });
    assert.ok(screen.getByRole("button", { name: /Start practice/ }));
  } finally {
    Date.now = clock;
    cleanup();
  }
});

test("friend-room screen creates, races, restores after reload and leaves through the real API", async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    nativeFetch(
      typeof input === "string"
        ? new URL(input, "http://127.0.0.1:5189")
        : input,
      init,
    );
  let peer: { token: string; code: string } | undefined;
  try {
    sessionStorage.clear();
    await act(async () => {
      render(<Keylane />);
      await pause(10);
    });
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    fireEvent.change(screen.getByLabelText("Your racer name"), {
      target: { value: "UI Host" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() => assert.ok(screen.getByText(/1\/6 in room/)));
    const own = JSON.parse(sessionStorage.getItem("keylane:room")!);
    const joined = await nativeFetch(
      `http://127.0.0.1:5189/api/rooms/${own.code}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name: "UI Friend" }),
      },
    );
    peer = (
      (await joined.json()) as { session: { token: string; code: string } }
    ).session;
    await waitFor(() => assert.ok(screen.getByText(/2\/6 in room/)), {
      timeout: 2500,
    });
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
      { timeout: 6000 },
    );
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    const text = input.labels![0].textContent!.replace(
      "Type this passage: ",
      "",
    );
    fireEvent.change(input, { target: { value: text.slice(0, 3) } });
    await act(async () => {
      await pause(1000);
    });
    cleanup();
    await act(async () => {
      render(<Keylane />);
      await pause(100);
    });
    await waitFor(
      () =>
        assert.equal(
          (
            screen.getByRole("textbox", {
              name: /^Type this passage:/,
            }) as HTMLTextAreaElement
          ).value,
          text.slice(0, 3),
        ),
      { timeout: 2500 },
    );
    assert.equal(document.querySelectorAll(".lane").length, 2);
    fireEvent.click(screen.getByRole("button", { name: "Leave room" }));
    await waitFor(() =>
      assert.ok(screen.getByRole("heading", { name: "Typing race", level: 1 })),
    );
    assert.equal(sessionStorage.getItem("keylane:room"), null);
  } finally {
    cleanup();
    globalThis.fetch = nativeFetch;
    if (peer)
      await nativeFetch(`http://127.0.0.1:5189/api/rooms/${peer.code}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${peer.token}`,
        },
        body: JSON.stringify({ action: "leave" }),
      });
    sessionStorage.clear();
  }
});
