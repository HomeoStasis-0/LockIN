# LockIN — database schema

This workspace contains a PostgreSQL schema implementing the ER diagram you provided.

Files added:

- sql/schema.sql — creates tables for users, decks, cards, public decks, join tables, and user ratings.

Quick start (local postgres):

1. Start or connect to your Postgres instance.
2. Create a database:

```bash
createdb lockin_dev
```

3. Run the schema:

```bash
psql -d lockin_dev -f sql/schema.sql
```

Notes and next steps:

- You can change column types (e.g. use UUIDs) or add migration tooling.
- I can add seed data, sample queries, or a migration script (Flyway, sqitch, or a simple SQL seed).
Starter CSCE 482 Readme

## Testing

This project includes three testing layers: server unit/integration tests, frontend unit tests (Vitest), and end-to-end tests (Cypress).

- Run server tests (Jest + Supertest):

```bash
npm test
# or explicitly
npm run test:api
```

- Run client/unit tests (Vitest):

```bash
npm run client:test
```

- Verify Cypress installation (checks binary availability):

```bash
npx cypress verify
```

- Open the Cypress GUI (interactive):

```bash
npm run e2e
```

- Run Cypress headless (start dev servers first):

In one terminal start server + client:

```bash
npm run server:dev   # API on :8080
npm run client:dev   # Vite dev on :5173
```

Then in another terminal run:

```bash
npx cypress run --spec "cypress/e2e/login.cy.ts"
```

Notes & troubleshooting

- The client tests use `vitest.config.ts` and a shared setup file at `client/src/setupTests.ts` to configure the `jsdom` environment and provide test mocks.
- If you hit peer-dependency warnings when installing devDependencies (Testing Library vs React), you may install with `--legacy-peer-deps` as a temporary workaround:

```bash
npm install --legacy-peer-deps
```

- `package.json` lists engines (Node/npm versions). If you see an `EBADENGINE` warning, ensure your Node/NPM versions match the `engines` settings or ignore the warning if you understand the risk.

If you'd like, I can add a `Makefile` or `scripts/test.sh` to simplify running common test sequences.