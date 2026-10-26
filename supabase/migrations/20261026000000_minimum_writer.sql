-- B4: the server refuses writers older than the minimum, as the device does
-- (03_TECHNICAL_DECISIONS.md §3.1). Run once in the SQL Editor of the
-- development project, after 20261025000000_hardening.sql, once the
-- installed CVC Helper Test sends its version (0.5.1 or later): the 0.5.0
-- build does not, and its uploads would wait for the update.
--
-- Every app write through the Data API carries its version in the
-- x-cvc-app-version header (src/backup/session.ts). A write whose version is
-- missing or below the minimum is refused with SQLSTATE CVOLD, which the
-- app reads as "update the app" and keeps the change queued
-- (src/backup/uploadPolicy.ts). Writes without API headers (this editor,
-- PowerSync's replication) are not app writes and pass.

create table public.app_minimum_writer (
  only_row boolean primary key default true check (only_row),
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);
insert into public.app_minimum_writer (version) values ('0.5.0');
-- Nobody reaches it through the Data API; the check reads it as its owner.
alter table public.app_minimum_writer enable row level security;
revoke all on public.app_minimum_writer from anon, authenticated;

create function public.refuse_outdated_writer() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  sent text := headers ->> 'x-cvc-app-version';
  minimum text;
begin
  if headers is null then
    return null;
  end if;
  select version into minimum from public.app_minimum_writer;
  if sent is null
     or sent !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
     or string_to_array(sent, '.')::int[] < string_to_array(minimum, '.')::int[]
  then
    raise exception 'This app version may not write to the backup'
      using errcode = 'CVOLD', hint = 'Update the app';
  end if;
  return null;
end
$$;
revoke all on function public.refuse_outdated_writer() from public, anon, authenticated;

do $$
declare
  course_table text;
begin
  foreach course_table in array array[
    'courses', 'students', 'volunteers', 'boats', 'faults', 'dutyAssignments',
    'dutySettings', 'dutySettingItems', 'crews', 'crewMembers',
    'landAssignments', 'sessionBoats', 'evaluations'
  ] loop
    execute format(
      'create trigger refuse_outdated_writer
         before insert or update or delete on public.%I
         for each statement execute function public.refuse_outdated_writer()',
      course_table);
  end loop;
end
$$;
