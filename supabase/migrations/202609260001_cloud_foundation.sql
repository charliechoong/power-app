-- Run once on a new Supabase project. No existing browser data is touched.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table app_private.owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on app_private.owners from public, anon, authenticated;
alter table app_private.owners enable row level security;

create function app_private.is_app_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from app_private.owners where user_id = (select auth.uid())); $$;
revoke all on function app_private.is_app_owner() from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_app_owner() to authenticated;
create function public.is_app_owner() returns boolean
language sql stable security invoker set search_path = ''
as $$ select app_private.is_app_owner(); $$;
revoke all on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated;

create table public.reflections (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  kind text not null check (kind in ('reflection','quote')),
  content text not null check (length(btrim(content)) between 1 and 10000),
  attribution text not null default '' check (length(attribution) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id,id),
  check (kind = 'quote' or attribution = '')
);
create index reflections_owner_created on public.reflections(owner_id,created_at desc);

create table public.reading_books (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 300),
  author text not null default '' check (length(author) <= 300),
  status text not null check (status in ('planned','reading','finished')),
  current_page bigint not null default 0 check (current_page between 0 and 9007199254740991),
  total_pages bigint check (total_pages between 1 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id,id),
  check (total_pages is null or current_page <= total_pages),
  check (status <> 'planned' or current_page = 0),
  check (status <> 'finished' or total_pages is null or current_page = total_pages),
  check (total_pages is null or current_page <> total_pages or status = 'finished')
);
create index reading_books_owner_created on public.reading_books(owner_id,created_at desc);

create table public.reading_notes (
  owner_id uuid not null,
  book_id text not null,
  id text not null check (length(id) between 1 and 200),
  content text not null check (length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id,book_id,id),
  foreign key(owner_id,book_id) references public.reading_books(owner_id,id) on delete cascade
);
create index reading_notes_book_created on public.reading_notes(owner_id,book_id,created_at desc);

alter table public.reflections enable row level security;
alter table public.reading_books enable row level security;
alter table public.reading_notes enable row level security;
revoke all on public.reflections, public.reading_books, public.reading_notes from public, anon, authenticated;
grant select, insert, update, delete on public.reflections, public.reading_books, public.reading_notes to authenticated;

create policy owner_reflections on public.reflections for all to authenticated
using (owner_id = (select auth.uid()) and (select public.is_app_owner()))
with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));
create policy owner_books on public.reading_books for all to authenticated
using (owner_id = (select auth.uid()) and (select public.is_app_owner()))
with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));
create policy owner_notes on public.reading_notes for all to authenticated
using (owner_id = (select auth.uid()) and (select public.is_app_owner()))
with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));

-- One transaction per import. Existing records are never overwritten.
-- Existing books and all their incoming notes are skipped as one unit.
create function public.import_personal_data(payload jsonb, dry_run boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); item jsonb; note jsonb; inserted text;
  ea integer := 0; es integer := 0; ba integer := 0; bs integer := 0; na integer := 0; ns integer := 0;
begin
  if uid is null or not public.is_app_owner() then raise exception 'Access denied' using errcode = '42501'; end if;
  if jsonb_typeof(payload->'entries') is distinct from 'array' or jsonb_typeof(payload->'books') is distinct from 'array' then raise exception 'Invalid import'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  for item in select value from jsonb_array_elements(payload->'entries') loop
    if exists(select 1 from public.reflections where owner_id=uid and id=item->>'id') then es := es+1;
    elsif dry_run then ea := ea+1;
    else
      inserted := null;
      insert into public.reflections(owner_id,id,kind,content,attribution,created_at,updated_at)
      values(uid,item->>'id',item->>'kind',item->>'content',item->>'attribution',(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
      on conflict do nothing returning id into inserted;
      if inserted is null then es:=es+1; else ea:=ea+1; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(payload->'books') loop
    if jsonb_typeof(item->'notes') is distinct from 'array' then raise exception 'Invalid book notes'; end if;
    if exists(select 1 from public.reading_books where owner_id=uid and id=item->>'id') then
      bs:=bs+1; ns:=ns+jsonb_array_length(item->'notes');
    elsif dry_run then ba:=ba+1; na:=na+jsonb_array_length(item->'notes');
    else
      inserted := null;
      insert into public.reading_books(owner_id,id,title,author,status,current_page,total_pages,created_at,updated_at)
      values(uid,item->>'id',item->>'title',item->>'author',item->>'status',(item->>'currentPage')::bigint,(item->>'totalPages')::bigint,(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
      on conflict do nothing returning id into inserted;
      if inserted is null then bs:=bs+1; ns:=ns+jsonb_array_length(item->'notes');
      else
        ba:=ba+1;
        for note in select value from jsonb_array_elements(item->'notes') loop
          insert into public.reading_notes(owner_id,book_id,id,content,created_at,updated_at)
          values(uid,item->>'id',note->>'id',note->>'content',(note->>'createdAt')::timestamptz,(note->>'updatedAt')::timestamptz);
          na:=na+1;
        end loop;
      end if;
    end if;
  end loop;
  return jsonb_build_object('entriesAdded',ea,'entriesSkipped',es,'booksAdded',ba,'booksSkipped',bs,'notesAdded',na,'notesSkipped',ns);
end;
$$;
revoke all on function public.import_personal_data(jsonb,boolean) from public, anon;
grant execute on function public.import_personal_data(jsonb,boolean) to authenticated;
commit;
