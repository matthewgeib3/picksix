-- Pick Six · migration 005
-- Profile photos.

alter table members add column if not exists avatar_url text;

-- A public bucket: the images themselves are readable by anyone holding the
-- URL, which is fine for six friends' faces. Writes still go through our
-- server, which checks you're either editing yourself or a commissioner.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
