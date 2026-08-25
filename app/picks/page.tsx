import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { currentWeek, gamesForWeek, myPicks, type Game } from "@/lib/week";
import { kickoffLabel, isLocked } from "@/lib/time";
import Nav from "@/components/nav";
import { savePicks } from "./actions";

export const dynamic = "force-dynamic";

const LEAGUE_LABEL = { cfb: "College Football", nfl: "NFL" } as const;

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; late?: string; error?: string }>;
}) {
  const member = await requireMember();
  const flags = await searchParams;
  const week = await currentWeek();

  if (!week) {
    return (
      <Shell title="Make picks">
        <p className="text-neutral-400">
          Nothing published yet. The commissioner posts the slate on Tuesdays.
        </p>
      </Shell>
    );
  }

  const games = await gamesForWeek(week.id);
  const picks = await myPicks(
    member.id,
    games.map((g) => g.id)
  );

  const now = new Date();
  const open = games.filter((g) => !isLocked(g.kickoffAt, now));
  const missing = open.filter((g) => !picks.has(g.id)).length;

  return (
    <Shell title="Make picks" subtitle={week.label}>
      {flags.saved && <SavedPanel />}
      {flags.late && (
        <Note tone="warn">
          Saved what was still open. One or more games had already locked.
        </Note>
      )}
      {flags.error && <Note tone="bad">Couldn&rsquo;t save that. Try again.</Note>}

      {missing > 0 ? (
        <Note tone="warn">
          {missing} {missing === 1 ? "game" : "games"} still unpicked. Anything
          left blank at kickoff scores zero.
        </Note>
      ) : (
        open.length > 0 && <Note tone="good">All open games are picked.</Note>
      )}

      <form action={savePicks} className="pb-28">
        <input type="hidden" name="weekId" value={week.id} />

        <div className="space-y-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              selection={picks.get(game.id) ?? null}
              locked={isLocked(game.kickoffAt, now)}
            />
          ))}
        </div>

        {open.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur">
            <div className="mx-auto max-w-lg">
              <button className="w-full rounded bg-amber-500 px-4 py-3 font-semibold text-neutral-950 hover:bg-amber-400">
                Save picks
              </button>
              <p className="mt-2 text-center text-xs text-neutral-600">
                Change them as often as you like until each game locks.
              </p>
            </div>
          </div>
        )}
      </form>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function GameCard({
  game,
  selection,
  locked,
}: {
  game: Game;
  selection: "home" | "away" | null;
  locked: boolean;
}) {
  const awaySpread = signed(-game.homeSpread);
  const homeSpread = signed(game.homeSpread);
  const final = game.status === "final" && game.atsWinner !== null;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider text-neutral-500">
          {LEAGUE_LABEL[game.league]}
        </span>
        <span className="tabular-nums text-neutral-500">
          {kickoffLabel(game.kickoffAt)}
          {locked && (
            <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
              Locked
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Side
          gameId={game.id}
          side="away"
          team={game.awayTeam}
          spread={awaySpread}
          selected={selection === "away"}
          locked={locked}
          won={final && game.atsWinner === "away"}
          lost={final && game.atsWinner === "home"}
        />
        <Side
          gameId={game.id}
          side="home"
          team={game.homeTeam}
          spread={homeSpread}
          selected={selection === "home"}
          locked={locked}
          won={final && game.atsWinner === "home"}
          lost={final && game.atsWinner === "away"}
        />
      </div>

      {final && (
        <p className="mt-3 text-xs tabular-nums text-neutral-500">
          Final {game.awayScore}&ndash;{game.homeScore}
          {selection && (
            <span
              className={
                game.atsWinner === selection
                  ? "ml-2 font-semibold text-emerald-400"
                  : "ml-2 font-semibold text-red-400"
              }
            >
              {game.atsWinner === selection ? "you got it" : "you missed"}
            </span>
          )}
        </p>
      )}

      {locked && !final && !selection && (
        <p className="mt-3 text-xs text-red-400">
          No pick in. This one scores zero.
        </p>
      )}
    </div>
  );
}

function Side({
  gameId,
  side,
  team,
  spread,
  selected,
  locked,
  won,
  lost,
}: {
  gameId: string;
  side: "home" | "away";
  team: string;
  spread: string;
  selected: boolean;
  locked: boolean;
  won: boolean;
  lost: boolean;
}) {
  const base =
    "flex flex-col gap-1 rounded-md border px-3 py-3 text-left transition-colors";

  if (locked) {
    const tone = won
      ? "border-emerald-800 bg-emerald-950/30"
      : lost
        ? "border-neutral-800 bg-neutral-950 opacity-60"
        : "border-neutral-800 bg-neutral-950";

    return (
      <div
        className={`${base} ${tone} ${
          selected ? "ring-2 ring-emerald-500" : ""
        }`}
      >
        <span className="font-semibold">{team}</span>
        <span className="font-mono text-sm tabular-nums text-neutral-400">
          {spread}
        </span>
        {selected && (
          <span className="text-[10px] uppercase tracking-wider text-emerald-400">
            your pick
          </span>
        )}
      </div>
    );
  }

  const id = `${gameId}-${side}`;

  return (
    <div className="contents">
      <input
        type="radio"
        id={id}
        name={`pick_${gameId}`}
        value={side}
        defaultChecked={selected}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={`${base} cursor-pointer border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600 peer-checked:border-emerald-500 peer-checked:bg-emerald-500/15 peer-checked:text-emerald-300 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400`}
      >
        <span className="font-semibold">{team}</span>
        {/* inherits the label's colour so it turns green along with it */}
        <span className="font-mono text-sm tabular-nums opacity-70">
          {spread}
        </span>
      </label>
    </div>
  );
}

function SavedPanel() {
  const button =
    "rounded-md border border-emerald-800/70 bg-emerald-950/40 px-3 py-2.5 text-center text-sm font-medium text-emerald-200 hover:border-emerald-600 hover:text-emerald-100";

  return (
    <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
      <p className="font-semibold text-emerald-300">Picks saved.</p>
      <p className="mt-1 text-sm text-emerald-200/70">
        Sealed until each game kicks off. Nobody can see them until then
        &mdash; including you, on the grid.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link href="/grid" className={button}>
          See the grid
        </Link>
        <Link href="/standings" className={button}>
          Standings
        </Link>
        <Link href="/picks" className={button}>
          Change picks
        </Link>
      </div>
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const tones = {
    good: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
    warn: "border-amber-900 bg-amber-950/30 text-amber-300",
    bad: "border-red-900 bg-red-950/50 text-red-300",
  };
  return (
    <p className={`mb-4 rounded border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="mx-auto max-w-lg">
        <Nav current="picks" />

        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-neutral-500">{subtitle}</p>
            )}
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
          >
            Home
          </Link>
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-neutral-700">
          Every game locks at kickoff. That&rsquo;s the same instant everyone
          else gets to see what you picked.
        </p>
      </div>
    </main>
  );
}
