"use client";

import { useEffect, useId, useState } from "react";
import CustomSelect from "./custom-select";
import { codeLanguages, codeSnippet, type CodeLanguage } from "@/lib/coding";
import {
  defaultRoomContent,
  roomContentOptions,
  validRoomContent,
  type RoomContent,
} from "@/lib/room-content";

type SetupProps = {
  content: RoomContent;
  duration: number;
  disabled: boolean;
  onChange: (content: RoomContent, duration: number) => void;
};

export default function RoomSetup({
  content,
  duration,
  disabled,
  onChange,
}: SetupProps) {
  const textId = useId();
  const editableText =
    content.mode === "custom" ||
    (content.mode === "code" && content.snippet === -1);
  return (
    <div className="room-setup-fields">
      <CustomSelect
        label="Content"
        value={content.mode}
        disabled={disabled}
        options={roomContentOptions}
        onChange={(mode) =>
          onChange(
            mode === "code"
              ? { ...defaultRoomContent }
              : mode === "custom"
                ? { mode, text: "" }
                : { mode: mode as "quotes" | "words" },
            duration,
          )
        }
      />
      <CustomSelect
        label="Race length"
        value={String(duration)}
        disabled={disabled}
        options={[15, 30, 60].map((seconds) => ({
          value: String(seconds),
          label: `${seconds} seconds`,
        }))}
        onChange={(seconds) => onChange(content, Number(seconds))}
      />
      {content.mode === "code" && (
        <>
          <CustomSelect
            label="Language"
            value={content.language}
            disabled={disabled}
            options={codeLanguages.map((language) => ({
              value: language.id,
              label: language.name,
            }))}
            onChange={(language) =>
              onChange(
                { ...content, language: language as CodeLanguage },
                duration,
              )
            }
          />
          <CustomSelect
            label="Exercise"
            value={String(content.snippet)}
            disabled={disabled}
            options={[
              ...[0, 1, 2].map((snippet) => ({
                value: String(snippet),
                label: codeSnippet(content.language, snippet).title,
              })),
              { value: "-1", label: "Your code" },
            ]}
            onChange={(snippet) =>
              onChange({ ...content, snippet: Number(snippet) }, duration)
            }
          />
        </>
      )}
      {editableText && (
        <label className="room-text-field" htmlFor={textId}>
          {content.mode === "code" ? "Your code" : "Your text"}
          <textarea
            id={textId}
            className={content.mode === "code" ? "room-code-input" : ""}
            value={"text" in content ? content.text || "" : ""}
            disabled={disabled}
            maxLength={2000}
            rows={4}
            spellCheck={content.mode !== "code"}
            placeholder={
              content.mode === "code"
                ? "Paste at least 10 characters of code"
                : "Paste at least 30 characters of text"
            }
            onChange={(event) =>
              onChange(
                { ...content, text: event.target.value } as RoomContent,
                duration,
              )
            }
          />
        </label>
      )}
    </div>
  );
}

export function RoomConfiguration({
  content,
  duration,
  disabled,
  onApply,
  onDirtyChange,
}: Omit<SetupProps, "onChange"> & {
  onDirtyChange: (dirty: boolean) => void;
  onApply: (content: RoomContent, duration: number) => void;
}) {
  const [draft, setDraft] = useState({ content, duration });
  const changed =
    JSON.stringify(draft) !== JSON.stringify({ content, duration });
  useEffect(() => {
    onDirtyChange(changed);
  }, [changed, onDirtyChange]);
  return (
    <form
      className="room-configuration"
      aria-label="Room setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed && validRoomContent(draft.content) && !disabled)
          onApply(draft.content, draft.duration);
      }}
    >
      <RoomSetup
        {...draft}
        disabled={disabled}
        onChange={(content, duration) => setDraft({ content, duration })}
      />
      {changed && (
        <button
          className="button secondary"
          disabled={disabled || !validRoomContent(draft.content)}
        >
          Apply selection
        </button>
      )}
    </form>
  );
}
