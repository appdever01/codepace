# CodePace

CodePace helps you practice typing code. Start with a snippet, a LeetCode solution or your own code, and track your speed and accuracy. Text practice, quick races and rooms with friends are also available.

[Play CodePace](https://codepace.vercel.app)

## Play

- Practice Python, JavaScript, TypeScript, Java, C++, Go and Rust with formatting and indentation preserved.
- Type open-source solutions from a library of 410 coding problems.
- Finish a complete code exercise or practice for 60 or 180 seconds. Code is not executed or graded.
- Race for 15, 30 or 60 seconds against three pace bots, or practice words, passages and custom text.
- Invite up to 49 friends to race with code, passages, words or your own text. The host chooses the shared content and can change it before each round.
- Schedule a room to start automatically up to seven days ahead, or start immediately.
- Review your progress, export results, and adjust the theme and sound.

## Run locally

Use Node.js 24, npm and PostgreSQL 17 or later.

```sh
git clone https://github.com/appdever01/codepace.git
cd codepace
npm ci
cp .env.example .env.local
createdb codepace
npm run db:migrate
npm run dev
```

Open <http://localhost:5189>. If your database needs a username or password, update `DATABASE_URL` in `.env.local` before running the migration. Solo play works without a database; friend rooms need one.

For a production preview, stop the development server, then run `npm run build` and `npm start`.

## Check changes

```sh
npm run check
```

With the local server running on port 5189, also run:

```sh
npm run test:ui
npm run test:seo
npm run test:rooms
npm run test:schedules
npm run test:leetcode
npm run test:load
```

These checks exercise player workflows, concurrent room changes and 50-player progress. Run them one at a time against a development database. GitHub Actions runs the same checks with its own PostgreSQL service. See [contribution.md](contribution.md) for the project layout and pull request guidance.

## Search discovery

The canonical address is `https://codepace.vercel.app/`. Search titles, descriptions, social previews and structured site information share the settings in `lib/seo.ts`. The homepage has a server-rendered heading and JSON-LD. Vercel preview deployments use `noindex`.

`/robots.txt` allows public pages and assets, excludes the gameplay API and points to `/sitemap.xml`. The sitemap includes the homepage; the app's tabs and temporary room invitations are not separate pages. `/llms.txt` describes the app for AI tools, and `/llm.txt` redirects there. Update the public facts in that file when features change.

After deployment, submit `https://codepace.vercel.app/sitemap.xml` through the verified Google Search Console and Bing Webmaster Tools accounts. Sitemap submission and these files do not guarantee indexing or rankings. Run `npm run test:seo` against the running app; set `CODEPACE_TEST_URL` to check another deployment, and `CODEPACE_EXPECT_INDEXABLE=false` for a preview. This checks HTTP responses without opening a browser.

## Results and rooms

Speed counts five correct characters as one word. Backspace lets you correct mistakes, but those mistakes still count toward accuracy. Finishing a passage ends the run early.

Results and preferences stay in your browser. They do not sync between devices or domains. Export any results you want to keep before changing browsers or clearing storage.

Friend rooms use shared PostgreSQL storage and expire after two hours, or two hours after a scheduled start. The host can start each round immediately or schedule it up to seven days ahead using their local date and time. Everyone sees the scheduled time in their own time zone. The shared countdown starts automatically with at least two connected players, including when the host tab is closed. If fewer than two are connected, the room waits and starts when two are ready. Joining closes when the countdown begins. The host can change or cancel a schedule before that countdown, or choose Start now. A new round clears the previous schedule, and another player takes over if the host leaves. Room sessions survive reloads and temporary connection failures. Rooms are intended for casual play and rely on progress reported by each player's browser.

In a code room, choose LeetCode from Exercise, search for a problem and select it. Everyone types the same complete NeetCode solution in the chosen language. The host can change the problem before starting or scheduling the round. This is a typing race; code is not executed or graded.

## Deploy to Vercel

Import the repository into Vercel with the Next.js preset. Create a Neon PostgreSQL database in AWS US East (N. Virginia), then add its pooled connection string as the sensitive `DATABASE_URL` environment variable in Vercel. The app's functions run in the matching `iad1` region.

Apply the migrations once before deploying. Use a direct database connection for migrations:

```sh
DATABASE_URL='<direct database connection string>' node scripts/migrate.mjs
```

Keep preview and development environments on a separate database or Neon branch. Never commit connection strings. Deployments do not run database migrations automatically.

Vercel builds with `npm run build`. Pushes to `main` deploy production; pull requests get preview deployments when the Vercel GitHub integration has access.

## License

The code is available under the [MIT License](LICENSE). Bundled dependencies and assets retain their own licenses and notices.
