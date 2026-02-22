# Prebloom Database Migrations

Manual migrations for Supabase. Apply via SQL Editor in Supabase Dashboard.

## Order of Application

1. `001_initial_schema.sql` — Core tables (projects, evaluations)
2. `002_auth_and_rls.sql` — User profiles and Row Level Security

## How to Apply

1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Click "Run"
4. Verify in Table Editor

## Notes

- Migrations are idempotent (safe to run multiple times)
- The `002_auth_and_rls.sql` migration enables RLS which may affect existing queries
- Backend uses service_role key which bypasses RLS
- Frontend uses anon key which is subject to RLS policies
