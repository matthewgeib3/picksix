-- Pick Six · migration 003
-- Team abbreviations, so the grid can show SEA instead of Seahawks.
-- Nullable on purpose: any week published before this ran still works,
-- the interface just falls back to the full team name.

alter table games add column if not exists home_abbr text;
alter table games add column if not exists away_abbr text;
