-- B7: an account holding several courses keeps the one its owner chooses, in
-- one step on the server. Run once in the SQL Editor of the development
-- project, after 20261028000000_course_erase.sql.
--
-- Two devices choosing at the same time must not each erase the other's
-- course, so the choice is one transaction: it locks the owner's course rows,
-- and the second device then finds the course it chose already gone and is
-- refused with SQLSTATE CVGON. The courses given up are recorded as erased,
-- so a device still holding one cannot upload it back
-- (20261028000000_course_erase.sql), and their rows go with them
-- (20261025000000_hardening.sql). Repeating the same choice changes nothing,
-- so an answer lost on the way can be asked again.
--
-- It runs with the caller's rights: the access rules and the writer check
-- apply as they do to the app's own delete.

create function public.keep_course(keep_id text) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owned text[];
begin
  select coalesce(array_agg(locked.id), '{}') into owned from (
    select c.id from public.courses c
    where c."ownerId" = auth.uid()
    order by c.id
    for update
  ) locked;
  if keep_id is null or not keep_id = any(owned) then
    raise exception 'This course is no longer on the backup'
      using errcode = 'CVGON', hint = 'Erased on another device';
  end if;
  insert into public.erased_courses(id)
    select other from unnest(array_remove(owned, keep_id)) other
    on conflict do nothing;
  delete from public.courses c
    where c."ownerId" = auth.uid() and c.id <> keep_id;
end
$$;
revoke all on function public.keep_course(text) from public, anon;
grant execute on function public.keep_course(text) to authenticated;
