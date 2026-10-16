# Keylane

Keylane helps you practice typing code. Start with a snippet, a LeetCode solution or your own code, and track your speed and accuracy. Text practice, quick races and rooms with friends are also available.

## Play

- Practice Python, JavaScript, TypeScript, Java, C++, Go and Rust with formatting and indentation preserved.
- Type open-source solutions from a library of 410 coding problems.
- Finish a complete code exercise or practice for 60 or 180 seconds. Code is not executed or graded.
- Race for 15, 30 or 60 seconds against three pace bots, or practice words, passages and custom text.
- Invite up to five friends for a shared race, then play another round.
- Review your progress, export results, and adjust the theme and sound.

## Run locally

Use Node.js 24, npm and PostgreSQL 17 or later.

```sh
git clone https://github.com/appdever01/keylane.git
cd keylane
npm ci
cp .env.example .env.local
createdb keylane
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
npm run test:rooms
npm run test:load
```

These checks exercise player workflows, concurrent room changes and six-player progress. Run them one at a time against a development database. GitHub Actions runs the same checks with its own PostgreSQL service. See [contribution.md](contribution.md) for the project layout and pull request guidance.

## Results and rooms

Speed counts five correct characters as one word. Backspace lets you correct mistakes, but those mistakes still count toward accuracy. Finishing a passage ends the run early.

Results and preferences stay in your browser. They do not sync between devices or domains. Export any results you want to keep before changing browsers or clearing storage.

Friend rooms use shared PostgreSQL storage and expire after two hours. The host starts each round, and another player takes over if the host leaves. Room sessions survive reloads and temporary connection failures. Rooms are intended for casual play and rely on progress reported by each player's browser.

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
