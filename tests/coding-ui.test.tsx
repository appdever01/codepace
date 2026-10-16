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
import CodePace from "../app/codepace";

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
    render(<CodePace />);
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
function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(
    screen.getByRole("option", {
      name: (name) => name === option || name.startsWith(`${option} `),
    }),
  );
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
test("Rust Two Sum accepts Enter on blank lines without typing invisible indentation", async () => {
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  mockLibrary();
  try {
    await openCode();
    chooseOption("Language", "Rust");
    fireEvent.click(screen.getByRole("button", { name: "LeetCode" }));
    await waitFor(() =>
      assert.ok(target().startsWith("use std::collections::HashMap;")),
    );
    const lines = target().split("\n");
    fireEvent.click(
      screen.getByRole("button", { name: /Start coding practice/ }),
    );
    await tick(3100);
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    for (const line of [6, 9, 16]) {
      const prefix = lines.slice(0, line - 1).join("\n");
      fireEvent.change(input, { target: { value: prefix } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter" });
      assert.equal(document.querySelectorAll(".wrong-char").length, 0);
      assert.equal(input.value, `${prefix}\n\n`);
      assert.equal(
        document.querySelectorAll(".code-line-content")[line - 1].textContent,
        "↵",
      );
    }
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.keyDown(input, { key: "Tab" });
    assert.equal(input.value.endsWith("\n        "), true);
    assert.equal(document.querySelectorAll(".wrong-char").length, 0);
    fireEvent.change(input, { target: { value: target() } });
    await waitFor(() =>
      assert.ok(screen.getByText("Code typed. Nicely done.")),
    );
    const history = JSON.parse(localStorage.getItem("codepace:history")!);
    assert.equal(history[0].errors, 0);
    assert.equal(history[0].coding.completed, true);
  } finally {
    Date.now = clock;
    globalThis.fetch = nativeFetch;
    cleanup();
  }
});

test("choose language, type formatted code with correction, finish without a timer and reload preferences", async () => {
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  try {
    await openCode();
    chooseOption("Language", "TypeScript");
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
    assert.equal(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLButtonElement)
        .disabled,
      true,
    );
    fireEvent.change(input, { target: { value: text } });
    await waitFor(() =>
      assert.ok(screen.getByText("Code typed. Nicely done.")),
    );
    const history = JSON.parse(localStorage.getItem("codepace:history")!);
    assert.equal(history[0].coding.completed, true);
    assert.equal(history[0].coding.language, "typescript");
    assert.equal(history[0].errors, 1);
    assert.ok(history[0].duration > 60);
    cleanup();
    await act(async () => {
      render(<CodePace />);
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
    fireEvent.click(screen.getByText("Filters"));
    const difficulty = screen.getByRole("combobox", { name: "Difficulty" });
    fireEvent.keyDown(difficulty, { key: "Enter" });
    assert.equal(difficulty.getAttribute("aria-expanded"), "true");
    assert.equal(document.querySelector(".countdown"), null);
    fireEvent.keyDown(difficulty, { key: "Escape" });
    assert.equal(difficulty.getAttribute("aria-expanded"), "false");
    assert.ok(
      screen
        .getByRole("link", { name: "Read problem" })
        .getAttribute("href")
        ?.includes("two-sum"),
    );
    fireEvent.change(screen.getByLabelText("Search problems"), {
      target: { value: "binary search" },
    });
    chooseOption("Difficulty", "Easy");
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
    const history = JSON.parse(localStorage.getItem("codepace:history")!);
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
    chooseOption("Language", "Java");
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
    fireEvent.click(screen.getByRole("button", { name: "Practice" }));
    assert.equal(document.querySelector(".coding-panel"), null);
    assert.ok(screen.getByRole("button", { name: "30 s" }));
  } finally {
    globalThis.fetch = nativeFetch;
    cleanup();
  }
});

test("header audio controls preserve an active code attempt and Escape only closes the audio panel", async () => {
  Date.now = () => clock() + offset;
  localStorage.clear();
  sessionStorage.clear();
  try {
    await openCode();
    const code = target();
    fireEvent.click(
      screen.getByRole("button", { name: "Start coding practice" }),
    );
    await tick(3100);
    const input = screen.getByRole("textbox", {
      name: /^Type this passage:/,
    }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: code.slice(0, 8) } });
    fireEvent.click(
      screen.getByRole("button", { name: "Open audio settings" }),
    );
    const volume = screen.getByRole("slider", { name: "Music volume" });
    fireEvent.change(volume, { target: { value: "40" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Turn background music off" }),
    );
    fireEvent.keyDown(volume, { key: "Escape" });
    assert.equal(
      screen.queryByRole("dialog", { name: "Audio settings" }),
      null,
    );
    assert.equal(input.disabled, false);
    assert.equal(input.value, code.slice(0, 8));
    assert.equal(target(), code);
    assert.equal(
      JSON.parse(localStorage.getItem("codepace:music:v1")!).volume,
      0.4,
    );
    assert.equal(
      JSON.parse(localStorage.getItem("codepace:music:v1")!).enabled,
      false,
    );
  } finally {
    Date.now = clock;
    cleanup();
  }
});

test("changing languages clears an unsupported topic and keeps the visible filter honest", async () => {
  localStorage.clear();
  sessionStorage.clear();
  mockLibrary();
  try {
    await openCode();
    chooseOption("Language", "JavaScript");
    fireEvent.click(screen.getByRole("button", { name: "LeetCode" }));
    await waitFor(() => assert.ok(target().includes("twoSum")));
    fireEvent.click(screen.getByText("Filters"));
    chooseOption("Topic", "JavaScript");
    assert.ok(
      screen.getByRole("button", { name: /Create Hello World Function/ }),
    );
    chooseOption("Language", "Python");
    await waitFor(() => assert.ok(target().includes("def twoSum")));
    const topic = screen.getByRole("combobox", { name: "Topic" });
    assert.equal(Reflect.get(topic, "value"), "");
    assert.ok(topic.textContent?.includes("All topics"));
    assert.equal(screen.queryByText(/No matching problems/), null);
    assert.ok(screen.getByRole("button", { name: /^1 Two Sum/ }));
    assert.equal(screen.queryByText("1 active"), null);
  } finally {
    globalThis.fetch = nativeFetch;
    cleanup();
  }
});
