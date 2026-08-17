# Migrations

`00000000000000_init` is a **baseline**. It was generated from the schema after
the database already existed, so on any environment that predates it the tables
are already there and the migration must be recorded as applied rather than run:

```bash
npx prisma migrate resolve --applied 00000000000000_init
```

On a fresh database, nothing special is needed — `migrate deploy` runs it.

From here on:

- **Local schema change:** edit `schema.prisma`, then `npm run db:migrate`, which
  writes a new timestamped migration and applies it.
- **Deploy:** `npx prisma migrate deploy`. Never `db push` against staging or
  production — it makes the schema and this history disagree, which is what the
  baseline exists to end.
- `db push` is still fine for throwaway local experiments, as long as you follow
  up with a real migration before committing.
