-- Suggested reading order is stored per book. It never restricts progress.
begin;
alter table public.reading_books
  add column prerequisite_ids text[] not null default '{}'
  check (cardinality(prerequisite_ids) <= 30 and array_position(prerequisite_ids, id) is null);

create function public.clear_deleted_book_prerequisites()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.reading_books
  set prerequisite_ids = array_remove(prerequisite_ids, old.id)
  where owner_id = old.owner_id and old.id = any(prerequisite_ids);
  return old;
end;
$$;
revoke all on function public.clear_deleted_book_prerequisites() from public, anon, authenticated;
create trigger clear_deleted_book_prerequisites
  after delete on public.reading_books
  for each row execute function public.clear_deleted_book_prerequisites();

create or replace function public.import_personal_data(payload jsonb, dry_run boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid(); item jsonb; note jsonb; inserted text;
  ea integer := 0; es integer := 0; ba integer := 0; bs integer := 0; na integer := 0; ns integer := 0; ga integer := 0; gs integer := 0; pa integer := 0; ps integer := 0; sa integer := 0; ss integer := 0;
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
      insert into public.reading_books(owner_id,id,title,author,status,current_page,total_pages,prerequisite_ids,created_at,updated_at)
      values(uid,item->>'id',item->>'title',item->>'author',item->>'status',(item->>'currentPage')::bigint,(item->>'totalPages')::bigint,array(select jsonb_array_elements_text(coalesce(item->'prerequisiteIds','[]'::jsonb))),(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
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
  if payload ? 'subscriptions' and jsonb_typeof(payload->'subscriptions') is distinct from 'array' then
    raise exception 'Invalid subscriptions';
  end if;
  for item in select value from jsonb_array_elements(coalesce(payload->'subscriptions','[]'::jsonb)) loop
    if exists(select 1 from public.subscriptions where owner_id=uid and id=item->>'id') then ss:=ss+1;
    elsif dry_run then sa:=sa+1;
    else
      inserted := null;
      insert into public.subscriptions(owner_id,id,name,amount,currency,billing_cycle,next_renewal,status,url,notes,created_at,updated_at)
      values(uid,item->>'id',item->>'name',(item->>'amount')::numeric,item->>'currency',item->>'billingCycle',(item->>'nextRenewal')::date,item->>'status',item->>'url',item->>'notes',(item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz)
      on conflict do nothing returning id into inserted;
      if inserted is null then ss:=ss+1; else sa:=sa+1; end if;
    end if;
  end loop;
  return jsonb_build_object('gratitudesAdded',ga,'gratitudesSkipped',gs,'entriesAdded',ea,'entriesSkipped',es,'booksAdded',ba,'booksSkipped',bs,'notesAdded',na,'notesSkipped',ns,'plansAdded',pa,'plansSkipped',ps,'subscriptionsAdded',sa,'subscriptionsSkipped',ss);
end;
$$;
commit;
