-- Content is public to read. Existing owner_* policies still govern all writes.
begin;

grant select on public.reflections, public.reading_books,
  public.reading_notes, public.gratitude_entries to anon;

create policy public_read_reflections on public.reflections
  for select to anon, authenticated using (true);
create policy public_read_books on public.reading_books
  for select to anon, authenticated using (true);
create policy public_read_notes on public.reading_notes
  for select to anon, authenticated using (true);
create policy public_read_gratitude on public.gratitude_entries
  for select to anon, authenticated using (true);

commit;
