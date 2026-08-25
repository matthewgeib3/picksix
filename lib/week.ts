import { db } from "./supabase";

export type Week = {
  id: string;
  season: number;
  label: string;
  sortOrder: number;
  status: string;
};

export type Game = {
  id: string;
  league: "cfb" | "nfl";
  homeTeam: string;
  awayTeam: string;
  /** Short form for tight layouts. Falls back to the full name. */
  homeAbbr: string;
  awayAbbr: string;
  homeSpread: number;
  kickoffAt: string;
  homeScore: number | null;
  awayScore: number | null;
  atsWinner: "home" | "away" | null;
  status: string;
  isTiebreaker: boolean;
};

type WeekRow = {
  id: string;
  season: number;
  label: string;
  sort_order: number;
  status: string;
};

type GameRow = {
  id: string;
  league: "cfb" | "nfl";
  home_team: string;
  away_team: string;
  home_abbr: string | null;
  away_abbr: string | null;
  home_spread: number;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  ats_winner: "home" | "away" | null;
  status: string;
  is_tiebreaker: boolean;
};

function toWeek(r: WeekRow): Week {
  return {
    id: r.id,
    season: r.season,
    label: r.label,
    sortOrder: r.sort_order,
    status: r.status,
  };
}

function toGame(r: GameRow): Game {
  return {
    id: r.id,
    league: r.league,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeAbbr: r.home_abbr || r.home_team,
    awayAbbr: r.away_abbr || r.away_team,
    homeSpread: Number(r.home_spread),
    kickoffAt: new Date(r.kickoff_at).toISOString(),
    homeScore: r.home_score,
    awayScore: r.away_score,
    atsWinner: r.ats_winner,
    status: r.status,
    isTiebreaker: r.is_tiebreaker,
  };
}

/**
 * The week everyone is currently picking: the newest published one.
 *
 * Sorted by season first, because sort_order restarts at 1 each season --
 * without that, publishing a 2025 week for testing could outrank the live
 * 2026 one and quietly hijack the picks page.
 */
export async function currentWeek(): Promise<Week | null> {
  const { data } = await db()
    .from("weeks")
    .select("id, season, label, sort_order, status")
    .eq("status", "live")
    .order("season", { ascending: false })
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? toWeek(data as WeekRow) : null;
}

export async function allWeeks(): Promise<Week[]> {
  const { data } = await db()
    .from("weeks")
    .select("id, season, label, sort_order, status")
    .order("season", { ascending: false })
    .order("sort_order", { ascending: false });

  return ((data ?? []) as WeekRow[]).map(toWeek);
}

export async function weekById(id: string): Promise<Week | null> {
  const { data } = await db()
    .from("weeks")
    .select("id, season, label, sort_order, status")
    .eq("id", id)
    .maybeSingle();

  return data ? toWeek(data as WeekRow) : null;
}

export async function gamesForWeek(weekId: string): Promise<Game[]> {
  const { data } = await db()
    .from("games")
    .select(
      "id, league, home_team, away_team, home_abbr, away_abbr, home_spread, kickoff_at, home_score, away_score, ats_winner, status, is_tiebreaker"
    )
    .eq("week_id", weekId)
    .order("kickoff_at", { ascending: true });

  return ((data ?? []) as GameRow[]).map(toGame);
}

export type LeagueMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export async function activeMembers(): Promise<LeagueMember[]> {
  const { data } = await db()
    .from("members")
    .select("id, name, avatar_url")
    .eq("active", true)
    .order("name", { ascending: true });

  return ((data ?? []) as {
    id: string;
    name: string;
    avatar_url: string | null;
  }[]).map((m) => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatar_url ?? null,
  }));
}

export type PickRow = {
  memberId: string;
  gameId: string;
  selection: "home" | "away";
};

/**
 * Every member's picks for a set of games.
 *
 * Callers are responsible for hiding the ones that haven't reached their
 * reveal time -- see the grid, which filters before rendering.
 */
export async function picksForGames(gameIds: string[]): Promise<PickRow[]> {
  if (gameIds.length === 0) return [];

  const { data } = await db()
    .from("picks")
    .select("member_id, game_id, selection")
    .in("game_id", gameIds);

  return ((data ?? []) as {
    member_id: string;
    game_id: string;
    selection: "home" | "away";
  }[]).map((r) => ({
    memberId: r.member_id,
    gameId: r.game_id,
    selection: r.selection,
  }));
}

/** My own picks for a set of games: game id -> "home" | "away". */
export async function myPicks(
  memberId: string,
  gameIds: string[]
): Promise<Map<string, "home" | "away">> {
  if (gameIds.length === 0) return new Map();

  const { data } = await db()
    .from("picks")
    .select("game_id, selection")
    .eq("member_id", memberId)
    .in("game_id", gameIds);

  const out = new Map<string, "home" | "away">();
  for (const row of (data ?? []) as { game_id: string; selection: "home" | "away" }[]) {
    out.set(row.game_id, row.selection);
  }
  return out;
}
