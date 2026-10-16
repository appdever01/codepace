import { z } from "zod";
import { codeLanguages, normalizeCode, type CodeLanguage } from "./coding.ts";
import { makePassage } from "./passages.ts";
import type { RoomContent } from "./room-content.ts";
import { roomProblem } from "./room-problems.ts";

export const roomContentSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("quotes") }),
    z.object({ mode: z.literal("words") }),
    z.object({ mode: z.literal("custom"), text: z.string().max(2000) }),
    z.object({
      mode: z.literal("code"),
      language: z.enum(
        codeLanguages.map((language) => language.id) as [
          CodeLanguage,
          ...CodeLanguage[],
        ],
      ),
      snippet: z.number().int().min(-1).max(2),
      text: z.string().max(2000).optional(),
      problemId: z.string().min(1).max(150).optional(),
    }),
  ])
  .transform((content): RoomContent => {
    if (content.mode === "code" && content.problemId !== undefined)
      return {
        mode: "code",
        language: content.language,
        snippet: 0,
        problemId: content.problemId,
      };
    if (content.mode === "custom")
      return { ...content, text: makePassage("custom", 0, content.text) };
    if (content.mode === "code" && content.snippet === -1)
      return { ...content, text: normalizeCode(content.text || "") };
    return content;
  })
  .superRefine((content, context) => {
    if (
      content.mode === "code" &&
      content.problemId !== undefined &&
      !roomProblem(content.language, content.problemId)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a problem available in this language.",
      });
    if (content.mode === "custom" && content.text.length < 30)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least 30 characters of text.",
      });
    if (
      content.mode === "code" &&
      content.snippet === -1 &&
      ((content.text || "").trim().length < 10 ||
        (content.text || "").length > 2000)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use 10 to 2,000 characters of code.",
      });
  });
