"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MusicNoteIcon } from "@solar-icons/react/linear/music-note";
import { VolumeLoudIcon } from "@solar-icons/react/linear/volume-loud";
import { VolumeCrossIcon } from "@solar-icons/react/linear/volume-cross";
import { KeyboardIcon } from "@solar-icons/react/linear/keyboard";

export default function AudioControls({
  musicEnabled,
  musicPlaying,
  musicVolume,
  typingSound,
  onToggleMusic,
  onVolumeChange,
  onToggleTyping,
}: {
  musicEnabled: boolean;
  musicPlaying: boolean;
  musicVolume: number;
  typingSound: boolean;
  onToggleMusic: () => void;
  onVolumeChange: (value: number) => void;
  onToggleTyping: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      ref={root}
      className="audio-controls"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="icon-button audio-trigger"
        aria-label="Open audio settings"
        title="Audio settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((previous) => !previous)}
      >
        {musicEnabled || typingSound ? <VolumeLoudIcon /> : <VolumeCrossIcon />}
        {musicPlaying && <span className="audio-playing" />}
      </button>
      {open && (
        <div
          id={id}
          className="audio-popover"
          role="dialog"
          aria-label="Audio settings"
        >
          <h2>Audio</h2>
          <div className="audio-setting">
            <MusicNoteIcon aria-hidden="true" />
            <span>
              Background music
              <small>
                {musicPlaying
                  ? "Reverie is playing"
                  : musicEnabled
                    ? "Starts when you interact"
                    : "Off"}
              </small>
            </span>
            <button
              className="audio-switch"
              aria-label={
                musicEnabled
                  ? "Turn background music off"
                  : "Turn background music on"
              }
              aria-pressed={musicEnabled}
              onClick={onToggleMusic}
            >
              <span />
            </button>
          </div>
          <label className="audio-volume" htmlFor={`${id}-volume`}>
            Volume <span>{Math.round(musicVolume * 100)}%</span>
          </label>
          <input
            id={`${id}-volume`}
            type="range"
            aria-label="Music volume"
            min={0}
            max={100}
            value={Math.round(musicVolume * 100)}
            onChange={(event) =>
              onVolumeChange(Number(event.target.value) / 100)
            }
          />
          <div className="audio-setting audio-typing">
            <KeyboardIcon aria-hidden="true" />
            <span>
              Typing sounds<small>A soft click as you type</small>
            </span>
            <button
              className="audio-switch"
              aria-label={
                typingSound ? "Turn typing sound off" : "Turn typing sound on"
              }
              aria-pressed={typingSound}
              onClick={onToggleTyping}
            >
              <span />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
