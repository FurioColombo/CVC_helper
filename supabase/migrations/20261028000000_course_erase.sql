-- B6: erasing a course on a device erases it on the server, and nothing
-- brings it back. Run once in the SQL Editor of the development project,
-- after 20261027000000_minimum_writer_read.sql.
--
-- The app deletes the course row through the Data API (src/backup/
-- session.ts); the course's rows go with it (20261025000000_hardening.sql).
-- The delete is unconditional: it depends on no device's clock, so no later
-- or clock-ahead edit from another phone keeps the course (B4 review
-- SP-B4-3). Before the delete the app records the erased course id here:
-- another phone that still holds the course and uploads an edit afterwards
-- is refused with SQLSTATE CVERA (src/backup/uploadPolicy.ts) instead of
-- creating the course again. The rows of the course need no record: the
-- access rules accept a row only while its course row exists.
--
-- A course file imported with the same course id is the owner's explicit
-- choice: the app removes the record of that id before it uploads the
-- imported course. The record holds an id and a time, no course data, and
-- only its owner reads it.

create table public.erased_courses (
  "ownerId" uuid not null default auth.uid(),
  id text not null,
  "erasedAt" timestamptz not null default now(),
  primary key ("ownerId", id)
);
alter table public.erased_courses enable row level security;
create policy "owner keeps own erased course ids" on public.erased_courses
  for all to authenticated
  using ("ownerId" = auth.uid())
  with check ("ownerId" = auth.uid());
grant select, insert, delete on public.erased_courses to authenticated;

create function public.refuse_erased_course() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.erased_courses e
    where e.id = new.id and e."ownerId" = new."ownerId"
  ) then
    raise exception 'This course was erased from the backup'
      using errcode = 'CVERA', hint = 'Erased on another device';
  end if;
  return new;
end
$$;
revoke all on function public.refuse_erased_course() from public, anon, authenticated;

create trigger refuse_erased_course
  before insert or update on public.courses
  for each row execute function public.refuse_erased_course();
