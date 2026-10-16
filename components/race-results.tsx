import type { ReactNode } from "react";
import { KeyboardIcon } from "@solar-icons/react/linear/keyboard";
import RaceTrophy from "@/components/race-trophy";
import type { RaceResult } from "@/lib/race";

export default function RaceResults({
  result,
  attempted,
  practice,
  code,
  placement,
  previousBest,
  children,
}: {
  result: RaceResult | null;
  attempted: boolean;
  practice: boolean;
  code?: { completed: boolean; length: number; fromLibrary: boolean };
  placement?: { position: number; total: number };
  previousBest: number;
  children?: ReactNode;
}) {
  const recorded = attempted && result !== null;
  const personalBest = recorded && result.wpm > previousBest;
  const samples = result?.samples ?? [];
  const peak = samples.reduce((highest, value) => Math.max(highest, value), 0);
  const showChart = recorded && samples.length > 1 && peak > 0;
  const points = samples.map(
    (value, index) =>
      `${(index / Math.max(1, samples.length - 1)) * 600},${96 - (value / Math.max(1, peak)) * 88}`,
  );
  const title = !recorded
    ? "No typing recorded"
    : code
      ? code.completed
        ? "Code typed. Nicely done."
        : "Practice time complete."
      : practice
        ? "Practice complete"
        : "Race complete";

  return (
    <section
      className={`race-results ${recorded ? "has-result" : "empty-result"}`}
      aria-label="Your result"
      aria-live="polite"
    >
      {recorded ? (
        <>
          <div className="result-summary-heading">
            <div>
              <h2>{title}</h2>
              <p>
                {code
                  ? `${result.correct} of ${code.length} characters typed correctly.${code.fromLibrary ? " Code is not executed or graded." : ""}`
                  : personalBest
                    ? "Your fastest race so far."
                    : `${Math.round(result.duration)} seconds of typing.`}
              </p>
            </div>
            {personalBest && (
              <span className="result-award" aria-hidden="true">
                <RaceTrophy />
              </span>
            )}
          </div>
          {(personalBest || placement) && (
            <div className="result-context">
              {personalBest && (
                <span className="result-best">Personal best</span>
              )}
              {placement && (
                <span>
                  Position {placement.position} of {placement.total}
                </span>
              )}
            </div>
          )}
          <div className="result-scoreboard">
            <div className="result-speed">
              <span>Typing speed</span>
              <strong>
                {result.wpm}
                <small>WPM</small>
              </strong>
            </div>
            <dl className="result-details">
              <div>
                <dt>Accuracy</dt>
                <dd>
                  {result.accuracy}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>Consistency</dt>
                <dd>
                  {result.consistency}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>Correct characters</dt>
                <dd>{result.correct}</dd>
              </div>
              <div>
                <dt>Mistakes</dt>
                <dd>{result.errors}</dd>
              </div>
            </dl>
          </div>
          {showChart && (
            <figure className="result-pace">
              <figcaption>
                <span>Pace over time</span>
                <span>Peak {peak} WPM</span>
              </figcaption>
              <svg
                viewBox="0 0 600 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Speed over the race: ${samples.join(", ")} words per minute`}
              >
                <path
                  className="result-pace-area"
                  d={`M0,100 L${points.join(" L")} L600,100 Z`}
                />
                <path
                  className="result-pace-line"
                  d={`M${points.join(" L")}`}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="result-pace-axis">
                <span>0s</span>
                <span>{Math.round(result.duration)}s</span>
              </div>
            </figure>
          )}
        </>
      ) : (
        <div className="result-empty-message">
          <span className="result-empty-symbol" aria-hidden="true">
            <KeyboardIcon />
          </span>
          <h2>{title}</h2>
          <p>
            No result was saved. Start typing in the next round to record your
            pace.
          </p>
        </div>
      )}
      {children}
    </section>
  );
}
