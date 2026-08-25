import { db } from "./supabase";
import { fetchGameResult, type League } from "./espn";
import { atsWinner } from "./time";

/**
 * Grading.
 *
 * Note what this never does: ask ESPN what the spread was. ESPN drops odds
 * the moment a game ends, so the only spread that exists after kickoff is
 * the one we froze at publish time. Results come from ESPN, the line comes
 * from us, and the two are combined here.
 */

export type GradeReport = {
  checked: number;
  graded: number;
  errors: string[];
};

/** Don't bother asking about a game that kicked off twenty minutes ago. */
const SETTLE_MINUTES = 120;

/* ------------------------------------------------------------------ */
/* keeping kickoff times honest                                        */
/* ------------------------------------------------------------------ */

type UpcomingGame = {
  id: string;
  league: League;
  espn_event_id: string | null;
  kickoff_at: string;
};

/**
 * Re-checks the scheduled kickoff of games that haven't started.
 *
 * This matters more than it looks. The kickoff time is the lock deadline,
 * and we froze ours at publish time -- but the NFL flexes Sunday games and
 * weather moves college ones. If a game is pulled EARLIER and we don't
 * notice, picks stay open on a game that has already started, which is a
 * fairness hole rather than a cosmetic one.
 */
export async function refreshKickoffs(limit = 12): Promise<number> {
  const { data, error } = await db()
    .from("games")
    .select("id, league, espn_event_id, kickoff_at")
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(limit);

  if (error) return 0;

  let moved = 0;

  for (const game of (data ?? []) as UpcomingGame[]) {
    if (!game.espn_event_id) continue;

    try {
      const result = await fetchGameResult(game.league, game.espn_event_id);
      if (!result?.kickoffAt) continue;

      const current = new Date(game.kickoff_at).toISOString();
      if (result.kickoffAt === current) continue;

      await db()
        .from("games")
        .update({ kickoff_at: result.kickoffAt })
        .eq("id", game.id);

      moved += 1;
    } catch {
      /* one bad lookup shouldn't stop the rest */
    }
  }

  return moved;
}

/* ------------------------------------------------------------------ */
/* the sweep                                                           */
/* ------------------------------------------------------------------ */

/**
 * Two separate throttles, because the two jobs move at very different speeds.
 *
 * Grading needs to be prompt -- people are watching for a result. Kickoff
 * times change maybe twice a season and are announced days ahead, so checking
 * every half hour is generous. Keeping them apart stops the schedule check
 * from tripling our request count against an undocumented API.
 */
const GRADE_THROTTLE_MS = 45_000;
const SCHEDULE_THROTTLE_MS = 30 * 60_000;

let lastGradeRun = 0;
let lastScheduleRun = 0;

/**
 * Triggered by somebody looking at a page. Throttled, and it never throws --
 * a bad response from ESPN must not take the leaderboard down.
 */
export async function gradeOnView(limit = 8): Promise<void> {
  const now = Date.now();

  if (now - lastScheduleRun >= SCHEDULE_THROTTLE_MS) {
    lastScheduleRun = now;
    try {
      await refreshKickoffs();
    } catch {
      /* swallowed on purpose */
    }
  }

  if (now - lastGradeRun >= GRADE_THROTTLE_MS) {
    lastGradeRun = now;
    try {
      await gradeOpenGames(limit);
    } catch {
      /* swallowed on purpose */
    }
  }
}

/** Full sweep for the scheduled job and the admin's manual button. */
export async function sweep(): Promise<GradeReport & { moved: number }> {
  const moved = await refreshKickoffs();
  const report = await gradeOpenGames();
  return { ...report, moved };
}

type OpenGame = {
  id: string;
  league: League;
  espn_event_id: string | null;
  home_spread: number;
  status: string;
};

export async function gradeOpenGames(limit = 20): Promise<GradeReport> {
  const report: GradeReport = { checked: 0, graded: 0, errors: [] };
  const cutoff = new Date(Date.now() - SETTLE_MINUTES * 60_000).toISOString();

  const { data, error } = await db()
    .from("games")
    .select("id, league, espn_event_id, home_spread, status")
    .neq("status", "final")
    .lt("kickoff_at", cutoff)
    .order("kickoff_at", { ascending: true })
    .limit(limit);

  if (error) {
    report.errors.push(error.message);
    return report;
  }

  for (const game of (data ?? []) as OpenGame[]) {
    report.checked += 1;

    if (!game.espn_event_id) {
      report.errors.push(`${game.id}: no ESPN id, needs a manual score`);
      continue;
    }

    try {
      const result = await fetchGameResult(game.league, game.espn_event_id);

      if (!result) {
        report.errors.push(`${game.id}: ESPN returned nothing`);
        continue;
      }

      // Still playing: record the running score, leave it ungraded.
      if (!result.completed || result.homeScore === null || result.awayScore === null) {
        if (game.status !== "in_progress") {
          await db()
            .from("games")
            .update({
              status: "in_progress",
              home_score: result.homeScore,
              away_score: result.awayScore,
            })
            .eq("id", game.id);
        }
        continue;
      }

      const winner = atsWinner(
        result.homeScore,
        result.awayScore,
        Number(game.home_spread)
      );

      const { error: updateError } = await db()
        .from("games")
        .update({
          home_score: result.homeScore,
          away_score: result.awayScore,
          ats_winner: winner,
          status: "final",
        })
        .eq("id", game.id);

      if (updateError) report.errors.push(`${game.id}: ${updateError.message}`);
      else report.graded += 1;
    } catch (err) {
      report.errors.push(
        `${game.id}: ${err instanceof Error ? err.message : "request failed"}`
      );
    }
  }

  return report;
}
