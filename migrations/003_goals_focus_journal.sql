create table if not exists goals (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_count integer not null default 1,
  unit text not null default 'marta',
  period text not null default 'week',
  start_date date not null,
  end_date date,
  category_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_idx on goals (user_id, archived, start_date);

create table if not exists goal_progress (
  id text primary key,
  goal_id text not null references goals(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  progress_date date not null,
  amount integer not null default 1,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists goal_progress_goal_date_idx on goal_progress (goal_id, progress_date);

create table if not exists focus_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  mode text not null default 'pomodoro',
  planned_seconds integer not null default 1500,
  elapsed_seconds integer not null default 0,
  status text not null default 'completed',
  task_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text not null default ''
);

create index if not exists focus_sessions_user_idx on focus_sessions (user_id, started_at desc);

create table if not exists journal_entries (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  entry_date date not null,
  mood text not null default 'neutral',
  body text not null default '',
  gratitude text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists journal_entries_user_date_idx on journal_entries (user_id, entry_date desc);

create table if not exists user_settings (
  user_id text primary key references users(id) on delete cascade,
  theme text not null default 'forest',
  density text not null default 'comfortable',
  week_starts_on integer not null default 1,
  focus_work_minutes integer not null default 25,
  focus_break_minutes integer not null default 5,
  locale text not null default 'uz',
  timezone text not null default 'Asia/Tashkent',
  updated_at timestamptz not null default now()
);
