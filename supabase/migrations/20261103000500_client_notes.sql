-- Free-text notes on a client ("fade #2, likes a short beard").
-- clients has no column-level grants, so the existing RLS update policy
-- ("salon members update clients") covers it.
alter table public.clients
  add column notes text not null default '' check (char_length(notes) <= 2000);
