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

/**
 * Floor on how often a page view is allowed to trigger grading.
 *
 * Six people with the grid open, each refreshing every minute, would
 * otherwise hammer an undocumented API with hundreds of requests an hour and
 * get us rate-limited. This caps it regardless of how many people are
 * watching, while still catching a final within a couple of minutes.
 */
const VIEW_THROTTLE_MS = 45_000;
let lastViewRun = 0;

/**
 * Grading triggered by somebody looking at a page. Throttled, and it never
 * throws -- a bad response from ESPN must not take the leaderboard down.
 */
export async function gradeOnView(limit = 8): Promise<void> {
  const now = Date.now();
  if (now - lastViewRun < VIEW_THROTTLE_MS) return;
  lastViewRun = now;

  try {
    await gradeOpenGames(limit);
  } catch {
    /* swallowed on purpose */
  }
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
