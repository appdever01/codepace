export const codeLanguages = [
  { id: "python", name: "Python", extension: "py" },
  { id: "javascript", name: "JavaScript", extension: "js" },
  { id: "typescript", name: "TypeScript", extension: "ts" },
  { id: "java", name: "Java", extension: "java" },
  { id: "cpp", name: "C++", extension: "cpp" },
  { id: "go", name: "Go", extension: "go" },
  { id: "rust", name: "Rust", extension: "rs" },
] as const;
export type CodeLanguage = (typeof codeLanguages)[number]["id"];
export type CodeKind = "snippets" | "leetcode" | "custom";
export type CodeExercise = {
  code: string;
  title: string;
  language: CodeLanguage;
  kind: CodeKind;
  problemId?: string;
};
export type CodePreferences = {
  language: CodeLanguage;
  kind: CodeKind;
  problemId: string;
  snippet: number;
};
export const defaultCodePreferences: CodePreferences = {
  language: "python",
  kind: "snippets",
  problemId: "0001-two-sum",
  snippet: 0,
};
export function readCodePreferences(value: string | null): CodePreferences {
  try {
    const parsed = JSON.parse(value || "{}");
    return {
      language: codeLanguages.some((l) => l.id === parsed?.language)
        ? parsed.language
        : "python",
      kind: ["snippets", "leetcode", "custom"].includes(parsed?.kind)
        ? parsed.kind
        : "snippets",
      problemId:
        typeof parsed?.problemId === "string"
          ? parsed.problemId.slice(0, 150)
          : "0001-two-sum",
      snippet:
        Number.isInteger(parsed?.snippet) &&
        parsed.snippet >= 0 &&
        parsed.snippet < 3
          ? parsed.snippet
          : 0,
    };
  } catch {
    return { ...defaultCodePreferences };
  }
}
export const normalizeCode = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/ +$/gm, "")
    .trimEnd();
export const codeKeyLabel = (key?: string) =>
  key === " "
    ? "space"
    : key === "\n"
      ? "enter"
      : key === "\t"
        ? "tab"
        : key?.toUpperCase() || "done";
export function codeTabText(target: string, position: number) {
  const remaining = target.slice(position).match(/^ +/)?.[0].length || 0;
  return " ".repeat(Math.min(4, remaining || 4));
}
const snippetTitles = ["Functions", "Collections", "Control flow"];
const snippets: Record<CodeLanguage, string[]> = {
  python: [
    "def average(values):\n    if not values:\n        return 0\n    return sum(values) / len(values)",
    'users = [{"name": "Ada", "active": True}, {"name": "Lin", "active": False}]\nnames = [user["name"] for user in users if user["active"]]',
    'def fizz_buzz(limit):\n    for number in range(1, limit + 1):\n        if number % 15 == 0:\n            print("FizzBuzz")\n        elif number % 3 == 0:\n            print("Fizz")\n        elif number % 5 == 0:\n            print("Buzz")\n        else:\n            print(number)',
  ],
  javascript: [
    "function average(values) {\n    if (values.length === 0) return 0;\n    const total = values.reduce((sum, value) => sum + value, 0);\n    return total / values.length;\n}",
    'const users = [\n    { name: "Ada", active: true },\n    { name: "Lin", active: false },\n];\nconst names = users.filter(user => user.active).map(user => user.name);',
    "function binarySearch(values, target) {\n    let left = 0;\n    let right = values.length - 1;\n    while (left <= right) {\n        const mid = Math.floor((left + right) / 2);\n        if (values[mid] === target) return mid;\n        if (values[mid] < target) left = mid + 1;\n        else right = mid - 1;\n    }\n    return -1;\n}",
  ],
  typescript: [
    "function average(values: number[]): number {\n    if (values.length === 0) return 0;\n    const total = values.reduce((sum, value) => sum + value, 0);\n    return total / values.length;\n}",
    'type User = { name: string; active: boolean };\nconst users: User[] = [\n    { name: "Ada", active: true },\n    { name: "Lin", active: false },\n];\nconst names = users.filter(user => user.active).map(user => user.name);',
    "function findIndex<T>(values: T[], target: T): number {\n    for (let index = 0; index < values.length; index++) {\n        if (values[index] === target) return index;\n    }\n    return -1;\n}",
  ],
  java: [
    "double average(int[] values) {\n    if (values.length == 0) return 0;\n    double total = 0;\n    for (int value : values) {\n        total += value;\n    }\n    return total / values.length;\n}",
    'List<String> names = new ArrayList<>();\nnames.add("Ada");\nnames.add("Lin");\nfor (String name : names) {\n    System.out.println(name);\n}',
    "int findIndex(int[] values, int target) {\n    for (int i = 0; i < values.length; i++) {\n        if (values[i] == target) return i;\n    }\n    return -1;\n}",
  ],
  cpp: [
    "double average(const vector<int>& values) {\n    if (values.empty()) return 0;\n    double total = 0;\n    for (int value : values) {\n        total += value;\n    }\n    return total / values.size();\n}",
    'vector<string> names = {"Ada", "Lin"};\nfor (const string& name : names) {\n    cout << name << endl;\n}',
    "int findIndex(const vector<int>& values, int target) {\n    for (int i = 0; i < static_cast<int>(values.size()); i++) {\n        if (values[i] == target) return i;\n    }\n    return -1;\n}",
  ],
  go: [
    "func average(values []int) float64 {\n    if len(values) == 0 {\n        return 0\n    }\n    total := 0\n    for _, value := range values {\n        total += value\n    }\n    return float64(total) / float64(len(values))\n}",
    'names := []string{"Ada", "Lin"}\nfor index, name := range names {\n    fmt.Println(index, name)\n}',
    "func findIndex(values []int, target int) int {\n    for index, value := range values {\n        if value == target {\n            return index\n        }\n    }\n    return -1\n}",
  ],
  rust: [
    "fn average(values: &[i32]) -> f64 {\n    if values.is_empty() {\n        return 0.0;\n    }\n    let total: i32 = values.iter().sum();\n    total as f64 / values.len() as f64\n}",
    'let names = vec!["Ada", "Lin"];\nfor (index, name) in names.iter().enumerate() {\n    println!("{}: {}", index, name);\n}',
    "fn find_index(values: &[i32], target: i32) -> Option<usize> {\n    for (index, &value) in values.iter().enumerate() {\n        if value == target {\n            return Some(index);\n        }\n    }\n    None\n}",
  ],
};
export function codeSnippet(
  language: CodeLanguage,
  index: number,
): CodeExercise {
  return {
    language,
    kind: "snippets",
    title: snippetTitles[index] || snippetTitles[0],
    code: snippets[language][index] || snippets[language][0],
  };
}
