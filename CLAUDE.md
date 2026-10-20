# CLAUDE.md

## Supabase: GRANT rule for new tables (effective 2026-10-30)

From 2026-10-30, Supabase no longer automatically grants Data API access (supabase-js, PostgREST, GraphQL) to new tables in the `public` schema. Existing tables are not affected.

When creating any new table in `public`, add the explicit grants in the same migration that creates the table. Without them the API returns a "permission denied" error.

```sql
grant select, insert, update, delete on public.<table_name> to authenticated;
grant select on public.<table_name> to anon; -- only if the table must be publicly readable
grant all on public.<table_name> to service_role;
```

Keep RLS enabled and write the policies as before. The grants only open the API door; RLS still decides which rows are visible.

This also applies to new projects, preview branches and a local `supabase db reset`, since they replay the migrations.
