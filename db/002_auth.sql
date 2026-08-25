-- Pick Six · migration 002
-- Switches members from name+PIN to username+password.
-- Safe to run on the empty tables you already created.

alter table members add column if not exists username      text;
alter table members add column if not exists password_hash text;

-- Nothing to backfill on an empty league, but this keeps the migration
-- safe if you happened to create a row already.
update members set username      = lower(name) where username is null;
update members set password_hash = pin_hash    where password_hash is null
                                                 and pin_hash is not null;

alter table members alter column username      set not null;
alter table members alter column password_hash set not null;

alter table members drop column if exists pin_hash;

-- Usernames are case-insensitive: "Matt" and "matt" are the same account.
create unique index if not exists members_username_key
  on members (lower(username));
