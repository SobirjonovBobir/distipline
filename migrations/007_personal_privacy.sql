-- Personal (Shaxsiy) privacy preference — additive, no data wipe
alter table user_settings
  add column if not exists hide_personal boolean not null default true;
