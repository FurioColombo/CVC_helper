-- B7: an account holding several courses keeps the one its owner chooses, in
-- one step on the server. Run it in the SQL Editor of the development project,
-- after 20261028000000_course_erase.sql. It can be run again: it replaces what
-- it creates.
--
-- The app names what it showed: `give_up` maps each course it offered to give
-- up to the last change it saw there. The server erases those courses and no
-- others, and only if what it holds is what the owner saw: another course of
-- the account, or a newer change of one given up, refuses the choice with
-- SQLSTATE CVNEW and nothing happens; the device then shows the choice again
-- once its download has caught up. A course switched off (active = 0) is never
-- offered, so it is not touched either.
--
-- Two devices choosing at the same time must not each erase the other's
-- course, so the choice is one transaction under a lock per owner: the second
-- device then finds the course it chose already gone and is refused with
-- SQLSTATE CVGON. The courses given up are recorded as erased, so a device
-- still holding one cannot upload it back, and the same lock in
-- refuse_erased_course closes the moment before that record commits. Their
-- rows go with them (20261025000000_hardening.sql). Repeating the same choice
-- changes nothing, so an answer lost on the way can be asked again.
--
-- It runs with the caller's rights: the access rules and the writer check
-- apply as they do to the app's own delete.

drop function if exists public.keep_course(text);

create or replace function public.keep_course(keep_id text, give_up jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owned text[];
  others text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select coalesce(array_agg(locked.id), '{}') into owned from (
    select c.id from public.courses c
    where c."ownerId" = auth.uid() and c.active = 1
    order by c.id
    for update
  ) locked;
  if keep_id is null or not keep_id = any(owned) then
    raise exception 'This course is no longer on the backup'
      using errcode = 'CVGON', hint = 'Erased on another device';
  end if;
  others := array_remove(owned, keep_id);
  if exists (
    select 1 from unnest(others) other
    where not coalesce(give_up ? other, false)
  ) or exists (
    select 1 from (
      select c.id as course, c."updatedAt" as changed
        from public.courses c where c.id = any(others)
      union all select r."courseId", r."updatedAt"
        from public.students r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public.volunteers r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public.boats r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public.faults r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."dutyAssignments" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."dutySettings" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."dutySettingItems" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public.crews r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."crewMembers" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."landAssignments" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public."sessionBoats" r where r."courseId" = any(others)
      union all select r."courseId", r."updatedAt"
        from public.evaluations r where r."courseId" = any(others)
    ) latest
    where latest.changed collate "C"
      > coalesce(give_up ->> latest.course, '') collate "C"
  ) then
    raise exception 'The account changed since this choice was shown'
      using errcode = 'CVNEW', hint = 'Wait for the download and choose again';
  end if;
  insert into public.erased_courses(id)
    select other from unnest(others) other
    on conflict do nothing;
  delete from public.courses c
    where c."ownerId" = auth.uid() and c.id = any(others);
end
$$;
revoke all on function public.keep_course(text, jsonb) from public, anon;
grant execute on function public.keep_course(text, jsonb) to authenticated;

create or replace function public.refuse_erased_course() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new."ownerId"::text, 0));
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
