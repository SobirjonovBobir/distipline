alter table user_settings add column if not exists notify_incomplete boolean not null default true;
alter table user_settings add column if not exists notify_focus boolean not null default true;
alter table user_settings add column if not exists notify_journal boolean not null default false;
alter table user_settings add column if not exists default_priority text not null default 'normal';
