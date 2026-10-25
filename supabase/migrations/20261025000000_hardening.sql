-- B2 hardening, after the security/privacy review (.evidence/B2/
-- security-privacy-review-round-1.json). Run once in the SQL Editor of the
-- development project, after 20261023000000_course_backup.sql.

-- SP-B2-1: the anonymous role gets no table privileges at all. Supabase's
-- default grants gave it SELECT; row-level security already returned it no
-- rows, and now the grant itself is gone, for tables created later too.
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;

-- SP-B2-Q4: signed-in accounts keep only what the app uses (select, insert,
-- update, delete under row-level security); TRUNCATE would ignore it.
revoke truncate, references, trigger on all tables in schema public
  from authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- SP-B2-3: a course's rows go with it. Deleting a course on the server
-- deletes its children in the same statement, so no student, note or
-- evaluation outlives its course where no account could reach it, and none
-- reappears for another account that later uses the same course id. Row-level
-- security already requires the course row before a child, so inserts behave
-- as before; uploads keep the queue's parent-first order.
do $$
declare
  child text;
begin
  foreach child in array array[
    'students', 'volunteers', 'boats', 'faults', 'dutyAssignments',
    'dutySettings', 'dutySettingItems', 'crews', 'crewMembers',
    'landAssignments', 'sessionBoats', 'evaluations'
  ] loop
    execute format(
      'alter table public.%I add constraint %I foreign key ("courseId")
         references public.courses(id) on delete cascade',
      child, child || '_course_fk');
  end loop;
end
$$;
