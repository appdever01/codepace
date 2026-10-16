import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import RoomInvite from "../components/room-invite";

test("Copy link copies the full invitation and confirms success beside the button", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  try {
    render(<RoomInvite code="ABC234" />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Copy link" })),
    );
    assert.equal(new URL(copied).origin, location.origin);
    assert.equal(new URL(copied).searchParams.get("room"), "ABC234");
    assert.ok(screen.getByRole("button", { name: "Copied" }));
    assert.equal(screen.getByRole("status").textContent, "Invite link copied.");
    assert.equal(
      Boolean(screen.queryByRole("textbox", { name: "Invite link" })),
      false,
    );
  } finally {
    cleanup();
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

test("denied or unavailable clipboard access leaves the complete invite selected for manual copying", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  try {
    for (const clipboard of [
      undefined,
      {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    ]) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
      render(<RoomInvite code="ABC234" />);
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Copy link" })),
      );
      const input = screen.getByRole("textbox", {
        name: "Invite link",
      }) as HTMLInputElement;
      assert.equal(new URL(input.value).searchParams.get("room"), "ABC234");
      assert.equal(input.readOnly, true);
      assert.equal(input.selectionStart, 0);
      assert.equal(input.selectionEnd, input.value.length);
      assert.equal(document.activeElement === input, true);
      assert.equal(
        Boolean(screen.queryByRole("button", { name: "Copied" })),
        false,
      );
      cleanup();
    }
  } finally {
    cleanup();
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
