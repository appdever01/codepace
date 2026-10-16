"use client";

import { useEffect, useState } from "react";
import CustomSelect from "@/components/custom-select";
import { readSavedValue } from "@/lib/storage";
import { CodeSquareIcon } from "@solar-icons/react/linear/code-square";
import { MagnifierIcon } from "@solar-icons/react/linear/magnifier";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
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
          readCodePreferences(readSavedValue(localStorage, "codepace:coding:v1")),
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
      localStorage.setItem("codepace:coding:v1", JSON.stringify(preferences));
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
            code: normalizeCode(code),
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
      <div className="code-practice-heading">
        <CodeSquareIcon aria-hidden="true" />
        <h2>Practice setup</h2>
      </div>
      <div className="code-controls">
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
        <CustomSelect
          label="Language"
          disabled={disabled}
          value={preferences.language}
          options={codeLanguages.map((language) => ({
            value: language.id,
            label: language.name,
            detail: `.${language.extension}`,
          }))}
          onChange={(language) => {
            update({ language: language as CodeLanguage });
            if (
              topic &&
              !catalog.some(
                (problem) =>
                  problem.languages.includes(language) &&
                  problem.topic === topic,
              )
            )
              setTopic("");
            setVisible(30);
          }}
        />
        {preferences.kind === "snippets" && (
          <CustomSelect
            label="Exercise"
            disabled={disabled}
            value={String(preferences.snippet)}
            options={["Functions", "Collections", "Control flow"].map(
              (label, index) => ({ value: String(index), label }),
            )}
            onChange={(snippet) => update({ snippet: Number(snippet) })}
          />
        )}
      </div>
      {preferences.kind === "leetcode" && (
        <>
          <div className="code-library">
            <div className="code-library-heading">
              <h3>Problem library</h3>
              <span>
                {supported.length} in {languageName}
              </span>
            </div>
            <fieldset disabled={disabled}>
              <legend className="sr-only">Find a LeetCode problem</legend>
              <div className="code-filters">
                <label className="code-search">
                  <span className="sr-only">Search problems</span>
                  <MagnifierIcon aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    placeholder="Search problems…"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setVisible(30);
                    }}
                  />
                </label>
                <details className="code-filter-panel">
                  <summary>
                    Filters{" "}
                    <span>
                      {[difficulty, topic, collection].filter(Boolean).length
                        ? `${[difficulty, topic, collection].filter(Boolean).length} active`
                        : "All problems"}
                    </span>
                    <AltArrowDownIcon aria-hidden="true" />
                  </summary>
                  <div className="code-filter-options">
                    <CustomSelect
                      label="Difficulty"
                      value={difficulty}
                      disabled={disabled}
                      options={[
                        { value: "", label: "All difficulties" },
                        ...["Easy", "Medium", "Hard"].map((label) => ({
                          value: label,
                          label,
                        })),
                      ]}
                      onChange={(value) => {
                        setDifficulty(value);
                        setVisible(30);
                      }}
                    />
                    <CustomSelect
                      label="Topic"
                      value={topic}
                      disabled={disabled}
                      options={[
                        { value: "", label: "All topics" },
                        ...topics.map((label) => ({ value: label, label })),
                      ]}
                      onChange={(value) => {
                        setTopic(value);
                        setVisible(30);
                      }}
                    />
                    <CustomSelect
                      label="Collection"
                      value={collection}
                      disabled={disabled}
                      options={[
                        { value: "", label: "All problems" },
                        { value: "150", label: "NeetCode 150" },
                      ]}
                      onChange={(value) => {
                        setCollection(value);
                        setVisible(30);
                      }}
                    />
                  </div>
                </details>
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
                    onClick={() => update({ problemId: problem.id })}
                  >
                    <span className="code-problem-number">
                      {problem.number}
                    </span>
                    <span className="code-problem-name">
                      <span>{problem.title}</span>
                      <span className="code-problem-meta">
                        <span>{problem.topic}</span>
                        <span
                          className="code-difficulty"
                          data-level={problem.difficulty.toLowerCase()}
                        >
                          {problem.difficulty}
                        </span>
                        {completed.includes(
                          `${preferences.language}:${problem.id}`,
                        ) && <span className="code-completed">Typed</span>}
                      </span>
                    </span>
                  </button>
                ))}
                {!matches.length && (
                  <p className="code-empty">
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
          </div>
          {selected && (
            <div className="code-selection">
              <strong>
                {selected.number}. {selected.title}
              </strong>
              <span>
                {selected.difficulty} · {selected.topic}
              </span>
              <div className="code-source-links">
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
            placeholder="Paste your code here…"
            onChange={(event) => setCustom(event.target.value)}
          />
        </label>
      )}
      {loading && (
        <p role="status" className="code-load-status">
          Loading solution…
        </p>
      )}
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
      {preferences.kind !== "leetcode" && (
        <div className="code-key-guide" aria-label="Code typing shortcuts">
          <h3>Keyboard shortcuts</h3>
          <div>
            <span>New line</span>
            <kbd>enter</kbd>
          </div>
          <div>
            <span>Indent</span>
            <kbd>tab</kbd>
          </div>
          <div>
            <span>Leave the editor</span>
            <kbd>shift + tab</kbd>
          </div>
          <p>Type the code as shown. It isn’t executed.</p>
        </div>
      )}
    </section>
  );
}
