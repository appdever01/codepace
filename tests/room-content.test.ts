import test from "node:test";
import assert from "node:assert/strict";
import { roomContentSchema } from "../lib/room-content-schema.ts";
import { makeRoomPassage, validRoomContent } from "../lib/room-content.ts";
import { codeLanguages, codeSnippet } from "../lib/coding.ts";

test("all room code languages preserve their chosen snippet and formatting", () => {
  for (const language of codeLanguages) {
    for (let snippet = 0; snippet < 3; snippet++) {
      const content = roomContentSchema.parse({
        mode: "code",
        language: language.id,
        snippet,
      });
      assert.equal(
        makeRoomPassage(content, 1, 30),
        codeSnippet(language.id, snippet).code,
      );
      assert.equal(
        makeRoomPassage(content, 999, 60),
        makeRoomPassage(content, 1, 30),
      );
    }
  }
});

test("custom code keeps line breaks and normalizes indentation, while text normalizes spacing", () => {
  const code = roomContentSchema.parse({
    mode: "code",
    language: "python",
    snippet: -1,
    text: "def hello():\r\n\treturn 123\r\n",
  });
  assert.equal(makeRoomPassage(code, 1, 15), "def hello():\n    return 123");
  const text = roomContentSchema.parse({
    mode: "custom",
    text: "  This is my own passage.\n Everyone\tgets the same text.  ",
  });
  assert.equal(
    makeRoomPassage(text, 1, 15),
    "This is my own passage. Everyone gets the same text.",
  );
  for (const mode of ["quotes", "words"] as const) {
    const passage = makeRoomPassage({ mode }, 1, 15);
    assert.ok(passage.length >= 100);
    assert.notEqual(passage, makeRoomPassage({ mode }, 12345, 15));
  }
});

test("room content rejects unsupported modes, languages, empty content and oversized input", () => {
  for (const content of [
    { mode: "unknown" },
    { mode: "code", language: "shell", snippet: 0 },
    { mode: "code", language: "python", snippet: 3 },
    { mode: "code", language: "python", snippet: -1 },
    {
      mode: "code",
      language: "python",
      snippet: -1,
      text: "\t".repeat(1000) + "return 123",
    },
    { mode: "custom", text: "a" + " ".repeat(50) + "b" },
    { mode: "custom", text: "a".repeat(2001) },
  ])
    assert.equal(roomContentSchema.safeParse(content).success, false);
  assert.equal(
    validRoomContent({ mode: "custom", text: "a" + " ".repeat(50) + "b" }),
    false,
  );
  assert.equal(
    validRoomContent({ mode: "code", language: "python", snippet: -1 }),
    false,
  );
});
