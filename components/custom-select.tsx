"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { CheckCircleIcon } from "@solar-icons/react/linear/check-circle";

type Option = { value: string; label: string; detail?: string };

export default function CustomSelect({
  label,
  value,
  options,
  className,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [previousDisabled, setPreviousDisabled] = useState(disabled);
  const [active, setActive] = useState(0);
  if (previousDisabled !== disabled) {
    setPreviousDisabled(disabled);
    if (disabled) setOpen(false);
  }
  const selected = options.findIndex((option) => option.value === value);
  const expanded = open && !disabled;

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  useEffect(() => {
    if (expanded)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, expanded, id]);

  function choose(index: number) {
    if (disabled || !options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className={className ? `code-field ${className}` : "code-field"}>
      <span id={`${id}-label`}>{label}</span>
      <div
        className="code-select"
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setOpen(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          role="combobox"
          value={value}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-list` : undefined}
          aria-activedescendant={
            expanded ? `${id}-option-${active}` : undefined
          }
          className="code-select-trigger"
          onClick={() => {
            setActive(Math.max(0, selected));
            search.current = { text: "", at: 0 };
            setOpen((previous) => !previous);
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
              setActive((previous) =>
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : !expanded
                      ? Math.max(0, selected)
                      : (previous +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        options.length,
              );
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              if (expanded) choose(active);
              else {
                setActive(Math.max(0, selected));
                setOpen(true);
              }
            } else if (event.key === "Escape" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "Tab") {
              setOpen(false);
            } else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.preventDefault();
              const now = Date.now();
              const text =
                (now - search.current.at < 700 ? search.current.text : "") +
                event.key.toLowerCase();
              search.current = { text, at: now };
              const match = options.findIndex((option) =>
                option.label.toLowerCase().startsWith(text),
              );
              if (match >= 0) {
                setActive(match);
                setOpen(true);
              }
            }
          }}
        >
          <span>{options[selected]?.label || "Choose an option"}</span>
          {options[selected]?.detail && (
            <small>{options[selected].detail}</small>
          )}
          <AltArrowDownIcon aria-hidden="true" />
        </button>
        {expanded && (
          <ul
            id={`${id}-list`}
            className="code-select-menu"
            role="listbox"
            aria-labelledby={`${id}-label`}
          >
            {options.map((option, index) => (
              <li
                id={`${id}-option-${index}`}
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                data-highlighted={index === active}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {option.detail && <small>{option.detail}</small>}
                {option.value === value && (
                  <CheckCircleIcon aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
