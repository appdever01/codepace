# Keylane

A typing game with timed races, adjustable pace bots, focused practice and invitation rooms for up to six friends.

## Run locally

Use Node.js 22.13 or later.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_many_warpath.sql
npm start -- --port 5189
```

Open `http://127.0.0.1:5189`. Run the migration only once for each new local database. After the first build and migration, `npm run dev -- --port 5189` provides live updates. Keep only one preview running at a time.

The build creates ignored local hosting configuration automatically. No credentials are needed for local races or local friend-room testing. To self-host, bind a Cloudflare D1 database as `DB`, apply the migration, and deploy the generated Worker and client assets. Sites hosting metadata and personal assistant files remain local and ignored.

## Check

```sh
npm test
npm run test:ui
npm run typecheck
npm run lint
npm run build
```

With the built server running on port 5189, `npm run test:rooms` checks real two-player requests, shared starts, progress, access rules, concurrent capacity, results, rematches and host handover. Set `KEYLANE_TEST_URL` to use a different local server. The script creates temporary test rooms; do not point it at a real shared room.

## Behavior

- Race for up to 15, 30 or 60 seconds; completing the passage finishes your run early. Solo races include three clearly labelled pace bots; practice has no opponents.
- Try the daily 15-second word sprint, build clean-key streaks, and choose Chill, Quick or Turbo opponents.
- Practice words, original passages, JavaScript or your own text. Missed-letter drills draw from your actual mistakes.
- Correct mistakes with backspace. Accuracy remembers errors after correction. Paste and drop are blocked in the race field.
- Speed uses five correct characters per word. Results and preferences stay in this browser; they do not sync between devices. Export your last 100 results from Progress.
- Friend rooms use D1 and update roughly every 800ms. They have a server-timed countdown, six-player capacity, host handover, reconnect support and a two-hour expiry. The host opens each new round. These are casual races; client-reported keystrokes cannot provide competition-grade cheat prevention.
- Private Sites hosting restricts who can open an invite. Change the Site audience deliberately before inviting people outside its allowed viewers.

## Source and licenses

The scoring helpers in `lib/scoring.ts` are adapted from [Andrew Roach’s typerace](https://github.com/aroach98/typerace), MIT licensed. Its full notice is preserved in `LICENSE-typerace`. The interface, typing lifecycle and D1 room implementation are new. No proprietary TypeRacer code, quotes or assets are copied.

DM Sans and DM Mono are self-hosted under their included SIL Open Font Licenses. Solar icons are supplied through `@solar-icons/react`. The Solar Icon Set is by 480 Design and is used under CC BY 4.0; its license is included in `public/Solar-Icons-LICENSE.txt`. The Sites/Vinext build integration retains its original license in `build/`.
