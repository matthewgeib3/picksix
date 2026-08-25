-- Pick Six · migration 004
-- Lets a week exist without counting toward the season.
-- Used for rehearsal weeks: publish it, pick it, watch it lock, reveal and
-- grade, and none of it touches the leaderboard.

alter table weeks add column if not exists counts boolean not null default true;
