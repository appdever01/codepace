import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CodePace from "../app/codepace";

function avatarSource() {
  const button = screen.getByRole("button", {
    name: "Open profile and settings",
  });
  assert.equal(button.textContent, "");
  const image = button.querySelector("img");
  assert.ok(image);
  assert.equal(image.alt, "");
  const src = image.getAttribute("src")!;
  assert.match(src, /^data:image\/svg\+xml/);
  assert.match(decodeURIComponent(src), /<svg[\s>]/);
  return src;
}

test("existing profiles get a persistent generated avatar without losing saved settings", async () => {
  const settings = { name: "You", pace: 85, sound: false, light: true };
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("codepace:settings:v2", JSON.stringify(settings));
  try {
    render(<CodePace />);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("codepace:settings:v2")!);
      assert.equal(typeof saved.avatarSeed, "string");
      assert.notEqual(saved.avatarSeed, "codepace");
      assert.deepEqual(
        {
          name: saved.name,
          pace: saved.pace,
          sound: saved.sound,
          light: saved.light,
        },
        settings,
      );
    });
    const seed = JSON.parse(
      localStorage.getItem("codepace:settings:v2")!,
    ).avatarSeed;
    const src = avatarSource();
    fireEvent.click(
      screen.getByRole("button", { name: "Open profile and settings" }),
    );
    fireEvent.change(screen.getByLabelText("Racer name"), {
      target: { value: "Ada" },
    });
    assert.equal(avatarSource(), src);
    cleanup();
    render(<CodePace />);
    await waitFor(() => assert.equal(avatarSource(), src));
    assert.equal(
      JSON.parse(localStorage.getItem("codepace:settings:v2")!).avatarSeed,
      seed,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open profile and settings" }),
    );
    assert.equal(
      (screen.getByLabelText("Racer name") as HTMLInputElement).value,
      "Ada",
    );
  } finally {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
});

test("the header does not promote the scoring reference as CodePace's repository and Help retains its credit", () => {
  try {
    render(<CodePace />);
    assert.equal(document.querySelector(".header a[href*='github.com']"), null);
    assert.equal(screen.queryByRole("link", { name: /Star .*GitHub/ }), null);
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    assert.equal(
      screen.getByRole("link", { name: "typerace" }).getAttribute("href"),
      "https://github.com/aroach98/typerace",
    );
  } finally {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
});

test("separate visitors receive different avatars even with the default racer name", async () => {
  localStorage.clear();
  sessionStorage.clear();
  try {
    render(<CodePace />);
    await waitFor(() =>
      assert.ok(
        JSON.parse(localStorage.getItem("codepace:settings:v2")!).avatarSeed,
      ),
    );
    const first = avatarSource();
    cleanup();
    localStorage.clear();
    render(<CodePace />);
    await waitFor(() =>
      assert.ok(
        JSON.parse(localStorage.getItem("codepace:settings:v2")!).avatarSeed,
      ),
    );
    assert.notEqual(avatarSource(), first);
  } finally {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
});
