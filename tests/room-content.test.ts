import test from "node:test";
import assert from "node:assert/strict";
import { roomContentSchema } from "../lib/room-content-schema.ts";
import { roomContentLabel, validRoomContent } from "../lib/room-content.ts";
import { makeRoomPassage } from "../lib/room-passage.ts";
import { codeLanguages, codeSnippet } from "../lib/coding.ts";
import { roomProblems } from "../lib/room-problems.ts";
import { ROOM_MAX_TYPED_LENGTH } from "../lib/room-limits.ts";
import { readFileSync } from "node:fs";

test("every room library problem resolves to the complete authoritative solution in its language", () => {
  for (const { id: language } of codeLanguages) {
    const bundle = JSON.parse(
      readFileSync(
        new URL(`../public/coding/${language}.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const problem of roomProblems(language)) {
      const content = roomContentSchema.parse({
        mode: "code",
        language,
        snippet: 0,
        problemId: problem.id,
        text: "client supplied code",
      });
      assert.ok(validRoomContent(content));
      assert.equal("text" in content, false);
      const passage = makeRoomPassage(content, 0, 15);
      assert.equal(passage, bundle[problem.id]);
      assert.ok(passage.length <= ROOM_MAX_TYPED_LENGTH);
      assert.equal(makeRoomPassage(content, 999, 60), passage);
      assert.ok(
        roomContentLabel(content).includes(
          `#${problem.number} ${problem.title}`,
        ),
      );
    }
  }
});

test("rooms reject missing and unsupported LeetCode solutions", () => {
  for (const problemId of [
    "",
    "../../secrets",
    "not-a-problem",
    "a".repeat(151),
  ]) {
    const content = {
      mode: "code",
      language: "python",
      snippet: 0,
      problemId,
    } as const;
    assert.equal(roomContentSchema.safeParse(content).success, false);
    assert.equal(validRoomContent(content), false);
  }
  const unavailable = roomProblems("python").find(
    (problem) => !problem.languages.includes("rust"),
  )!;
  assert.equal(
    roomContentSchema.safeParse({
      mode: "code",
      language: "rust",
      snippet: 0,
      problemId: unavailable.id,
    }).success,
    false,
  );
});

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
