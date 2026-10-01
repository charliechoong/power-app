-- Ending subscriptions remain accessible through their paid-through date.
alter table public.subscriptions
  drop constraint subscriptions_status_check,
  add constraint subscriptions_status_check
    check (
      status in ('active', 'ending', 'paused', 'canceled')
      and (status <> 'ending' or next_renewal is not null)
    );
