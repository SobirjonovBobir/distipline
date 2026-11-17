create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  task_date date not null,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on tasks (user_id, task_date);

create table if not exists reminders (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  body text not null,
  kind text not null default 'incomplete',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_created_idx on reminders (user_id, created_at desc);
