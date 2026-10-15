import type { TextMode } from "./race.ts";

const prose = [
  "The city was still quiet when she stepped outside. A bicycle leaned against the bakery wall, and the first light caught the windows across the street. She had no particular place to be. For once, that felt like a good place to start.",
  "There is a small pleasure in getting a little better at something. You notice it in the pauses that disappear, the mistakes you catch sooner, and the work that begins to feel natural. Progress rarely makes a grand entrance. Most days, it simply shows up and takes a seat.",
  "We took the long way home, past the bookshop and down to the water. Someone was playing a piano through an open window. The music followed us for half a street, then faded into the sound of evening traffic. Neither of us said much. There was nothing missing.",
  "A good idea often begins as a question written in the margin. Give it some room. Try the small version first, see what happens, and change the part that does not work. You do not need the whole map to take the next useful step.",
  "Rain arrived just before lunch. We pulled the chairs inside and watched the garden turn a deeper green. My brother made tea while I found the old photo album. By the time the clouds cleared, we had forgotten the plans we were so worried about that morning.",
  "The best part of learning is the moment a difficult thing becomes familiar. Your hands find the right keys, your thoughts have room to move, and the work feels a little lighter. Take your time with it. A steady rhythm will carry you further than a hurried start.",
];
const words =
  "time people way day thing work life world school state family student group country problem hand part place case week company system program question number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face level office door health person art war history party result change morning reason research girl guy moment air teacher force education foot boy age policy process music market sense nation plan college interest course experience effect use class control care field development role effort rate heart light voice mind price report decision view relationship town road arm difference value building action model season society tax director position player record paper space ground form event center rule matter practice peace enjoy learn improve build river garden window sound write read think quiet green clear little good great make move open share start finish race type speed focus calm better today travel dream create".split(
    " ",
  );
const snippets = [
  'const focus = (task) => task.trim(); const steps = ["learn", "practice", "repeat"]; for (const step of steps) { console.log(focus(step)); }',
  "function average(values) { const total = values.reduce((sum, value) => sum + value, 0); return values.length ? total / values.length : 0; }",
  'const users = [{ name: "Ada", active: true }, { name: "Lin", active: false }]; const names = users.filter(user => user.active).map(user => user.name);',
];

export function makePassage(
  mode: TextMode,
  seed: number,
  custom = "",
  weak: string[] = [],
  seconds = 30,
) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  if (mode === "custom")
    return custom.replace(/\s+/g, " ").trim().slice(0, 2000);
  const shorten = (text: string) => {
    const capped = text.slice(0, Math.max(150, seconds * 10));
    const end = capped.lastIndexOf(" ");
    return (end > 0 ? capped.slice(0, end) : capped).trim();
  };
  if (mode === "words") {
    const focused = weak.length
      ? words.filter((word) => weak.some((key) => word.includes(key)))
      : words;
    const pool = focused.length >= 10 ? focused : words;
    return shorten(
      Array.from(
        { length: 220 },
        () => pool[Math.floor(random() * pool.length)],
      ).join(" "),
    );
  }
  const pool = mode === "code" ? snippets : prose;
  return shorten(
    Array.from(
      { length: mode === "code" ? 10 : 6 },
      () => pool[Math.floor(random() * pool.length)],
    ).join(" "),
  );
}
