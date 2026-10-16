export default function CodePassage({
  code,
  typed,
}: {
  code: string;
  typed: string;
}) {
  let offset = 0;
  const lines = code.split("\n");
  return lines.map((line, index) => {
    const start = offset;
    offset += line.length + 1;
    let glyph = 0;
    const content = line + (index < lines.length - 1 ? "\n" : "");
    return (
      <span className="code-line" key={index}>
        <span className="code-line-number">{index + 1}</span>
        <span className="code-line-content">
          {Array.from(content).map((char) => {
            const i = start + glyph;
            glyph += char.length;
            return (
              <span
                key={i}
                className={`${i < typed.length ? (typed.slice(i, i + char.length) === char ? "correct-char" : "wrong-char") : ""} ${i === typed.length ? "caret" : ""} ${char === "\n" ? "code-newline" : ""}`}
              >
                {char === "\n" ? "↵" : char}
              </span>
            );
          })}
        </span>
      </span>
    );
  });
}
