import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  codeLanguages,
  codeSnippet,
  codeTabText,
  normalizeCode,
  readCodePreferences,
} from "../lib/coding.ts";
import { applyInput, emptyTyping, readHistory } from "../lib/race.ts";
import { makePassage } from "../lib/passages.ts";

test("every indexed solution is bundled in the advertised language with full formatting", () => {
  const catalog = JSON.parse(
    readFileSync(
      new URL("../lib/coding-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = new Set();
  for (const language of codeLanguages) {
    const bundle = JSON.parse(
      readFileSync(
        new URL(`../public/coding/${language.id}.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const problem of catalog) {
      ids.add(problem.id);
      if (problem.languages.includes(language.id)) {
        assert.equal(typeof bundle[problem.id], "string");
        assert.ok(bundle[problem.id].trim().length > 10);
        assert.ok(bundle[problem.id].length <= 20000);
        assert.ok(!bundle[problem.id].includes("\r"));
        assert.ok(!bundle[problem.id].includes("\t"));
        assert.equal(
          /[ \t]+$/m.test(bundle[problem.id]),
          false,
          `${language.id}/${problem.id} contains invisible trailing whitespace`,
        );
      }
    }
  }
  assert.equal(ids.size, catalog.length);
  assert.ok(catalog.length >= 400);
  assert.ok(
    readFileSync(
      new URL("../public/coding/LICENSE-neetcode.txt", import.meta.url),
      "utf8",
    ).includes("Copyright (c) 2022 neetcode-gh"),
  );
});

test("code normalization removes invisible line endings without changing meaningful indentation", () => {
  const source =
    'fn example() {  \r\n\tlet text = "a  b "; \t\r\n\t \r\n\treturn text;\t\r\n}\r\n\t';
  const expected =
    'fn example() {\n    let text = "a  b ";\n\n    return text;\n}';
  assert.equal(normalizeCode(source), expected);
  assert.equal(normalizeCode(expected), expected);
  assert.equal(normalizeCode(" \t\r\n\t "), "");
});

test("coding preferences recover from invalid storage and preserve valid choices", () => {
  for (const value of [
    "null",
    "[]",
    "broken",
    '{"language":"bad","kind":"bad","snippet":100}',
  ]) {
    assert.equal(readCodePreferences(value).language, "python");
    assert.equal(readCodePreferences(value).kind, "snippets");
  }
  assert.deepEqual(
    readCodePreferences(
      '{"language":"rust","kind":"leetcode","snippet":2,"problemId":"0001-two-sum"}',
    ),
    {
      language: "rust",
      kind: "leetcode",
      snippet: 2,
      problemId: "0001-two-sum",
    },
  );
});

test("multiline correction and Tab preserve code while retaining typing mistakes", () => {
  const target = normalizeCode("if ready:\r\n\trun()\r\n");
  assert.equal(target, "if ready:\n    run()");
  let state = applyInput(emptyTyping(), "if ready:x", target);
  assert.equal(state.missed.enter, 1);
  state = applyInput(state, "if ready:", target);
  state = applyInput(state, state.typed + "\n", target);
  state = applyInput(
    state,
    state.typed + codeTabText(target, state.typed.length),
    target,
  );
  assert.equal(state.typed, "if ready:\n    ");
  state = applyInput(state, target, target);
  assert.equal(state.typed, target);
  assert.equal(state.errors, 1);
  assert.equal(codeTabText("  x", 0), "  ");
  assert.equal(readHistory('[{"coding":{"completed":"bad"}}]').length, 0);
});

test("all snippet choices use the chosen language and remain complete", () => {
  for (const language of codeLanguages) {
    for (let i = 0; i < 3; i++) {
      const exercise = codeSnippet(language.id, i);
      assert.ok(exercise.code.includes("\n"));
      assert.equal(exercise.language, language.id);
    }
  }
  assert.equal(
    makePassage("code", 0, "", [], 15),
    codeSnippet("python", 0).code,
  );
});
