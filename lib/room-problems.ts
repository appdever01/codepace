import catalog from "./coding-catalog.json" with { type: "json" };
import type { CodeLanguage } from "./coding.ts";

export function roomProblems(language: CodeLanguage) {
  return catalog.filter((problem) => problem.languages.includes(language));
}

export function roomProblem(language: CodeLanguage, problemId: string) {
  return catalog.find(
    (problem) =>
      problem.id === problemId && problem.languages.includes(language),
  );
}
