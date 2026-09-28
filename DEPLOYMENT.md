# Free-tier deployment and migration

The intended setup is Vercel Hobby plus Supabase Free in Singapore (`ap-southeast-1`). Provisioning and importing are separate from building the app. Do not consider data migrated until the hosted app's verification reports all selected records match.

## 1. Preserve the current data

Open the **original browser profile and exact origin** currently used (`http://127.0.0.1:3101`). Go to **Data & backups → Download complete backup**. Store the JSON somewhere private. It includes reflections, quotes, books, progress, book notes, and gratitude entries. Keep the original local data as well.

Opening `localhost`, a different port, or the hosted domain cannot read that origin's localStorage. Use the downloaded file on the hosted app. Do not copy the contents into source code, chat, or environment variables.

## 2. Supabase

1. Create a **Free** project in your chosen organization. Use Singapore unless another region is required. Do not enable paid branching, custom domains, or add-ons.
2. Apply `supabase/migrations/202609260001_cloud_foundation.sql` once to the new project using Supabase migration tooling or its SQL editor. It creates domain tables, constraints, owner policies, and the transactional importer. Do not run it against an unrelated existing project.
   Apply `supabase/migrations/202609270001_gratitude.sql` after the foundation migration to add Gratitude storage and extend the importer.
   Apply `supabase/migrations/202609270002_gratitude_titles.sql` afterward to add optional titles while preserving existing Gratitude entries.
   Apply `supabase/migrations/20260928135825_public_read_owner_write.sql` last to allow public reading of all current content while keeping writes owner-only. Apply it only if you intend to make every existing reflection, quote, book, note, and gratitude entry public.
3. In Authentication settings, disable new user signups and anonymous sign-ins. Keep email/password sign-in enabled.
4. In Authentication → Users, manually create your own email/password user with email confirmed. Choose and store the password privately; it is not an application environment variable. There is no public registration or password-reset flow in this MVP. Account recovery is administered through Supabase; configure custom SMTP before relying on email recovery.
5. Copy that auth user's UUID and allowlist it in SQL:

   ```sql
   insert into app_private.owners (user_id)
   values ('YOUR_AUTH_USER_UUID')
   on conflict do nothing;
   ```

6. Obtain the project URL and **publishable** key. The app does not need the database password or service-role/secret key.
7. Run Supabase security advisors. Confirm public tables have RLS enabled; `app_private` must not be added to the Data API's exposed schemas. The public `is_app_owner` wrapper uses invoker rights; its private lookup has narrowly granted execution and no table access for application roles.

## 3. Vercel Hobby

Deploy this repository as a Next.js project with Node 24, install command `npm ci`, and build command `npm run build`. Use a private Git repository for convenient future deployments, or deploy the local source with Vercel CLI after authenticating. Do not upload `node_modules`, `.next`, backups, or `.env` files. The CLI's `.vercel` link is ignored by Git.

Set the following in Vercel's **Production** environment before deploying:

| Variable | Value |
| --- | --- |
| `APP_STORAGE_MODE` | `cloud` |
| `SUPABASE_URL` | Project HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project publishable key |
| `APP_OWNER_ID` | Same auth UUID as the database allowlist |
| `APP_URL` | Exact canonical HTTPS deployment URL, without a path |

Use the free `*.vercel.app` domain. If the domain is assigned during the first deployment, set `APP_URL` afterward and redeploy. Set Supabase's Site URL to that domain. Password sign-in does not require an OAuth callback. Do not add broad redirect wildcards.

Keep production credentials out of Preview environments until you deliberately want previews to access production data. A preview without credentials shows an unavailable state, not local mode. Changing environment variables requires redeployment.

## 4. Verify and import

1. Open the deployed site in a signed-out browser: Reflections, Reading (including book notes), and Gratitude must load; GET `/api/reading`, `/api/reflections`, and `/api/gratitude` must return public content. The backup page must redirect to sign-in and `/api/data/export` must still return 401. Missing configuration returns 503 instead.
2. Sign in with your manually created owner account. Confirm HTTPS session cookies are HttpOnly, Secure, SameSite=Lax and private responses use `Cache-Control: private, no-store`.
3. Open **Data & backups**, select the original complete JSON backup, and choose **Preview cloud import**. Check the counts.
4. Choose **Import into my account**. Import assigns ownership on the server and commits all records in one database transaction. Repeating an import skips existing IDs; existing books and their incoming notes are skipped together rather than merged or overwritten.
5. Check **Verification**. It compares all fields, normalized timestamps, and notes—not just totals. Resolve any differences before considering the migration complete. If verification fails due to a connection error, retry verification; keep the backup.
6. Inspect a reflection, a book's page progress, and its notes. Refresh, then sign in from another device and confirm the same data is present. Sign out and confirm the content stays readable while create, edit, delete, and import requests are rejected.
7. Download a fresh cloud backup. Retain the original browser data and export until you are satisfied with the migration.

Imports accept one to ten version 1 JSON files, at most 10,000 top-level records and a combined request under 3 MB (below Vercel's function request limit). Larger backups need to be split at record boundaries. Exports page through all database rows. Avoid concurrent edits during migration and export; multi-request exports are not transaction snapshots.

## Cost and limits

Checked 26 September 2026; verify pricing before changing plans.

| Service | Starting price | Relevant included limits |
| --- | --- | --- |
| Supabase Free | US$0/month | 500 MB database; 5 GB egress; 50,000 monthly active users; two active free projects. Pauses after a week of inactivity; automatic backups are not included. |
| Vercel Hobby | US$0/month | Personal, noncommercial use; 100 GB fast data transfer; one million edge requests; usage limits apply to functions and compute. |

[Supabase pricing](https://supabase.com/pricing) · [Vercel Hobby limits](https://vercel.com/docs/plans/hobby)

This text-focused, single-owner app should fit comfortably, but actual usage determines limits. Keep manual JSON backups on Free. The first paid upgrade worth considering is **Supabase Pro, from US$25/month**, for daily backups retained seven days and avoiding inactivity pauses. Vercel Pro is unnecessary at this scale unless usage or commercial requirements change. No paid upgrade is required by the code.

## Local development after deployment

Leave the existing development server in local mode until its original data has been exported. To deliberately use cloud data locally, copy `.env.example` to `.env.local`, set cloud credentials and `APP_URL=http://127.0.0.1:3101`, and restart the dev server. Local cloud mode uses the real database; make changes carefully. Prefer local mode for routine UI development and isolated browser tests. No secrets belong in `NEXT_PUBLIC_*` variables or source control.

The JSON export restores application data only, not Supabase auth accounts or database configuration. To recover into a fresh project, repeat setup, create/allowlist the new owner, and import the JSON. Keep schema files and account recovery access separately.
