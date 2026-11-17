create table if not exists cash_accounts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null default 'Asosiy',
  currency text not null default 'UZS',
  opening_balance numeric(14,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cash_accounts_user_idx on cash_accounts (user_id, archived);

create table if not exists cash_transactions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  account_id text not null references cash_accounts(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Umumiy',
  note text not null default '',
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists cash_tx_user_date_idx on cash_transactions (user_id, occurred_on desc);
create index if not exists cash_tx_account_idx on cash_transactions (account_id, occurred_on desc);

create table if not exists cash_budgets (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  category text not null,
  month_key text not null,
  limit_amount numeric(14,2) not null check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category, month_key)
);

create index if not exists cash_budgets_user_month_idx on cash_budgets (user_id, month_key);

create table if not exists cash_savings (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  note text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cash_savings_user_idx on cash_savings (user_id, archived);
