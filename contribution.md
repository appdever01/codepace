# Contributing to CodePace

Bug fixes, clearer documentation and improvements to the typing experience are welcome. Keep each contribution focused so it is easy to review and test.

## Getting started

Fork the repository, clone your fork, and follow the [local setup](README.md#run-locally). Use Node.js 24 and PostgreSQL 17 or later and install dependencies with `npm ci`.

Create a branch named for your change, such as `fix/room-reconnect` or `feature/practice-mode`. Run `npm run dev` while working. Keep one server on port 5189, and use a development database separate from production.

Copy `.env.example` to `.env.local`, set `DATABASE_URL` and apply migrations with `npm run db:migrate`. Keep credentials and generated builds out of your commits.

## Finding your way around

| Path          | What belongs here                                      |
| ------------- | ------------------------------------------------------ |
| `app/`        | Pages, the game interface, styles and room API routes. |
| `components/` | Reusable interface components and audio behavior.      |
| `lib/`        | Scoring, typing state, practice text and room rules.   |
| `db/`         | Database schema and connection setup.                  |
| `drizzle/`    | Database migrations and migration metadata.            |
| `public/`     | Static assets and their license notices.               |
| `tests/`      | Logic tests, interface workflows and room API checks.  |
| `scripts/`    | Database migrations and coding-library import tooling. |

## Reporting a problem

Include the steps to reproduce it, what you expected and what happened. For interface problems, include your browser and screen size. For local setup problems, include your Node.js version, the command you ran and the relevant error output.

Remove credentials, room tokens and personal information from anything you share. For a possible security issue, use the repository's private reporting option if available, or contact a maintainer privately before posting details publicly.

For a larger change, open an issue explaining the problem and proposed behavior before starting. Small fixes and documentation corrections can go straight to a pull request.

## Making changes

Follow the patterns in the surrounding code and keep unrelated edits out of the pull request. GitHub Actions must pass before a change is ready for review. Use clear names and explain decisions in the pull request when the reason is not obvious from the change.

Keep keyboard access, visible focus and small screens working when changing the interface. Respect reduced-motion preferences. Use the existing icon components and styles rather than adding another library for the same purpose.

Add a regression test when fixing a bug. For new behavior, cover the outcome a player should see and any relevant failure case. Documentation changes should match the current commands and behavior.

If you change the database schema, run `npm run db:generate` and include the generated migration and metadata with the schema change. Apply it with `npm run db:migrate`. Test against a fresh local database and, when it changes existing tables, a development database containing room data. Use a direct connection for hosted migrations. Keep earlier migrations intact.

## Checking your work

Start a local server on port 5189 using the [README instructions](README.md#run-locally), then run these commands in another terminal:

```sh
npm test
npm run test:ui
npm run test:rooms
npm run test:load
npm run check
```

`npm test` covers scoring, typing state and passage generation. `npm run test:ui` checks player workflows, including a friend-room race through the running API. It expects the server on port 5189.

`npm run test:rooms` checks room creation, shared starts, progress, capacity, access rules, concurrent rematches and host handover. `npm run test:load` fills one room with 50 players, refuses overflow joins and runs independent progress updates for 30 seconds. It checks saved typing, results, rematches and host handover, reports response times and removes its test participants. Set `CODEPACE_LOAD_SECONDS=60` for a full minute. To use a different local server, set `CODEPACE_TEST_URL`:

```sh
CODEPACE_TEST_URL=http://127.0.0.1:5190 npm run test:rooms
```

These checks create test rooms. Run them against a local development database. The test scripts already limit concurrency; run the commands one at a time.

For scoring or room changes, check corrections, early finishes and expired sessions as applicable. For interface changes, also check keyboard use and a narrow screen. Automated checks cover specific workflows, so verify the behavior your change affects.

## Opening a pull request

Describe the problem, what now happens and how you checked it. Link the related issue if there is one, and include screenshots when they help explain a visible change. State any known limitation or check you could not run.

Review your diff before submitting. Commit source files, relevant tests and dependency lockfile changes together. Keep secrets, local databases, generated builds and personal tooling files out of the pull request. Preserve the bundled license and asset notices, and include the required notices for any new dependency or asset.

Contributions are made under the project's [MIT License](LICENSE). Keep review discussions respectful and focused on the work.
