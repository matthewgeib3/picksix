/**
 * Pick Six · ESPN scoreboard reader
 *
 * ESPN's scoreboard endpoint is unofficial and undocumented, so everything
 * here is defensive: any field can be missing, and a game with no usable
 * spread comes back with null rather than throwing.
 *
 * Important: ESPN only carries odds for UPCOMING games. Once a game is final
 * the odds disappear entirely. That's why we freeze our own copy of the
 * spread at publish time and grade against that, never against ESPN.
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football";
const PATH = { cfb: "college-football", nfl: "nfl" } as const;

export type League = "cfb" | "nfl";

export type SlateGame = {
  espnEventId: string;
  league: League;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  kickoffAt: string;
  /** Signed home spread straight from ESPN. -7 = home favored by 7. */
  rawHomeSpread: number | null;
  /** Same number nudged onto a half point so it can never push. */
  homeSpread: number | null;
  overUnder: number | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

/* ------------------------------------------------------------------ */
/* the hook                                                            */
/* ------------------------------------------------------------------ */

/**
 * Whole-number spreads can push, which our rules don't allow. We push the
 * number away from zero, which hands the extra half point to the underdog:
 * a 3-point favorite now has to win by 4.
 *
 * Returns null for a pick'em, where there's no favorite to move against --
 * the admin has to choose a side by hand.
 */
export function hookSpread(spread: number | null): number | null {
  if (spread === null) return null;
  if (!Number.isInteger(spread)) return spread;
  if (spread === 0) return null;
  return spread < 0 ? spread - 0.5 : spread + 0.5;
}

export function isHalfPoint(spread: number): boolean {
  return Math.round(Math.abs(spread) * 10) % 10 === 5;
}

/* ------------------------------------------------------------------ */
/* parsing                                                             */
/* ------------------------------------------------------------------ */

type EspnTeam = { abbreviation?: string; displayName?: string; shortDisplayName?: string };
type EspnCompetitor = { homeAway?: string; score?: string | number; team?: EspnTeam };
type EspnOdds = {
  details?: string;
  spread?: number;
  overUnder?: number;
  homeTeamOdds?: { favorite?: boolean };
  awayTeamOdds?: { favorite?: boolean };
};
type EspnCompetition = {
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
  status?: { type?: { name?: string } };
};
type EspnEvent = { id?: string; date?: string; competitions?: EspnCompetition[] };

function toScore(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Work out the signed home spread from whichever fields ESPN provided. */
function readHomeSpread(odds: EspnOdds | undefined, homeAbbr: string): number | null {
  if (!odds) return null;

  if (typeof odds.spread === "number") {
    const magnitude = Math.abs(odds.spread);
    if (odds.homeTeamOdds?.favorite) return -magnitude;
    if (odds.awayTeamOdds?.favorite) return magnitude;
    if (magnitude === 0) return 0;
  }

  // Fallback: read the "TCU -7.5" string and match it against the home team.
  if (typeof odds.details === "string") {
    if (/^(even|pk)$/i.test(odds.details.trim())) return 0;
    const match = odds.details.trim().match(/^([A-Za-z0-9&.'-]+)\s+(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const magnitude = Math.abs(Number(match[2]));
      return match[1].toUpperCase() === homeAbbr.toUpperCase() ? -magnitude : magnitude;
    }
  }

  return null;
}

function parseEvent(event: EspnEvent, league: League): SlateGame | null {
  const comp = event.competitions?.[0];
  if (!comp || !event.id || !event.date) return null;

  const home = comp.competitors?.find((c) => c.homeAway === "home");
  const away = comp.competitors?.find((c) => c.homeAway === "away");
  if (!home?.team || !away?.team) return null;

  const homeAbbr = home.team.abbreviation ?? "";
  const awayAbbr = away.team.abbreviation ?? "";
  const raw = readHomeSpread(comp.odds?.[0], homeAbbr);

  return {
    espnEventId: event.id,
    league,
    homeTeam: home.team.shortDisplayName ?? home.team.displayName ?? homeAbbr,
    awayTeam: away.team.shortDisplayName ?? away.team.displayName ?? awayAbbr,
    homeAbbr,
    awayAbbr,
    kickoffAt: new Date(event.date).toISOString(),
    rawHomeSpread: raw,
    homeSpread: hookSpread(raw),
    overUnder: typeof comp.odds?.[0]?.overUnder === "number" ? comp.odds[0].overUnder! : null,
    status: comp.status?.type?.name ?? "UNKNOWN",
    homeScore: toScore(home.score),
    awayScore: toScore(away.score),
  };
}

/* ------------------------------------------------------------------ */
/* fetching                                                            */
/* ------------------------------------------------------------------ */

export type SlateQuery = {
  year: number;
  /** 2 = regular season, 3 = postseason */
  seasonType: number;
  week: number;
};

export async function fetchSlate(
  league: League,
  { year, seasonType, week }: SlateQuery
): Promise<SlateGame[]> {
  const params = new URLSearchParams({
    dates: String(year),
    seasontype: String(seasonType),
    week: String(week),
  });
  // 80 = FBS only. Without it college returns every division.
  if (league === "cfb") params.set("groups", "80");

  const res = await fetch(`${BASE}/${PATH[league]}/scoreboard?${params}`, {
    headers: { "User-Agent": "picksix" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`ESPN returned ${res.status} for ${league}`);

  const data = (await res.json()) as { events?: EspnEvent[] };
  return (data.events ?? [])
    .map((e) => parseEvent(e, league))
    .filter((g): g is SlateGame => g !== null)
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

/**
 * Final scores for a set of ESPN event ids, used by the grading job.
 * Looks games up by week, since that's one request instead of one per game.
 */
export async function fetchResults(
  league: League,
  query: SlateQuery
): Promise<Map<string, SlateGame>> {
  const slate = await fetchSlate(league, query);
  return new Map(slate.map((g) => [g.espnEventId, g]));
}
