"use client";

import { useId, useState } from "react";
import {
  localDateTime,
  MAX_SCHEDULE_AHEAD_MS,
  parseLocalDateTime,
  scheduleProblem,
} from "@/lib/room-schedule";

export default function RoomSchedule({
  scheduledAt,
  serverNow,
  host,
  disabled,
  onSchedule,
  onCancel,
}: {
  scheduledAt: number | null;
  serverNow: number;
  host: boolean;
  disabled: boolean;
  onSchedule: (timestamp: number) => Promise<boolean>;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const edit = () => {
    setValue(localDateTime(scheduledAt || Date.now() + 600000));
    setProblem("");
    setEditing(true);
  };
  if (!host && scheduledAt === null) return null;
  return (
    <section className="room-schedule" aria-label="Scheduled start">
      {scheduledAt !== null && (
        <div className="room-schedule-status" role="status">
          <strong>
            Starts{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "long",
            }).format(scheduledAt)}
          </strong>
          <p>
            {serverNow >= scheduledAt
              ? "Waiting for two connected players. The race will start automatically."
              : "Starts automatically with at least two connected players. You can join until the countdown begins."}
          </p>
        </div>
      )}
      {host && !editing && (
        <div className="room-schedule-actions">
          <button
            className="button secondary small"
            disabled={disabled}
            onClick={edit}
          >
            {scheduledAt === null ? "Schedule start" : "Change time"}
          </button>
          {scheduledAt !== null && (
            <button
              className="text-button"
              disabled={disabled}
              onClick={onCancel}
            >
              Cancel scheduled start
            </button>
          )}
        </div>
      )}
      {host && editing && (
        <form
          className="room-schedule-form"
          aria-label="Schedule race"
          onSubmit={async (event) => {
            event.preventDefault();
            if (disabled) return;
            const timestamp = parseLocalDateTime(value);
            const validation = scheduleProblem(timestamp, serverNow);
            if (validation) {
              setProblem(validation);
              return;
            }
            if (await onSchedule(timestamp)) setEditing(false);
          }}
        >
          <label htmlFor={inputId}>
            Start time ({timezone})
            <input
              id={inputId}
              type="datetime-local"
              value={value}
              disabled={disabled}
              required
              step={60}
              min={localDateTime(
                Math.ceil((serverNow + 10000) / 60000) * 60000,
              )}
              max={localDateTime(serverNow + MAX_SCHEDULE_AHEAD_MS)}
              aria-invalid={!!problem}
              aria-describedby={problem ? `${inputId}-error` : undefined}
              onChange={(event) => {
                setValue(event.target.value);
                setProblem("");
              }}
            />
          </label>
          <button className="button primary small" disabled={disabled}>
            Schedule race
          </button>
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          {problem && (
            <p id={`${inputId}-error`} className="form-error" role="alert">
              {problem}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
