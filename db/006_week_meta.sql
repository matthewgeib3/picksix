-- Pick Six · migration 006
-- Remembers which ESPN week each published week came from, so the publish
-- screen can default to the next one instead of resetting to week 1.

alter table weeks add column if not exists cfb_week int;
alter table weeks add column if not exists cfb_type int;
alter table weeks add column if not exists nfl_week int;
alter table weeks add column if not exists nfl_type int;
