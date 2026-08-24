-- The migration that added `Site.blockConfig` was never committed to this repo.
--
-- Production applied it as `20260818090000_add_block_config`, but that file --
-- along with `add_visitor_chat_messages`, `drop_visitor_chat_messages` and
-- `add_ghl_accounts` -- exists in no commit (`git log` finds nothing for any of
-- them). `00000000000000_init` therefore creates `Site.sectionConfig` and stops
-- there, so a database built from this history has no `blockConfig` column at
-- all -- the column every AI-composed page is read from and written to. That is
-- why a fresh database needed `prisma db push` before the app would work.
--
-- Verified rather than guessed: comparing every column in production (which
-- `prisma migrate diff --to-schema-datamodel` shows is schema-current) against
-- every column any local migration creates leaves exactly one -- this one. The
-- visitor-chat pair cancels out, and `ghl_accounts` is covered by
-- `20260820090000_add_ghl_accounts`.
--
-- Guarded, so this is a no-op wherever the column already exists (production,
-- and anything ever brought up with `db push`).

ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "blockConfig" JSONB;
