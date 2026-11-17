create table if not exists cash_categories (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  color text not null default '#2f7a55',
  kind text not null default 'both' check (kind in ('income', 'expense', 'both')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists cash_categories_user_idx on cash_categories (user_id, sort_order);
