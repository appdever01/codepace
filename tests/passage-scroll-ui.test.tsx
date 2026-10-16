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

for (const mode of ["race", "practice", "code"] as const) {
  test(`${mode} passage allows scrolling without blocking typing or caret following`, async () => {
    const clock = Date.now;
    let offset = 0;
    Date.now = () => clock() + offset;
    const tick = async (time: number) => {
      offset += time;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 130));
      });
    };
    const style = document.createElement("style");
    style.textContent = ["globals", "immersive", "workspace", "coding"]
      .map((name) =>
        readFileSync(new URL(`../app/${name}.css`, import.meta.url), "utf8"),
      )
      .join("\n");
    document.head.appendChild(style);
    localStorage.clear();
    sessionStorage.clear();
    try {
      await act(async () => {
        render(<CodePace />);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      if (mode === "race")
        fireEvent.click(screen.getByRole("button", { name: "Race" }));
      if (mode === "practice")
        fireEvent.click(screen.getByRole("button", { name: "Practice" }));
      if (mode === "code") {
        fireEvent.click(screen.getByRole("button", { name: "Code" }));
        await waitFor(() =>
          assert.ok(
            document
              .querySelector(".passage")
              ?.textContent?.includes("def average"),
          ),
        );
      }

      const passage = document.querySelector<HTMLElement>(".passage")!;
      const passageStyle = getComputedStyle(passage);
      assert.equal(passageStyle.overflowY || passageStyle.overflow, "auto");
      assert.notEqual(getComputedStyle(passage).scrollbarWidth, "none");
      passage.scrollTop = 80;
      fireEvent.scroll(passage);
      assert.equal(passage.scrollTop, 80);

      fireEvent.click(passage);
      assert.equal(passage.scrollTop, 0);
      await tick(3100);
      const input = screen.getByRole("textbox", {
        name: /^Type this passage:/,
      }) as HTMLTextAreaElement;
      assert.equal(input.disabled, false);
      assert.equal(document.activeElement, input);
      assert.equal(getComputedStyle(input).pointerEvents, "none");
      const text = input.labels![0].textContent!.replace(
        "Type this passage: ",
        "",
      );
      passage.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
      const glyphs = passage.querySelectorAll<HTMLElement>(
        ".word > span, .code-line-content > span",
      );
      for (const index of [29, 30, 31]) {
        glyphs[index].getBoundingClientRect = () =>
          ({ top: 380 - passage.scrollTop }) as DOMRect;
      }
      fireEvent.change(input, { target: { value: text.slice(0, 30) } });
      assert.equal(passage.scrollTop, 232);

      passage.scrollTop = 0;
      fireEvent.scroll(passage);
      await tick(1000);
      assert.equal(passage.scrollTop, 0);
      assert.equal(document.activeElement, input);
      fireEvent.click(passage);
      assert.equal(passage.scrollTop, 0);
      assert.equal(document.activeElement, input);
      fireEvent.change(input, { target: { value: text.slice(0, 31) } });
      assert.equal(passage.scrollTop, 232);

      passage.scrollTop = 0;
      fireEvent.change(input, { target: { value: text.slice(0, 29) } });
      assert.equal(passage.scrollTop, 232);
      assert.equal(input.value, text.slice(0, 29));
      fireEvent.keyDown(input, { key: "Escape" });
      assert.equal(input.disabled, true);
      assert.equal(passage.scrollTop, 0);
    } finally {
      Date.now = clock;
      cleanup();
      style.remove();
    }
  });
}
