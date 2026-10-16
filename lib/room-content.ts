import {
  codeLanguages,
  codeSnippet,
  normalizeCode,
  type CodeLanguage,
} from "./coding.ts";
import { makePassage } from "./passages.ts";

export type RoomContent =
  | { mode: "quotes" | "words" }
  | { mode: "custom"; text: string }
  | { mode: "code"; language: CodeLanguage; snippet: number; text?: string };

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
  return content.mode === "code"
    ? `${codeLanguages.find((language) => language.id === content.language)?.name} · ${content.snippet === -1 ? "Your code" : codeSnippet(content.language, content.snippet).title}`
    : roomContentOptions.find((option) => option.value === content.mode)!.label;
}

export function validRoomContent(content: RoomContent) {
  if (content.mode === "custom")
    return makePassage("custom", 0, content.text).length >= 30;
  if (content.mode === "code" && content.snippet === -1)
    return (
      normalizeCode(content.text || "").trim().length >= 10 &&
      normalizeCode(content.text || "").length <= 2000
    );
  return true;
}

export function makeRoomPassage(
  content: RoomContent,
  seed: number,
  duration: number,
) {
  if (content.mode === "code")
    return content.snippet === -1
      ? normalizeCode(content.text || "")
      : codeSnippet(content.language, content.snippet).code;
  return makePassage(
    content.mode,
    seed,
    content.mode === "custom" ? content.text : "",
    [],
    duration,
  );
}
