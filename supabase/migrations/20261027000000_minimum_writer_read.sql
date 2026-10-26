-- B5: a restored course carries the server's minimum writer to the device.
-- Run once in the SQL Editor of the development project, after
-- 20261026000000_upload_rules.sql.
--
-- A device that restores a course downloads rows only; the minimum writer
-- version lives on the server (public.app_minimum_writer, kept unreadable
-- through the Data API). This function lets a signed-in account read that
-- one value, so an app older than the minimum opens the restored course
-- read-only and asks for the update instead of editing what it cannot keep
-- (src/backup/session.ts; 03_TECHNICAL_DECISIONS.md §3.1). It returns a
-- version and nothing else.

create function public.app_minimum_writer_version() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select version from public.app_minimum_writer
$$;
revoke all on function public.app_minimum_writer_version() from public, anon;
grant execute on function public.app_minimum_writer_version() to authenticated;
