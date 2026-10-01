-- Independent plans domain. Public reading; only the registered owner can write.
begin;
create table public.plans (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 300),
  kind text not null check (kind in ('book','course','question','project','task')),
  details text not null default '' check (length(details) <= 5000),
  url text not null default '' check (length(url) <= 1000 and (url = '' or url ~* '^https?://')),
  status text not null check (status in ('planned','doing','done')),
  current bigint not null default 0 check (current between 0 and 9007199254740991),
  target bigint check (target between 1 and 9007199254740991),
  unit text not null default '' check (length(unit) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id,id),
  check ((target is not null or (current = 0 and unit = '')) and (target is null or current <= target)),
  check (status <> 'planned' or current = 0),
  check (status <> 'done' or target is null or current = target),
  check (target is null or current <> target or status = 'done')
);
create index plans_owner_created on public.plans(owner_id,created_at desc);
alter table public.plans enable row level security;
revoke all on public.plans from public, anon, authenticated;
grant select on public.plans to anon;
grant select, insert, update, delete on public.plans to authenticated;
create policy public_read_plans on public.plans for select to anon, authenticated using (true);
create policy owner_plans on public.plans for all to authenticated
using (owner_id = (select auth.uid()) and (select public.is_app_owner()))
with check (owner_id = (select auth.uid()) and (select public.is_app_owner()));

create or replace function public.import_personal_data(payload jsonb, dry_run boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); item jsonb; note jsonb; inserted text;
  ea integer := 0; es integer := 0; ba integer := 0; bs integer := 0; na integer := 0; ns integer := 0; ga integer := 0; gs integer := 0; pa integer := 0; ps integer := 0;
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
  if payload ? 'gratitudes' and jsonb_typeof(payload->'gratitudes') is distinct from 'array' then
    raise exception 'Invalid gratitude entries';
  end if;
  for item in select value from jsonb_array_elements(coalesce(payload->'gratitudes','[]'::jsonb)) loop
    if exists(select 1 from public.gratitude_entries where owner_id=uid and id=item->>'id') then gs:=gs+1;
    elsif dry_run then ga:=ga+1;
    else
      inserted := null;
      insert into public.gratitude_entries(owner_id,id,title,content,created_at,updated_at)
      values(uid,item->>'id',coalesce(item->>'title',''),item->>'content',(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
      on conflict do nothing returning id into inserted;
      if inserted is null then gs:=gs+1; else ga:=ga+1; end if;
    end if;
  end loop;
  if payload ? 'plans' and jsonb_typeof(payload->'plans') is distinct from 'array' then
    raise exception 'Invalid plans';
  end if;
  for item in select value from jsonb_array_elements(coalesce(payload->'plans','[]'::jsonb)) loop
    if exists(select 1 from public.plans where owner_id=uid and id=item->>'id') then ps:=ps+1;
    elsif dry_run then pa:=pa+1;
    else
      inserted := null;
      insert into public.plans(owner_id,id,title,kind,details,url,status,current,target,unit,created_at,updated_at)
      values(uid,item->>'id',item->>'title',item->>'kind',item->>'details',item->>'url',item->>'status',(item->>'current')::bigint,(item->>'target')::bigint,item->>'unit',(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
      on conflict do nothing returning id into inserted;
      if inserted is null then ps:=ps+1; else pa:=pa+1; end if;
    end if;
  end loop;
  return jsonb_build_object('gratitudesAdded',ga,'gratitudesSkipped',gs,'entriesAdded',ea,'entriesSkipped',es,'booksAdded',ba,'booksSkipped',bs,'notesAdded',na,'notesSkipped',ns,'plansAdded',pa,'plansSkipped',ps);
end;
$$;
commit;
