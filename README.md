# Commonplace — a personal hub

A modular Next.js monolith with independent Reflections and Reading domains. Finance and other future modules are not implemented.

## Run locally

Requires Node.js 20.9+ (Node 24 is used for development).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The home route redirects to `/reflections`.
Use the navigation to switch between Reflections and Reading (`/reading`).

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

The browser tests normally start an isolated server on port 3100. If a development server for this project is already running, point the tests at its address instead:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e
```

Webpack is explicitly selected for development and production builds because Turbopack's child-process port binding failed in the development sandbox. Local browser storage remains the default and needs no credentials. For authenticated Supabase storage and Vercel hosting, follow [DEPLOYMENT.md](DEPLOYMENT.md).

## MVP

- Text-first capture, with reflection/quote toggle and optional quote attribution.
- Save with one button or Command/Ctrl + Enter; no title or categorization required.
- Search content and attribution; filter by entry type.
- Edit entries, confirm deletion, and download a versioned JSON backup.
- Desktop/mobile layout, keyboard focus states, form labels, and live save feedback.
- Browser persistence, cross-tab updates, visible storage errors, and retention of draft text after failed writes.

### Reading list

- Add a book with just its title; author and total pages are optional.
- Track To read, Reading, and Finished states. Start reading with one click.
- Update the current page; known page totals show a progress bar and percentage. Reaching the final page marks the book finished. Marking it finished manually fills the known total. Unknown totals support page tracking and manual completion without an invented percentage.
- Edit details or correct progress, search titles/authors, filter by status, confirm deletion, and export a Reading-only backup.
- Click a book title or **View notes** to open its detail page at `/reading/<id>`. Add individual notes or learning points, edit them, or confirm deletion. Notes support multiline plain text and Command/Ctrl + Enter to save. The detail page also supports editing book details and progress.
- Existing books load with an empty notes list. Reading backups include all notes; deleting a book also deletes its notes. Unsaved notes remain drafts until saved and are lost when leaving the page.
- Changing the current page reopens a finished book; choosing To read resets its page to zero. Page counts must be whole numbers and current page cannot exceed the total.

There are no seeded entries. Unsaved drafts live in memory and are lost on a reload or closed tab. **Data & backups** downloads both domains together and supports previewing, importing, and verifying version 1 backups in cloud mode. Backups are plaintext private files. Import preserves IDs, timestamps, progress and notes; existing cloud records are skipped. Local storage is never cleared by migration.

## Architecture

```text
src/
  app/                       Routing, metadata, layouts, composition
    (private)/               Owner-protected routes (same public URLs)
    api/                     Authenticated domain endpoints and data transfer
    login/                   Owner sign-in
  lib/server/                Shared auth, Supabase connection, request validation
  data-transfer/             Application-level backup/import composition
  components/                Shared application shell and icon primitive
  features/
    reflections/
      index.ts               Public UI entry point
      model.ts               Domain types, validation, search
      repository.ts          Small asynchronous domain persistence contract
      local-repository.ts    Browser adapter and raw backup export
      server-repository.ts   Owner-scoped PostgreSQL operations
      client-repository.ts   Local/cloud adapter selection
      components/            Reflections interaction and presentation
    reading/
      index.ts               Public UI entry point
      model.ts               Book types, validation, progress, search
      repository.ts          Reading persistence contract
      local-repository.ts    Independent browser adapter and backup
      server-repository.ts   Books and notes stored in independent tables
      client-repository.ts   Local/cloud adapter selection
      components/            Book capture, cards, workspace, domain styles
```

The root layout and routes are server components. The shared shell uses a client component to highlight the active route. Interactive feature workspaces are client components. Browser storage is accessed after hydration or from user events, not during server rendering.

Route files compose features; features never import from `app/`. Future domains should own their models, validation, UI, and server data access under their own feature folders. They must not reach into another feature's internal files. Shared infrastructure (authentication, database connection, shared UI) belongs outside features when it actually exists. Do not create empty future domain folders, a plugin registry, a generic CRUD framework, or an event bus in anticipation of future requirements.

Reflection and quote share an entry model because capture, listing, editing, and storage have the same lifecycle. A `kind` field distinguishes them; only quotes retain attribution. IDs and creation/update timestamps remain stable through editing. Each domain's small async repository contract has browser and HTTP adapters; it is not a cross-domain abstraction.

The browser adapter stores one JSON record per entry under `personal-hub:reflections:v1:<id>`. Unrelated entries saved from separate tabs cannot overwrite each other. Same-entry concurrent edits use last-write-wins. Storage events refresh other open tabs. Runtime validation checks stored values; malformed records produce a visible error and block capture rather than silently resetting or overwriting the collection. Backup export preserves raw records even when validation fails. Browser quota/permission errors do not clear the composer.

Reading owns its own model and repository, with local records under `personal-hub:reading:v1:<id>`. It does not import Reflections code or use its storage keys. The shared shell composes links to each route. Concurrent changes to the same record use last-write-wins. Each module exports its own backup. Cloud mode stores books and notes in separate owner-scoped tables; updating progress cannot overwrite notes. Lists refresh on window focus; there is no realtime or offline cloud sync.

## Privacy and deployment boundary

**Local mode:** entries remain in localStorage on this browser and origin. Anyone with access to this browser profile can read them. Clearing site data or changing hostname, scheme, or port makes the collection unavailable. Keep a JSON backup before changing storage mode.

**Cloud mode:** Supabase Auth verifies the owner on every API request, and PostgreSQL row-level security independently checks the private owner allowlist. The application uses the publishable key and the user's session, never a service-role key. Sessions are stored in HttpOnly cookies; mutations require the configured origin; private responses are not cached. There is no public signup. An empty owner allowlist denies all users.

Vercel always forces cloud mode and fails closed if credentials are missing. Other hosts must explicitly set `APP_STORAGE_MODE=cloud`. Do not publish the local development server. Keep database administration and auth-user creation outside the public app. `noindex` is included, but it is not access control.

The server uses Supabase's HTTPS Data API, so there are no direct database connections to exhaust on serverless hosting. No filesystem database is used. This is a dynamic Next.js application, not a static export. Schema changes run separately from builds.

## Verification

Unit tests cover both domains: input validation, page bounds and completion rules, stable edit identity, search, independent client writes, deletion, corrupt records, storage failures, and isolation between Reading and Reflections. Playwright tests exercise capture, progress updates, completion with and without page totals, navigation, reload persistence, deletion, backup download, failure recovery, and cross-tab updates on desktop and mobile Chromium profiles.

Additional tests execute the actual migration in PGlite PostgreSQL to check anonymous/outsider denial, owner isolation, import rollback, idempotence, and cascading note deletion. Transfer tests cover corrupt and conflicting backups, legacy books, and exact verification. Hosted sign-in, cookies, Data API configuration, and a real import must still be verified against the provisioned project before considering deployment complete.
