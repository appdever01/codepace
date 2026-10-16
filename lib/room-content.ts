import {
  codeLanguages,
  codeSnippet,
  normalizeCode,
  type CodeLanguage,
} from "./coding.ts";
import { makePassage } from "./passages.ts";
import { roomProblem } from "./room-problems.ts";

export type RoomContent =
  | { mode: "quotes" | "words" }
  | { mode: "custom"; text: string }
  | {
      mode: "code";
      language: CodeLanguage;
      snippet: number;
      text?: string;
      problemId?: string;
    };

export const defaultRoomContent: RoomContent = {
  mode: "code",
  language: "python",
  snippet: 0,
};

export const roomContentOptions = [
  { value: "code", label: "Code" },
  { value: "quotes", label: "Passage" },
  { value: "words", label: "Words" },
  { value: "custom", label: "Your text" },
] as const;

export function roomContentLabel(content: RoomContent) {
  if (content.mode !== "code")
    return roomContentOptions.find((option) => option.value === content.mode)!
      .label;
  const problem = content.problemId
    ? roomProblem(content.language, content.problemId)
    : undefined;
  const title = problem
    ? `#${problem.number} ${problem.title}`
    : content.snippet === -1
      ? "Your code"
      : codeSnippet(content.language, content.snippet).title;
  return `${codeLanguages.find((language) => language.id === content.language)?.name} · ${title}`;
}

export function validRoomContent(content: RoomContent) {
  if (content.mode === "code" && content.problemId !== undefined)
    return Boolean(roomProblem(content.language, content.problemId));
  if (content.mode === "custom")
    return makePassage("custom", 0, content.text).length >= 30;
  if (content.mode === "code" && content.snippet === -1)
    return (
      normalizeCode(content.text || "").trim().length >= 10 &&
      normalizeCode(content.text || "").length <= 2000
    );
  return true;
}
