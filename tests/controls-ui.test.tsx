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
} from "@testing-library/react";
import CustomSelect from "../components/custom-select";
import AudioControls from "../components/audio-controls";
import CodePace from "../app/codepace";

const options = [
  { value: "python", label: "Python", detail: ".py" },
  { value: "java", label: "Java", detail: ".java" },
  { value: "typescript", label: "TypeScript", detail: ".ts" },
];

function SelectExample() {
  const [value, setValue] = useState("python");
  return (
    <>
      <CustomSelect
        label="Language"
        value={value}
        options={options}
        onChange={setValue}
      />
      <button>Outside</button>
    </>
  );
}

test("custom dropdown supports keyboard selection, typeahead and cancellation without moving focus", () => {
  try {
    render(<SelectExample />);
    const trigger = screen.getByRole("combobox", { name: "Language" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    const first = screen.getAllByRole("option")[0];
    assert.equal(trigger.getAttribute("aria-activedescendant"), first.id);
    fireEvent.keyDown(trigger, { key: "End" });
    assert.equal(
      trigger.getAttribute("aria-activedescendant"),
      screen.getAllByRole("option")[2].id,
    );
    fireEvent.keyDown(trigger, { key: "Home" });
    fireEvent.keyDown(trigger, { key: "j" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    assert.equal(Reflect.get(trigger, "value"), "java");
    assert.equal(screen.queryByRole("listbox"), null);
    assert.equal(document.activeElement, trigger);
    fireEvent.keyDown(trigger, { key: " " });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    assert.equal(Reflect.get(trigger, "value"), "java");
    assert.equal(screen.queryByRole("listbox"), null);
    fireEvent.click(trigger);
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(trigger, tab);
    assert.equal(tab.defaultPrevented, false);
    assert.equal(screen.queryByRole("listbox"), null);
  } finally {
    cleanup();
  }
});

test("custom dropdown selects by pointer, dismisses outside and closes when disabled", () => {
  try {
    const changed: string[] = [];
    const { rerender } = render(
      <CustomSelect
        label="Language"
        value="python"
        options={options}
        onChange={(value) => changed.push(value)}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Language" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "TypeScript .ts" }));
    assert.deepEqual(changed, ["typescript"]);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    assert.equal(screen.queryByRole("listbox"), null);
    fireEvent.click(trigger);
    rerender(
      <CustomSelect
        label="Language"
        value="python"
        options={options}
        disabled
        onChange={(value) => changed.push(value)}
      />,
    );
    assert.equal(screen.queryByRole("listbox"), null);
    assert.equal(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLButtonElement)
        .disabled,
      true,
    );
    assert.deepEqual(changed, ["typescript"]);
  } finally {
    cleanup();
  }
});

function AudioExample() {
  const [music, setMusic] = useState(true);
  const [volume, setVolume] = useState(0.16);
  const [typing, setTyping] = useState(false);
  return (
    <>
      <AudioControls
        musicEnabled={music}
        musicPlaying={false}
        musicVolume={volume}
        typingSound={typing}
        onToggleMusic={() => setMusic(!music)}
        onVolumeChange={setVolume}
        onToggleTyping={() => setTyping(!typing)}
      />
      <button>Outside</button>
    </>
  );
}

test("header audio panel changes music, volume and typing sound independently and dismisses with Escape", () => {
  try {
    render(<AudioExample />);
    const trigger = screen.getByRole("button", { name: "Open audio settings" });
    fireEvent.click(trigger);
    assert.ok(screen.getByRole("dialog", { name: "Audio settings" }));
    fireEvent.change(screen.getByRole("slider", { name: "Music volume" }), {
      target: { value: "35" },
    });
    assert.ok(screen.getByText("35%"));
    fireEvent.click(
      screen.getByRole("button", { name: "Turn background music off" }),
    );
    assert.ok(
      screen.getByRole("button", {
        name: "Turn background music on",
        pressed: false,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Turn typing sound on" }),
    );
    assert.ok(
      screen.getByRole("button", {
        name: "Turn typing sound off",
        pressed: true,
      }),
    );
    fireEvent.keyDown(screen.getByRole("slider", { name: "Music volume" }), {
      key: "Escape",
    });
    assert.equal(screen.queryByRole("dialog"), null);
    assert.equal(document.activeElement, trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    assert.equal(screen.queryByRole("dialog"), null);
  } finally {
    cleanup();
  }
});

test("a missing dropdown value stays unselected rather than showing a false fallback", () => {
  try {
    render(
      <CustomSelect
        label="Language"
        value="missing"
        options={options}
        onChange={() => {}}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Language" });
    assert.ok(trigger.textContent?.includes("Choose an option"));
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    assert.equal(
      screen
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-selected") === "true")
        .length,
      0,
    );
    assert.equal(
      trigger.getAttribute("aria-activedescendant"),
      screen.getAllByRole("option")[0].id,
    );
  } finally {
    cleanup();
  }
});

test("Friends uses a custom race-length picker and sends the selected duration when creating a room", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; body: { name: string; duration: number } }[] =
    [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ error: "Room service unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };
  localStorage.clear();
  sessionStorage.clear();
  try {
    await act(async () => {
      render(<CodePace />);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    assert.equal(document.querySelector("select"), null);
    const trigger = screen.getByRole("combobox", { name: "Race length" });
    assert.equal(trigger.tagName, "BUTTON");
    assert.equal(trigger.textContent, "30 seconds");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    assert.equal(screen.getAllByRole("option").length, 3);
    assert.equal(
      screen
        .getByRole("option", { name: "30 seconds" })
        .getAttribute("aria-selected"),
      "true",
    );
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    assert.equal(trigger.textContent, "60 seconds");
    assert.equal(screen.queryByRole("listbox"), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.querySelector(".countdown"), null);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "15 seconds" }));
    assert.equal(trigger.textContent, "15 seconds");
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    assert.equal(trigger.textContent, "15 seconds");
    assert.equal(screen.queryByRole("listbox"), null);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "60 seconds" }));
    fireEvent.change(screen.getByLabelText("Your racer name"), {
      target: { value: "Dropdown racer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() =>
      assert.ok(screen.getByText("Room service unavailable")),
    );
    assert.deepEqual(requests, [
      { url: "/api/rooms", body: { name: "Dropdown racer", duration: 60 } },
    ]);
    assert.equal((trigger as HTMLButtonElement).disabled, false);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  }
});
