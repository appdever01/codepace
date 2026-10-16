import python from "../public/coding/python.json" with { type: "json" };
import javascript from "../public/coding/javascript.json" with { type: "json" };
import typescript from "../public/coding/typescript.json" with { type: "json" };
import java from "../public/coding/java.json" with { type: "json" };
import cpp from "../public/coding/cpp.json" with { type: "json" };
import go from "../public/coding/go.json" with { type: "json" };
import rust from "../public/coding/rust.json" with { type: "json" };
import { codeSnippet, normalizeCode, type CodeLanguage } from "./coding.ts";
import { makePassage } from "./passages.ts";
import type { RoomContent } from "./room-content.ts";
import { roomProblem } from "./room-problems.ts";
import { ROOM_MAX_TYPED_LENGTH } from "./room-limits.ts";

const solutions: Record<CodeLanguage, Record<string, string>> = {
  python,
  javascript,
  typescript,
  java,
  cpp,
  go,
  rust,
};

export function makeRoomPassage(
  content: RoomContent,
  seed: number,
  duration: number,
) {
  if (content.mode === "code") {
    if (content.problemId !== undefined) {
      const problem = roomProblem(content.language, content.problemId);
      const code = problem && solutions[content.language][problem.id];
      if (!code || code.length > ROOM_MAX_TYPED_LENGTH)
        throw new Error(
          "This solution is unavailable. Choose another problem.",
        );
      return normalizeCode(code);
    }
    return content.snippet === -1
      ? normalizeCode(content.text || "")
      : codeSnippet(content.language, content.snippet).code;
  }
  return makePassage(
    content.mode,
    seed,
    content.mode === "custom" ? content.text : "",
    [],
    duration,
  );
}
