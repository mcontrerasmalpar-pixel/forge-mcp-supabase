# Skill: Supabase RLS

Use this when proposing or reviewing Row Level Security.

## Rules

- Every user-owned table needs RLS enabled before going to production.
- Authorize with `auth.uid()` and membership tables, not frontend checks.
- `SELECT` uses `USING`. Writes that change tenant keys need `WITH CHECK`.
- Prefer a helper like `my_org_ids()` over repeating subqueries.
- Never ship a policy that compares `org_id` to a client-supplied UUID without membership.
- Drafts from `propose_rls` are not applied. A human reviews the migration.

## Anti-patterns

- `service_role` in the browser.
- Policies that only check `created_by = auth.uid()` on multi-tenant data.
- Disabling RLS "just for the demo".
