"use client";

import { useEffect, useRef, useState } from "react";
import catalog from "@/lib/coding-catalog.json";
import {
  codeLanguages,
  codeSnippet,
  defaultCodePreferences,
  normalizeCode,
  readCodePreferences,
  type CodeExercise,
  type CodeLanguage,
  type CodePreferences,
} from "@/lib/coding";

const bundles = new Map<CodeLanguage, Record<string, string>>();
export default function CodePractice({
  disabled,
  completed,
  onChange,
  onStorageError,
}: {
  disabled: boolean;
  completed: string[];
  onChange: (exercise: CodeExercise | null) => void;
  onStorageError: () => void;
}) {
  const [preferences, setPreferences] = useState<CodePreferences>(
    defaultCodePreferences,
  );
  const [ready, setReady] = useState(false);
  const [custom, setCustom] = useState("");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [collection, setCollection] = useState("");
  const [visible, setVisible] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const libraryRef = useRef<HTMLDetailsElement>(null);
  const selected = catalog.find(
    (problem) => problem.id === preferences.problemId,
  );
  const supported = catalog.filter((p) =>
    p.languages.includes(preferences.language),
  );
  const topics = [...new Set(supported.map((p) => p.topic))].sort();
  const matches = supported.filter(
    (p) =>
      (!difficulty || p.difficulty === difficulty) &&
      (!topic || p.topic === topic) &&
      (!collection || p.neetcode150) &&
      `${p.number} ${p.title} ${p.topic}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setPreferences(
          readCodePreferences(localStorage.getItem("keylane:coding:v1")),
        );
      } catch {
        onStorageError();
      }
      setReady(true);
    });
  }, [onStorageError]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("keylane:coding:v1", JSON.stringify(preferences));
    } catch {
      onStorageError();
    }
  }, [preferences, ready, onStorageError]);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      onChange(null);
      setError("");
      if (preferences.kind === "snippets") {
        setLoading(false);
        onChange(codeSnippet(preferences.language, preferences.snippet));
        return;
      }
      if (preferences.kind === "custom") {
        setLoading(false);
        const code = normalizeCode(custom);
        onChange(
          code.trim().length >= 10
            ? {
                code,
                title: "Your code",
                language: preferences.language,
                kind: "custom",
              }
            : null,
        );
        return;
      }
      if (!selected || !selected.languages.includes(preferences.language)) {
        setLoading(false);
        setError(
          "This problem has no solution in this language. Choose another problem or language.",
        );
        return;
      }
      setLoading(true);
      try {
        let bundle = bundles.get(preferences.language);
        if (!bundle) {
          timeout = setTimeout(() => controller.abort(), 10000);
          const response = await fetch(`/coding/${preferences.language}.json`, {
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error("Could not load the solutions. Try again.");
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("The solution library is unavailable. Try again.");
          bundle = data as Record<string, string>;
          if (!current) return;
          bundles.set(preferences.language, bundle);
        }
        const code = bundle[selected.id];
        if (typeof code !== "string" || !code.trim() || code.length > 20000)
          throw new Error(
            "This solution is unavailable. Choose another problem.",
          );
        if (current)
          onChange({
            code,
            title: `#${selected.number} ${selected.title}`,
            language: preferences.language,
            kind: "leetcode",
            problemId: selected.id,
          });
      } catch (failure) {
        if (current)
          setError(
            controller.signal.aborted
              ? "Loading took too long. Try again."
              : failure instanceof Error
                ? failure.message
                : "Could not load the solution. Try again.",
          );
      } finally {
        clearTimeout(timeout);
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [preferences, custom, ready, retry, selected, onChange]);
  const update = (next: Partial<CodePreferences>) =>
    setPreferences((previous) => ({ ...previous, ...next }));
  const languageName = codeLanguages.find(
    (l) => l.id === preferences.language,
  )!.name;
  return (
    <section className="code-practice" aria-label="Coding practice setup">
      <div className="code-controls">
        <label>
          Language
          <select
            disabled={disabled}
            value={preferences.language}
            onChange={(event) =>
              update({ language: event.target.value as CodeLanguage })
            }
          >
            {codeLanguages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.name}
              </option>
            ))}
          </select>
        </label>
        <div className="segments" aria-label="Code exercise type">
          {(
            [
              ["snippets", "Snippets"],
              ["leetcode", "LeetCode"],
              ["custom", "Your code"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              disabled={disabled}
              aria-pressed={preferences.kind === kind}
              className={preferences.kind === kind ? "selected" : ""}
              onClick={() => update({ kind })}
            >
              {label}
            </button>
          ))}
        </div>
        {preferences.kind === "snippets" && (
          <label>
            Exercise
            <select
              disabled={disabled}
              value={preferences.snippet}
              onChange={(event) =>
                update({ snippet: Number(event.target.value) })
              }
            >
              <option value={0}>Functions</option>
              <option value={1}>Collections</option>
              <option value={2}>Control flow</option>
            </select>
          </label>
        )}
      </div>
      {preferences.kind === "leetcode" && (
        <>
          <details className="code-library" ref={libraryRef}>
            <summary>
              Choose a problem{" "}
              <span>
                {supported.length} in {languageName}
              </span>
            </summary>
            <fieldset disabled={disabled}>
              <legend className="sr-only">Find a LeetCode problem</legend>
              <div className="code-filters">
                <label className="code-search">
                  Search problems
                  <input
                    type="search"
                    value={query}
                    placeholder="Name, number or topic"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setVisible(30);
                    }}
                  />
                </label>
                <label>
                  Difficulty
                  <select
                    value={difficulty}
                    onChange={(event) => {
                      setDifficulty(event.target.value);
                      setVisible(30);
                    }}
                  >
                    <option value="">All difficulties</option>
                    {["Easy", "Medium", "Hard"].map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Topic
                  <select
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value);
                      setVisible(30);
                    }}
                  >
                    <option value="">All topics</option>
                    {topics.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Collection
                  <select
                    value={collection}
                    onChange={(event) => {
                      setCollection(event.target.value);
                      setVisible(30);
                    }}
                  >
                    <option value="">All problems</option>
                    <option value="150">NeetCode 150</option>
                  </select>
                </label>
              </div>
              <div
                className="code-list"
                role="group"
                aria-label="LeetCode problems"
              >
                {matches.slice(0, visible).map((problem) => (
                  <button
                    key={problem.id}
                    className={
                      problem.id === preferences.problemId ? "selected" : ""
                    }
                    aria-pressed={problem.id === preferences.problemId}
                    onClick={() => {
                      update({ problemId: problem.id });
                      if (libraryRef.current) libraryRef.current.open = false;
                    }}
                  >
                    <span className="code-problem-number">
                      {problem.number}
                    </span>
                    <span className="code-problem-name">
                      {problem.title}
                      <small>{problem.topic}</small>
                    </span>
                    <span className="code-difficulty">
                      {problem.difficulty}
                    </span>
                    {completed.includes(
                      `${preferences.language}:${problem.id}`,
                    ) && <span className="code-completed">Typed</span>}
                  </button>
                ))}
                {!matches.length && (
                  <p>
                    No matching problems. Try another search or clear the
                    filters.
                  </p>
                )}
              </div>
              <div className="code-list-bottom">
                <span>{matches.length} matching problems</span>
                {matches.length > visible && (
                  <button
                    className="text-button"
                    onClick={() => setVisible((count) => count + 30)}
                  >
                    Show more
                  </button>
                )}
              </div>
            </fieldset>
          </details>
          {selected && (
            <div className="code-selection">
              <strong>
                {selected.number}. {selected.title}
              </strong>
              <span>
                {selected.difficulty} · {selected.topic}
              </span>
              <a
                href={`https://leetcode.com/problems/${selected.slug}/`}
                target="_blank"
                rel="noreferrer"
              >
                Read problem
              </a>
              <a
                href={`https://github.com/neetcode-gh/leetcode/blob/d5ebb3ea8bd4b52d605bc7aa179e22af684d31bb/${preferences.language}/${selected.id}.${codeLanguages.find((l) => l.id === preferences.language)!.extension}`}
                target="_blank"
                rel="noreferrer"
              >
                View source
              </a>
            </div>
          )}
          <p className="code-credit">
            Solutions by{" "}
            <a
              href="https://github.com/neetcode-gh/leetcode"
              target="_blank"
              rel="noreferrer"
            >
              NeetCode contributors
            </a>{" "}
            ·{" "}
            <a
              href="/coding/LICENSE-neetcode.txt"
              target="_blank"
              rel="noreferrer"
            >
              MIT license
            </a>
            . Typing practice; code is not executed or graded.
          </p>
        </>
      )}
      {preferences.kind === "custom" && (
        <label className="code-custom">
          Your code <span>10–20,000 characters. Formatting is preserved.</span>
          <textarea
            disabled={disabled}
            value={custom}
            maxLength={20000}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Paste the code you want to practise…"
            onChange={(event) => setCustom(event.target.value)}
          />
        </label>
      )}
      {loading && <p role="status">Loading solution…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
    </section>
  );
}
