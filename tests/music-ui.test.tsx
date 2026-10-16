import test, { afterEach, beforeEach } from "node:test";
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

const prototype = window.HTMLMediaElement.prototype;
const originals = Object.fromEntries(
  ["play", "pause", "load", "paused"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(prototype, key)!,
  ]),
);
let paused: WeakMap<HTMLMediaElement, boolean>;
let plays = 0;
let reloads = 0;
let play: (audio: HTMLMediaElement) => Promise<void>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  paused = new WeakMap();
  plays = 0;
  reloads = 0;
  play = async (audio) => {
    paused.set(audio, false);
    audio.dispatchEvent(new Event("playing"));
  };
  Object.defineProperties(prototype, {
    paused: {
      configurable: true,
      get() {
        return paused.get(this) ?? true;
      },
    },
    play: {
      configurable: true,
      value() {
        plays++;
        return play(this);
      },
    },
    pause: {
      configurable: true,
      value() {
        paused.set(this, true);
        this.dispatchEvent(new Event("pause"));
      },
    },
    load: {
      configurable: true,
      value() {
        reloads++;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  for (const [key, descriptor] of Object.entries(originals))
    Object.defineProperty(prototype, key, descriptor);
});

async function openGame() {
  await act(async () => {
    render(<CodePace />);
    await Promise.resolve();
  });
  return document.querySelector("audio")!;
}

test("music waits for interaction, continues across screens, and remembers mute and volume", async () => {
  const audio = await openGame();
  assert.equal(audio.preload, "none");
  assert.equal(audio.loop, true);
  assert.equal(audio.volume, 0.16);
  assert.equal(plays, 0);
  await act(async () => fireEvent.pointerDown(screen.getByRole("main")));
  assert.equal(audio.paused, false);
  assert.equal(plays, 1);
  fireEvent.click(screen.getByRole("button", { name: "Progress" }));
  assert.equal(document.querySelector("audio"), audio);
  assert.equal(audio.paused, false);
  fireEvent.click(screen.getByRole("button", { name: "Race" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Open profile and settings" }),
  );
  fireEvent.change(screen.getByRole("slider", { name: /Music volume/ }), {
    target: { value: "30" },
  });
  assert.equal(audio.volume, 0.3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Background music" }));
  assert.equal(audio.paused, true);
  assert.equal(
    (
      screen.getByRole("checkbox", {
        name: "Soft typing sounds",
      }) as HTMLInputElement
    ).checked,
    false,
  );
  cleanup();
  const restored = await openGame();
  assert.equal(restored.volume, 0.3);
  await act(async () => fireEvent.pointerDown(screen.getByRole("main")));
  assert.equal(plays, 1);
  fireEvent.click(screen.getByRole("button", { name: "Open audio settings" }));
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Turn background music on" }),
    ),
  );
  assert.equal(restored.paused, false);
  assert.equal(plays, 2);
  cleanup();
  assert.equal(restored.paused, true);
});

test("browser playback blocking retries on interaction and file failures wait for an explicit retry", async () => {
  const audio = await openGame();
  play = async () => {
    throw Object.assign(new Error("Gesture needed"), {
      name: "NotAllowedError",
    });
  };
  await act(async () => fireEvent.pointerDown(screen.getByRole("main")));
  assert.equal(plays, 1);
  assert.equal(screen.queryByText(/Music could not load/), null);
  play = async () => {
    throw Object.assign(new Error("Unavailable media"), {
      name: "NotSupportedError",
    });
  };
  await act(async () => fireEvent.pointerDown(screen.getByRole("main")));
  assert.ok(screen.getByText(/Music could not load/));
  await act(async () => fireEvent.pointerDown(screen.getByRole("main")));
  assert.equal(plays, 2);
  fireEvent.click(screen.getByRole("button", { name: "Open audio settings" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Turn background music off" }),
  );
  play = async (element) => {
    paused.set(element, false);
    element.dispatchEvent(new Event("playing"));
  };
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Turn background music on" }),
    ),
  );
  assert.equal(reloads, 1);
  assert.equal(audio.paused, false);
  assert.equal(screen.queryByText(/Music could not load/), null);
});

test("muting while playback is pending prevents a late start", async () => {
  const audio = await openGame();
  let complete: (() => void) | undefined;
  play = (element) =>
    new Promise<void>((resolve) => {
      complete = () => {
        paused.set(element, false);
        element.dispatchEvent(new Event("playing"));
        resolve();
      };
    });
  fireEvent.pointerDown(screen.getByRole("main"));
  fireEvent.click(screen.getByRole("button", { name: "Open audio settings" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Turn background music off" }),
  );
  await act(async () => complete!());
  assert.equal(audio.paused, true);
  assert.equal(
    JSON.parse(localStorage.getItem("codepace:music:v1")!).enabled,
    false,
  );
});
