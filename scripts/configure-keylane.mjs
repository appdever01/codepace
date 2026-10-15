import { existsSync, mkdirSync, writeFileSync } from "node:fs";
mkdirSync(".openai", { recursive: true });
if (!existsSync(".openai/hosting.json"))
  writeFileSync(
    ".openai/hosting.json",
    JSON.stringify({ d1: "DB", r2: null }, null, 2) + "\n",
  );
