-- B2 hardening: the anonymous role gets no table privileges at all.
--
-- Supabase's default privileges grant every new table in `public` to `anon`;
-- the course tables' row-level security already returns it no rows (B2's
-- access check), and this removes the grant itself, for the course tables and
-- any table created later in `public`. Signed-in access (`authenticated`) and
-- PowerSync's `powersync_role` are untouched.

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
