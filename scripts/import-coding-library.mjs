import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const revision = "d5ebb3ea8bd4b52d605bc7aa179e22af684d31bb";
const languages = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  java: "java",
  cpp: "cpp",
  go: "go",
  rust: "rs",
};
const temporary = await mkdtemp(path.join(tmpdir(), "codepace-solutions-"));
try {
  const response = await fetch(
    `https://codeload.github.com/neetcode-gh/leetcode/tar.gz/${revision}`,
  );
  if (!response.ok)
    throw new Error(`Solution download failed: ${response.status}`);
  const archive = path.join(temporary, "source.tgz");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync("tar", ["-xzf", archive, "-C", temporary]);
  const source = path.join(temporary, `leetcode-${revision}`);
  const problems = JSON.parse(
    await readFile(path.join(source, ".problemSiteData.json"), "utf8"),
  );
  const available = new Map();
  const counts = {};
  await mkdir("public/coding", { recursive: true });
  for (const [language, extension] of Object.entries(languages)) {
    const files = new Set(await readdir(path.join(source, language)));
    const solutions = {};
    for (const problem of problems) {
      const filename = `${problem.code}.${extension}`;
      if (!files.has(filename)) continue;
      const text = (
        await readFile(path.join(source, language, filename), "utf8")
      )
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, "    ")
        .trimEnd();
      if (!text.trim() || text.length > 20000) continue;
      solutions[problem.code] = text;
      available.set(problem.code, [
        ...(available.get(problem.code) || []),
        language,
      ]);
    }
    counts[language] = Object.keys(solutions).length;
    await writeFile(
      `public/coding/${language}.json`,
      JSON.stringify(solutions),
    );
  }
  const catalog = problems
    .filter((p) => available.has(p.code))
    .map((p) => ({
      id: p.code,
      number: Number(p.code.split("-")[0]),
      title: p.problem,
      topic: p.pattern,
      difficulty: p.difficulty,
      slug: p.link.replace(/\/$/, ""),
      languages: available.get(p.code),
      neetcode150: p.neetcode150 === true,
    }))
    .sort((a, b) => a.number - b.number);
  await writeFile("lib/coding-catalog.json", JSON.stringify(catalog));
  const license = await readFile(path.join(source, "LICENSE"), "utf8");
  await writeFile("public/coding/LICENSE-neetcode.txt", license);
  await writeFile(
    "public/coding/source.json",
    JSON.stringify(
      {
        repository: "https://github.com/neetcode-gh/leetcode",
        revision,
        license: "MIT",
        changes:
          "CRLF normalized; tabs expanded to four spaces; trailing whitespace at end of file removed. Files over 20,000 characters omitted.",
        problems: catalog.length,
        solutions: counts,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ problems: catalog.length, solutions: counts }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
