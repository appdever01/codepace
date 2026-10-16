import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync } from "node:fs";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Keylane from "../app/keylane";

const clock = Date.now;
let offset = 0;
const nativeFetch = globalThis.fetch;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = async (ms: number) => {
  offset += ms;
  await act(async () => {
    await pause(130);
  });
};
const target = () =>
  document
    .querySelector<HTMLLabelElement>('label[for="typing-input"]')!
    .textContent!.replace("Type this passage: ", "");
async function openCode() {
  await act(async () => {
    render(<Keylane />);
    await pause(10);
  });
  fireEvent.click(screen.getByRole("button", { name: "Code" }));
  await waitFor(() =>
    assert.equal(
      Reflect.get(screen.getByLabelText("Language"), "value"),
      "python",
    ),
  );
  await waitFor(() => assert.ok(target().includes("def average")));
}
function mockLibrary() {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("/coding/"))
      return new Response(
        readFileSync(new URL(`../public${url}`, import.meta.url)),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    return nativeFetch(input, init);
  };
}
test("choose language, type formatted code with correction, finish without a timer and reload preferences", async () => {
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  try {
    await openCode();
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "typescript" },
    });
    await waitFor(() =>
      assert.ok(target().startsWith("function average(values: number[])")),
    );
    const text = target();
    assert.ok(document.querySelectorAll(".code-line-number").length > 1);
    fireEvent.click(
      screen.getByRole("button", { name: /Start coding practice/ }),
    );
    await tick(3100);
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "x" } });
    assert.ok(screen.getByText("Backspace to fix the highlighted mistake."));
    fireEvent.change(input, { target: { value: "" } });
    const newline = text.indexOf("\n");
    fireEvent.change(input, { target: { value: text.slice(0, newline) } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Tab" });
    assert.equal(input.value, text.slice(0, newline + 5));
    const escapeTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(input, escapeTab);
    assert.equal(escapeTab.defaultPrevented, false);
    await tick(65000);
    assert.equal(input.disabled, false);
    fireEvent.change(input, { target: { value: text } });
    await waitFor(() =>
      assert.ok(screen.getByText("Code typed. Nicely done.")),
    );
    const history = JSON.parse(localStorage.getItem("keylane:history")!);
    assert.equal(history[0].coding.completed, true);
    assert.equal(history[0].coding.language, "typescript");
    assert.equal(history[0].errors, 1);
    assert.ok(history[0].duration > 60);
    cleanup();
    await act(async () => {
      render(<Keylane />);
      await pause(10);
    });
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    await waitFor(() =>
      assert.equal(
        Reflect.get(screen.getByLabelText("Language"), "value"),
        "typescript",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    assert.ok(
      screen.getByRole("cell", { name: "Code · Functions · TypeScript" }),
    );
  } finally {
    Date.now = clock;
    cleanup();
  }
});

test("filter real LeetCode solutions, save completion and distinguish timed partial practice", async () => {
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  mockLibrary();
  try {
    await openCode();
    fireEvent.click(screen.getByRole("button", { name: "LeetCode" }));
    await waitFor(() => assert.ok(target().includes("def twoSum")));
    const librarySummary = document.querySelector(".code-library summary")!;
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(librarySummary, enter);
    assert.equal(enter.defaultPrevented, false);
    assert.equal(document.querySelector(".countdown"), null);
    assert.ok(
      screen
        .getByRole("link", { name: "Read problem" })
        .getAttribute("href")
        ?.includes("two-sum"),
    );
    fireEvent.change(screen.getByLabelText("Search problems"), {
      target: { value: "binary search" },
    });
    fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: "Easy" },
    });
    const problem = screen.getByRole("button", { name: /704 Binary Search/ });
    fireEvent.click(problem);
    await waitFor(() => assert.ok(target().includes("def search")));
    const text = target();
    fireEvent.click(
      screen.getByRole("button", { name: /Start coding practice/ }),
    );
    await tick(3100);
    fireEvent.change(
      screen.getByRole("textbox", { name: /^Type this passage:/ }),
      { target: { value: text } },
    );
    await waitFor(() =>
      assert.ok(screen.getByText("Code typed. Nicely done.")),
    );
    assert.ok(screen.getByRole("button", { name: /704 Binary Search.*Typed/ }));
    fireEvent.click(screen.getByRole("button", { name: "60 s" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Start coding practice/ }),
    );
    await tick(3100);
    fireEvent.change(
      screen.getByRole("textbox", { name: /^Type this passage:/ }),
      { target: { value: text.slice(0, 10) } },
    );
    await tick(60000);
    assert.ok(screen.getByText("Practice time complete."));
    const history = JSON.parse(localStorage.getItem("keylane:history")!);
    assert.equal(history[0].coding.completed, false);
    assert.equal(history[1].coding.problemId, "0704-binary-search");
    fireEvent.change(screen.getByLabelText("Search problems"), {
      target: { value: "no-such-problem" },
    });
    assert.ok(screen.getByText(/No matching problems/));
  } finally {
    Date.now = clock;
    globalThis.fetch = nativeFetch;
    cleanup();
  }
});

test("loading failures disable start and retry; custom code keeps its whitespace", async () => {
  localStorage.clear();
  sessionStorage.clear();
  let attempts = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/coding/java.json") {
      attempts++;
      if (attempts === 1) return new Response("unavailable", { status: 503 });
      return new Response(
        readFileSync(new URL("../public/coding/java.json", import.meta.url)),
      );
    }
    return nativeFetch(input, init);
  };
  try {
    await openCode();
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "java" },
    });
    fireEvent.click(screen.getByRole("button", { name: "LeetCode" }));
    await waitFor(() =>
      assert.ok(
        screen.getByRole("alert").textContent?.includes("Could not load"),
      ),
    );
    assert.equal(
      (
        screen.getByRole("button", {
          name: /Start coding practice/,
        }) as HTMLButtonElement
      ).disabled,
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => assert.ok(target().includes("class Solution")));
    fireEvent.click(screen.getByRole("button", { name: "Your code" }));
    assert.equal(
      (
        screen.getByRole("button", {
          name: /Start coding practice/,
        }) as HTMLButtonElement
      ).disabled,
      true,
    );
    fireEvent.change(screen.getByLabelText(/^Your code/), {
      target: { value: "def run():\n\tprint(1)\n" },
    });
    await waitFor(() => assert.equal(target(), "def run():\n    print(1)"));
    fireEvent.click(screen.getByRole("button", { name: "Passages" }));
    assert.equal(document.querySelector(".coding-panel"), null);
    assert.ok(screen.getByRole("button", { name: "30 s" }));
  } finally {
    globalThis.fetch = nativeFetch;
    cleanup();
  }
});
