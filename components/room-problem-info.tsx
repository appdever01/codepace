import { codeLanguages } from "@/lib/coding";
import type { RoomContent } from "@/lib/room-content";
import { roomProblem } from "@/lib/room-problems";

export default function RoomProblemInfo({ content }: { content: RoomContent }) {
  if (content.mode !== "code" || !content.problemId) return null;
  const problem = roomProblem(content.language, content.problemId);
  if (!problem) return null;
  const extension = codeLanguages.find(
    (language) => language.id === content.language,
  )!.extension;
  return (
    <div className="room-problem-info" aria-label="Selected LeetCode problem">
      <div className="room-problem-heading">
        <strong>
          #{problem.number} {problem.title}
        </strong>
        <span className="room-problem-meta">
          {problem.difficulty} · {problem.topic}
        </span>
        <div className="code-source-links">
          <a
            href={`https://leetcode.com/problems/${problem.slug}/`}
            target="_blank"
            rel="noreferrer"
          >
            Read problem
          </a>
          <a
            href={`https://github.com/neetcode-gh/leetcode/blob/d5ebb3ea8bd4b52d605bc7aa179e22af684d31bb/${content.language}/${problem.id}.${extension}`}
            target="_blank"
            rel="noreferrer"
          >
            NeetCode solution
          </a>
          <a
            href="/coding/LICENSE-neetcode.txt"
            target="_blank"
            rel="noreferrer"
          >
            MIT license
          </a>
        </div>
      </div>
      <p>Type the shared solution. Code is not executed or graded.</p>
    </div>
  );
}
