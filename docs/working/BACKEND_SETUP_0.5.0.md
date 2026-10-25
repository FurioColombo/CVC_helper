# Backend setup for 0.5.0 — the owner's steps

> Working document · Owner: the owner · Fold at: UG4

0.5.0 needs two hosted development projects. Agents may not create accounts
or handle passwords, so these steps are yours; everything else is prepared in
the repository: the database tables and access rules
(`supabase/migrations/20261023000000_course_backup.sql`), the PowerSync
configuration (`powersync/`), and a test that keeps both in step with the
app (`src/persistence/backendSchema.test.ts`). Use the development projects
for synthetic data only; production gets separate projects later, and no
agent tool is ever connected to them (`AGENTS.md` §17).

Each value goes into a file named `.env` in the repository folder, copied
from `.env.example`. Git ignores it; never paste a value into the chat.

## 1. Supabase development project

1. Sign up at supabase.com and create a project named `cvc-helper-dev` in
   the region **West EU (Ireland)**, close to PowerSync's EU region. Save the
   database password the dialog generates in your password manager.
2. Project Settings → API: copy the **Project URL** to `SUPABASE_URL` and the
   **publishable key** (`sb_publishable_…`) to `SUPABASE_ANON_KEY`.
3. Project Settings → JWT: keep the new signing keys (the default for new
   projects).
4. Authentication → Sign In / Providers: keep **Email** enabled, with email
   confirmation on. Authentication → URL Configuration: add
   `https://furiocolombo.github.io/CVC_helper_test/` to the redirect URLs;
   the agent will name the local address to add for development.

## 2. The tables and access rules

SQL Editor → New query: paste the whole of
`supabase/migrations/20261023000000_course_backup.sql` and run it. It creates
the thirteen course tables, lets each signed-in user reach only their own
courses, and publishes the tables to PowerSync.

## 3. The replication role for PowerSync

In a new SQL Editor query, run the following with a long random password of
your own in place of `GENERATED_PASSWORD` (your password manager can make
one):

```sql
create role powersync_role with replication bypassrls login password 'GENERATED_PASSWORD';
grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;
```

Then put the **direct** connection in `PS_DATABASE_URI`, not a pooler one
(PowerSync replicates, and Supabase's pooler cannot):
user `powersync_role`, host `db.<project-ref>.supabase.co`, port 5432, database `postgres`,
with letters and digits only in the password. Done on 2026-10-25; the
Development instance (EU) is linked in `powersync/cli.yaml`.

## 4. PowerSync Cloud project

1. Sign up at powersync.com (the free plan is enough) and create a project
   named `CVC Helper`. Its instances are created by the agent from
   `powersync/service.yaml` in the EU region, so you may untick the default
   instances.
2. Copy the project id from the dashboard address to `POWERSYNC_PROJECT_ID`.
3. Account → Access Tokens: create a token for the CLI and put it in
   `PS_ADMIN_TOKEN`.

## 5. Tell the agent

Say "backend ready". The agent then links and deploys the development
instance (`powersync link cloud --create`, `powersync deploy`), records its
address in `POWERSYNC_URL`, and checks it before writing any app code.

## Optional: running the backend locally

Not needed for the steps above. The development PC (8 GB, checked
2026-10-22) has no Docker, on Windows or in its WSL2 Debian; installing it is
a system change only you make. The lightest local stack PowerSync supports is
one Postgres 14+ server for both the course tables and PowerSync's storage
plus the PowerSync service, set up by the CLI (`powersync docker configure
--database postgres --storage postgres`), with a static development key in
place of Supabase sign-in. Whether it fits beside the browser suite in 8 GB
is untested: WebKit already loses pages under memory pressure here. GitHub's
Linux runners have Docker, so CI can run such a stack either way.
