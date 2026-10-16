import { memo, useMemo } from "react";

export const PassageGlyphs = memo(function PassageGlyphs({
  text,
  typed,
  caret,
  code = false,
}: {
  text: string;
  typed: string;
  caret: boolean;
  code?: boolean;
}) {
  let offset = 0;
  return Array.from(text).map((char) => {
    const i = offset;
    offset += char.length;
    return (
      <span
        key={i}
        className={`${i < typed.length ? (typed.slice(i, i + char.length) === char ? "correct-char" : "wrong-char") : ""} ${caret && i === typed.length ? "caret" : ""} ${code && char === "\n" ? "code-newline" : ""}`}
      >
        {code && char === "\n" ? "↵" : char}
      </span>
    );
  });
});

export default memo(function TypingPassage({
  passage,
  typed,
}: {
  passage: string;
  typed: string;
}) {
  const words = useMemo(() => {
    let start = 0;
    const parts = passage.split(" ");
    return parts.map((word, i) => {
      const text = word + (i < parts.length - 1 ? " " : "");
      const offset = start;
      start += text.length;
      return { text, start: offset, end: start };
    });
  }, [passage]);
  return words.map((word) => (
    <span className="word" key={word.start}>
      <PassageGlyphs
        text={word.text}
        typed={typed.slice(word.start, word.end)}
        caret={typed.length >= word.start && typed.length < word.end}
      />
    </span>
  ));
});
