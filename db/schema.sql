-- Pick Six · schema v1
-- Paste the whole file into the Supabase SQL Editor and hit Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- members
-- ---------------------------------------------------------------
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  pin_hash    text not null,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- weeks
-- ---------------------------------------------------------------
create table if not exists weeks (
  id           uuid primary key default gen_random_uuid(),
  season       int  not null default 2026,
  label        text not null,
  sort_order   int  not null,
  status       text not null default 'draft'
               check (status in ('draft','live','final')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (season, label)
);

-- ---------------------------------------------------------------
-- games
--   home_spread is signed and always lands on a half point:
--     -6.5  = home favored by 6.5
--     +3.5  = home getting 3.5
--   Home covers when  home_score + home_spread > away_score.
--   The half point makes a push arithmetically impossible.
-- ---------------------------------------------------------------
create table if not exists games (
  id             uuid primary key default gen_random_uuid(),
  week_id        uuid not null references weeks(id) on delete cascade,
  league         text not null check (league in ('cfb','nfl')),
  espn_event_id  text,
  home_team      text not null,
  away_team      text not null,
  home_spread    numeric(4,1) not null
                 check (mod((home_spread * 10)::int, 10) in (5,-5)),
  kickoff_at     timestamptz not null,
  home_score     int,
  away_score     int,
  ats_winner     text check (ats_winner in ('home','away')),
  status         text not null default 'scheduled'
                 check (status in ('scheduled','in_progress','final')),
  is_tiebreaker  boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists games_week_idx    on games (week_id);
create index if not exists games_kickoff_idx on games (kickoff_at);

-- ---------------------------------------------------------------
-- picks
-- ---------------------------------------------------------------
create table if not exists picks (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  game_id    uuid not null references games(id)   on delete cascade,
  selection  text not null check (selection in ('home','away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, game_id)
);

create index if not exists picks_game_idx   on picks (game_id);
create index if not exists picks_member_idx on picks (member_id);

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists picks_touch on picks;
create trigger picks_touch before update on picks
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------
-- tiebreakers
--   Super Bowl total-points guess, used only if two people finish tied
--   after the Super Bowl spread pick.
-- ---------------------------------------------------------------
create table if not exists tiebreakers (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references members(id) on delete cascade,
  game_id            uuid not null references games(id)   on delete cascade,
  total_points_guess int not null check (total_points_guess >= 0),
  created_at         timestamptz not null default now(),
  unique (member_id, game_id)
);

-- ---------------------------------------------------------------
-- Lock the front door.
--   RLS on with zero policies means the public API key can read
--   nothing at all. Every query goes through our own server, which
--   holds the service key and decides what a member is allowed to
--   see -- including whether a game's picks have hit reveal time.
-- ---------------------------------------------------------------
alter table members     enable row level security;
alter table weeks       enable row level security;
alter table games       enable row level security;
alter table picks       enable row level security;
alter table tiebreakers enable row level security;
