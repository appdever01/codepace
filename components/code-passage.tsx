import { memo, useMemo } from "react";
import { PassageGlyphs } from "./typing-passage";

export default memo(function CodePassage({
  code,
  typed,
}: {
  code: string;
  typed: string;
}) {
  const lines = useMemo(() => {
    let start = 0;
    const parts = code.split("\n");
    return parts.map((line, i) => {
      const text = line + (i < parts.length - 1 ? "\n" : "");
      const offset = start;
      start += text.length;
      return { text, start: offset, end: start };
    });
  }, [code]);
  return lines.map((line, i) => (
    <span className="code-line" key={i}>
      <span className="code-line-number">{i + 1}</span>
      <span className="code-line-content">
        <PassageGlyphs
          text={line.text}
          typed={typed.slice(line.start, line.end)}
          caret={typed.length >= line.start && typed.length < line.end}
          code
        />
      </span>
    </span>
  ));
});
