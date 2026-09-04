/**
 * Everything is stored in UTC and shown in Eastern. Doing the conversion in
 * one place is what keeps a game from locking an hour early or late when
 * daylight saving flips in November.
 */

export const LEAGUE_TZ = "America/New_York";

/**
 * Minutes before kickoff that a game locks and its picks become visible.
 *
 * Lock and reveal are driven by this one number on purpose: if they could be
 * set separately, someone would eventually open a window where picks are
 * visible but still editable, and the whole sealed-pick guarantee would
 * quietly stop being true.
 */
export const REVEAL_MINUTES = 30;

const kickoffFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: LEAGUE_TZ,
  weekday: "short",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: LEAGUE_TZ,
  hour: "numeric",
  minute: "2-digit",
});

export function kickoffLabel(iso: string): string {
  return kickoffFmt.format(new Date(iso));
}

export function timeLabel(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function revealAt(kickoffIso: string): Date {
  return new Date(new Date(kickoffIso).getTime() - REVEAL_MINUTES * 60_000);
}

/**
 * A game is locked and open for viewing at the same instant -- currently
 * half an hour before kickoff.
 */
export function isRevealed(kickoffIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= revealAt(kickoffIso).getTime();
}

export function isLocked(kickoffIso: string, now: Date = new Date()): boolean {
  return isRevealed(kickoffIso, now);
}

/**
 * "TCU -7.5" / "UNC +7.5" style label from a signed home spread.
 */
export function spreadLabel(
  homeSpread: number,
  homeAbbr: string,
  awayAbbr: string
): string {
  if (homeSpread < 0) return `${homeAbbr} ${homeSpread}`;
  if (homeSpread > 0) return `${awayAbbr} -${homeSpread}`;
  return "PK";
}

/** Which side covered, given a final score and our frozen spread. */
export function atsWinner(
  homeScore: number,
  awayScore: number,
  homeSpread: number
): "home" | "away" {
  return homeScore + homeSpread > awayScore ? "home" : "away";
}
