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