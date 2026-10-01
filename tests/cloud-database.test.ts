import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const date = "2026-09-25T01:00:00.000Z";
const payload = {
  entries: [
    {
      id: "r1",
      kind: "quote",
      content: "Keep learning",
      attribution: "Author",
      createdAt: date,
      updatedAt: date,
    },
  ],
  books: [
    {
      id: "b1",
      title: "Book",
      author: "",
      status: "reading",
      currentPage: 10,
      totalPages: 100,
      createdAt: date,
      updatedAt: date,
      notes: [
        {
          id: "n1",
          content: "Learning point",
          createdAt: date,
          updatedAt: date,
        },
      ],
    },
  ],
  gratitudes: [
    {
      id: "g1",
      title: "A kind friend",
      content: "I was helped by **a friend**.",
      createdAt: date,
      updatedAt: date,
    },
  ],
  plans: [
    {
      id: "p1",
      title: "Take a course",
      kind: "course",
      details: "Learn a skill",
      url: "https://example.com",
      status: "doing",
      current: 2,
      target: 10,
      unit: "lessons",
      createdAt: date,
      updatedAt: date,
    },
  ],
  subscriptions: [
    {
      id: "s1",
      name: "GPT Pro",
      amount: 200,
      currency: "USD",
      billingCycle: "monthly",
      nextRenewal: "2026-11-01",
      status: "active",
      url: "",
      notes: "",
      createdAt: date,
      updatedAt: date,
    },
  ],
};

test("cloud schema preserves owner writes and opens content for public reading", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${owner}'), ('${stranger}');
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609260001_cloud_foundation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609270001_gratitude.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "insert into public.gratitude_entries(owner_id,id,content,created_at,updated_at) values ($1,'before-title','Saved before titles',$2,$2)",
      [owner, date],
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609270002_gratitude_titles.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261001080749_plans.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261001091248_subscriptions.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ title: string }>(
          "select title from public.gratitude_entries where id='before-title'",
        )
      ).rows[0].title,
      "",
    );
    await db.query("insert into app_private.owners values ($1)", [owner]);
    await db.exec("set role anon");
    assert.deepEqual((await db.query("select * from public.plans")).rows, []);
    assert.deepEqual(
      (await db.query("select * from public.subscriptions")).rows,
      [],
    );
    await assert.rejects(
      db.query(
        "insert into public.plans(owner_id,id,title,kind,status) values ($1,'bad','Bad','task','planned')",
        [owner],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.subscriptions(owner_id,id,name,billing_cycle,status) values ($1,'bad','Bad','monthly','active')",
        [owner],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.reflections"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.import_personal_data($1::jsonb, false)", [
        JSON.stringify(payload),
      ]),
      /permission denied/,
    );
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      stranger,
    ]);
    assert.deepEqual(
      (await db.query("select * from public.reading_books")).rows,
      [],
    );
    await assert.rejects(
      db.query("select public.import_personal_data($1::jsonb, false)", [
        JSON.stringify(payload),
      ]),
      /Access denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.reflections(owner_id,id,kind,content) values ($1,'bad','reflection','text')",
        [stranger],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into public.subscriptions(owner_id,id,name,billing_cycle,status) values ($1,'outsider','Outsider','monthly','active')",
        [stranger],
      ),
      /row-level security/,
    );
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      owner,
    ]);
    await assert.rejects(
      db.query("select * from app_private.owners"),
      /permission denied/,
    );
    const runImport = async (value: unknown, dry: boolean) =>
      (
        await db.query<{ result: Record<string, number> }>(
          "select public.import_personal_data($1::jsonb, $2) as result",
          [JSON.stringify(value), dry],
        )
      ).rows[0].result;
    const added = {
      entriesAdded: 1,
      entriesSkipped: 0,
      booksAdded: 1,
      booksSkipped: 0,
      notesAdded: 1,
      notesSkipped: 0,
      gratitudesAdded: 1,
      gratitudesSkipped: 0,
      plansAdded: 1,
      plansSkipped: 0,
      subscriptionsAdded: 1,
      subscriptionsSkipped: 0,
    };
    assert.deepEqual(await runImport(payload, true), added);
    assert.equal(
      (await db.query("select * from public.reflections")).rows.length,
      0,
    );
    assert.deepEqual(await runImport(payload, false), added);
    assert.equal(
      (await db.query("select * from public.plans where id='p1'")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.subscriptions where id='s1'")).rows
        .length,
      1,
    );
    assert.equal(
      (
        await db.query<{ title: string }>(
          "select title from public.gratitude_entries where id='g1'",
        )
      ).rows[0].title,
      "A kind friend",
    );
    await runImport(
      {
        entries: [],
        books: [],
        gratitudes: [
          {
            id: "legacy",
            content: "An older backup",
            createdAt: date,
            updatedAt: date,
          },
        ],
      },
      false,
    );
    assert.equal(
      (
        await db.query<{ title: string }>(
          "select title from public.gratitude_entries where id='legacy'",
        )
      ).rows[0].title,
      "",
    );
    assert.deepEqual(await runImport(payload, false), {
      entriesAdded: 0,
      entriesSkipped: 1,
      booksAdded: 0,
      booksSkipped: 1,
      notesAdded: 0,
      notesSkipped: 1,
      gratitudesAdded: 0,
      gratitudesSkipped: 1,
      plansAdded: 0,
      plansSkipped: 1,
      subscriptionsAdded: 0,
      subscriptionsSkipped: 1,
    });
    assert.equal(
      (
        await db.query<{ content: string }>(
          "select content from public.reading_notes",
        )
      ).rows[0].content,
      "Learning point",
    );
    const changed = structuredClone(payload);
    changed.books[0].notes[0].content = "Incoming old version";
    await runImport(changed, false);
    assert.equal(
      (
        await db.query<{ content: string }>(
          "select content from public.reading_notes",
        )
      ).rows[0].content,
      "Learning point",
    );
    const broken = structuredClone(payload);
    broken.entries[0].id = "r2";
    broken.books[0].id = "b2";
    broken.books[0].notes[0].content = "";
    await assert.rejects(runImport(broken, false), /check constraint/);
    assert.equal(
      (await db.query("select * from public.reflections where id='r2'")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query("update public.reading_books set owner_id=$1", [stranger]),
      /row-level security/,
    );
    await db.exec("reset role");
    await db.exec(`
      create schema storage;
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (id text primary key, bucket_id text not null, name text not null);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select, insert, delete on storage.objects to authenticated;
      create function storage.foldername(path text) returns text[]
        language sql immutable as $$ select string_to_array(path, '/') $$;
      grant execute on function storage.foldername(text) to authenticated;
    `);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610010001_reflection_images.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261001072817_gratitude_images.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='reflection-images'",
        )
      ).rows[0].public,
      true,
    );
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='gratitude-images'",
        )
      ).rows[0].public,
      true,
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      stranger,
    ]);
    await assert.rejects(
      db.query(
        "insert into storage.objects(id,bucket_id,name) values ('bad','reflection-images',$1)",
        [`${owner}/bad.webp`],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into storage.objects(id,bucket_id,name) values ('bad-gratitude','gratitude-images',$1)",
        [`${owner}/bad.webp`],
      ),
      /row-level security/,
    );
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      owner,
    ]);
    await db.query(
      "insert into storage.objects(id,bucket_id,name) values ('good','reflection-images',$1)",
      [`${owner}/good.webp`],
    );
    await db.query(
      "insert into storage.objects(id,bucket_id,name) values ('good-gratitude','gratitude-images',$1)",
      [`${owner}/good.webp`],
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      2,
    );
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20260928135825_public_read_owner_write.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      stranger,
    ]);
    const publicCounts: Record<string, number> = {
      reflections: 1,
      reading_books: 1,
      reading_notes: 1,
      gratitude_entries: 3,
    };
    for (const table of [
      "reflections",
      "reading_books",
      "reading_notes",
      "gratitude_entries",
    ]) {
      assert.equal(
        (await db.query(`select * from public.${table}`)).rows.length,
        publicCounts[table],
      );
      assert.equal(
        (await db.query(`delete from public.${table} returning id`)).rows
          .length,
        0,
      );
    }
    await db.exec("reset role; set role anon");
    for (const [table, count] of Object.entries(publicCounts)) {
      assert.equal(
        (await db.query(`select * from public.${table}`)).rows.length,
        count,
      );
      await assert.rejects(
        db.query(`delete from public.${table} where true`),
        /permission denied/,
      );
    }
    await assert.rejects(
      db.query(
        "insert into public.reflections(owner_id,id,kind,content) values ($1,'bad-anon','reflection','text')",
        [owner],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.import_personal_data($1::jsonb, false)", [
        JSON.stringify(payload),
      ]),
      /permission denied/,
    );
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      owner,
    ]);
    await db.query("delete from public.reading_books where id='b1'");
    assert.equal(
      (await db.query("select * from public.reading_notes")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
