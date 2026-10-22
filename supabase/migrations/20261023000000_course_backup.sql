-- 0.5.0 online backup: the server copy of a course (02_MVP_SCOPE.md §4).
--
-- Every table and column mirrors src/persistence/schema.ts under the app's
-- own camelCase names, so PowerSync's sync config and the upload handler need
-- no mapping; a test keeps the two in step. Values keep the client's types:
-- ids are the client's text ids, times stay UTC ISO text exactly as written
-- (03 §3), and booleans are integers. `meta` (migration ledger, data version)
-- stays local to each device and has no table here.
--
-- Only the owner reads or writes: `courses."ownerId"` is set from the
-- signed-in user on insert, and every other table is reached through its
-- course. There are no foreign keys, so an upload never fails on the order
-- in which a transaction's rows arrive; the integrity checks stay on the
-- device (src/domain/invariants.ts) as in 0.4.0.

create table public.courses (
  id text primary key,
  "ownerId" uuid not null default auth.uid(),
  active integer,
  family text,
  level integer,
  "isoWeek" integer,
  year integer,
  "startDate" text,
  "endDate" text,
  label text,
  "createdAt" text,
  "updatedAt" text
);

create table public.students (
  id text primary key,
  "courseId" text not null,
  "firstName" text,
  surname text,
  nickname text,
  "dateOfBirth" text,
  "declaredAgeAtCourseStart" integer,
  sex text,
  phone text,
  size text,
  "initialNote" text,
  "courseNote" text,
  active integer,
  "createdAt" text,
  "updatedAt" text
);

create table public.volunteers (
  id text primary key,
  "courseId" text not null,
  name text,
  role text,
  "createdAt" text,
  "updatedAt" text
);

create table public.boats (
  id text primary key,
  "courseId" text not null,
  type text,
  number text,
  availability text,
  "createdAt" text,
  "updatedAt" text
);

create table public.faults (
  id text primary key,
  "courseId" text not null,
  "boatId" text,
  description text,
  state text,
  "createdAt" text,
  "updatedAt" text
);

create table public."dutyAssignments" (
  id text primary key,
  "courseId" text not null,
  "dayId" text,
  "studentId" text,
  "createdAt" text,
  "updatedAt" text
);

create table public."dutySettings" (
  id text primary key,
  "courseId" text not null,
  "desiredPerDay" integer,
  "fewerDayIds" text,
  "extraDayIds" text,
  "balanceMinors" integer,
  "balanceSex" integer,
  "tieBreaker" text,
  "stayOverStudentIds" text,
  "completedDayIds" text,
  "acknowledgedWarningKeys" text,
  "createdAt" text,
  "updatedAt" text
);

create table public."dutySettingItems" (
  id text primary key,
  "courseId" text not null,
  kind text,
  value text,
  position integer,
  "createdAt" text,
  "updatedAt" text
);

create table public.crews (
  id text primary key,
  "courseId" text not null,
  "sessionId" text,
  capacity integer,
  destination text,
  "boatId" text,
  position integer,
  "createdAt" text,
  "updatedAt" text
);

create table public."crewMembers" (
  id text primary key,
  "courseId" text not null,
  "crewId" text,
  "personId" text,
  "personType" text,
  position integer,
  "createdAt" text,
  "updatedAt" text
);

create table public."landAssignments" (
  id text primary key,
  "courseId" text not null,
  "sessionId" text,
  "studentId" text,
  "createdAt" text,
  "updatedAt" text
);

create table public."sessionBoats" (
  id text primary key,
  "courseId" text not null,
  "sessionId" text,
  "boatId" text,
  position integer,
  "createdAt" text,
  "updatedAt" text
);

create table public.evaluations (
  id text primary key,
  "courseId" text not null,
  "studentId" text,
  "sessionId" text,
  value text,
  note text,
  "createdAt" text,
  "updatedAt" text
);

-- Access: the owner only. The anonymous role gets nothing.
alter table public.courses enable row level security;
create policy "owner reads and writes own courses" on public.courses
  for all to authenticated
  using ("ownerId" = auth.uid())
  with check ("ownerId" = auth.uid());
grant select, insert, update, delete on public.courses to authenticated;
alter table public.courses replica identity full;
create index courses_owner_idx on public.courses ("ownerId");

do $$
declare
  child text;
begin
  foreach child in array array[
    'students', 'volunteers', 'boats', 'faults', 'dutyAssignments',
    'dutySettings', 'dutySettingItems', 'crews', 'crewMembers',
    'landAssignments', 'sessionBoats', 'evaluations'
  ] loop
    execute format('alter table public.%I enable row level security', child);
    execute format(
      'create policy "owner reads and writes rows of own courses" on public.%I
         for all to authenticated
         using (exists (select 1 from public.courses c
                        where c.id = %I."courseId" and c."ownerId" = auth.uid()))
         with check (exists (select 1 from public.courses c
                             where c.id = %I."courseId" and c."ownerId" = auth.uid()))',
      child, child, child);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', child);
    -- Deletes must carry the whole row so PowerSync can remove it on devices.
    execute format('alter table public.%I replica identity full', child);
    execute format('create index %I on public.%I ("courseId")',
      child || '_course_idx', child);
  end loop;
end
$$;

-- What PowerSync replicates. The replication role itself is created by the
-- owner with a generated password (docs/working/BACKEND_SETUP_0.5.0.md), so
-- no secret enters the repository.
create publication powersync for table
  public.courses, public.students, public.volunteers, public.boats,
  public.faults, public."dutyAssignments", public."dutySettings",
  public."dutySettingItems", public.crews, public."crewMembers",
  public."landAssignments", public."sessionBoats", public.evaluations;
