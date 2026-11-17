create table if not exists categories (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  color text not null default '#2f7a55',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on categories (user_id, sort_order);

alter table tasks add column if not exists schedule_type text not null default 'once';
alter table tasks add column if not exists start_date date;
alter table tasks add column if not exists end_date date;
alter table tasks add column if not exists weekdays text not null default '';
alter table tasks add column if not exists category_id text;
alter table tasks add column if not exists notes text not null default '';
alter table tasks add column if not exists archived boolean not null default false;

update tasks set start_date = task_date where start_date is null;
update tasks set end_date = task_date where schedule_type = 'once' and end_date is null and task_date is not null;

create table if not exists task_completions (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  occurrence_date date not null,
  done boolean not null default true,
  completed_at timestamptz,
  unique (task_id, occurrence_date)
);

create index if not exists task_completions_user_date_idx
  on task_completions (user_id, occurrence_date);

insert into task_completions (id, task_id, user_id, occurrence_date, done, completed_at)
select
  'migrated-' || id,
  id,
  user_id,
  task_date,
  true,
  updated_at
from tasks
where done = true
  and not exists (
    select 1 from task_completions tc
    where tc.task_id = tasks.id and tc.occurrence_date = tasks.task_date
  );

create table if not exists notes (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on notes (user_id, updated_at desc);

create table if not exists achievements (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  code text not null,
  title text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);
