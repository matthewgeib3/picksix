import Link from "next/link";
import { requireMember } from "@/lib/auth";
import {
  activeMembers,
  allWeeks,
  currentWeek,
  gamesForWeek,
  picksForGames,
  weekById,
  type Game,
} from "@/lib/week";
import { isRevealed, revealAt, timeLabel, kickoffLabel } from "@/lib/time";
import { gradeOnView } from "@/lib/grade";
import AutoRefresh from "@/components/auto-refresh";
import Nav from "@/components/nav";

export const dynamic = "force-dynamic";

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

type Cell =
  | { state: "hidden" }
  | { state: "none" }
  | { state: "shown"; label: string; result: "win" | "loss" | "pending" };

export default async function GridPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const me = await requireMember();
  const { week: weekParam } = await searchParams;

  // Same grading trigger as the standings, throttled the same way. People
  // watch the grid on Sunday afternoons, so this is where finals usually
  // land first.
  await gradeOnView(8);

  const week = weekParam ? await weekById(weekParam) : await currentWeek();
  const weeks = await allWeeks();

  if (!week) {
    return (
      <Shell weeks={weeks} selected={null}>
        <p className="text-neutral-400">
          Nothing published yet. Once the commissioner posts a slate, this is
          where everyone&rsquo;s picks show up.
        </p>
      </Shell>
    );
  }

  const games = await gamesForWeek(week.id);
  const members = await activeMembers();
  const allPicks = await picksForGames(games.map((g) => g.id));
  const now = new Date();

  // The reveal rule, applied before anything reaches the page: a pick that
  // isn't yours and isn't past its reveal time simply doesn't get looked up.
  const visible = new Map<string, "home" | "away">();
  for (const p of allPicks) {
    const game = games.find((g) => g.id === p.gameId);
    if (!game) continue;
    if (p.memberId === me.id || isRevealed(game.kickoffAt, now)) {
      visible.set(`${p.memberId}:${p.gameId}`, p.selection);
    }
  }

  function cellFor(memberId: string, game: Game): Cell {
    const open = isRevealed(game.kickoffAt, now);
    const pick = visible.get(`${memberId}:${game.id}`);

    if (!open && memberId !== me.id) return { state: "hidden" };
    if (!pick) return { state: "none" };

    const label = pick === "home" ? game.homeAbbr : game.awayAbbr;
    const result: "win" | "loss" | "pending" =
      game.status === "final" && game.atsWinner
        ? game.atsWinner === pick
          ? "win"
          : "loss"
        : "pending";

    return { state: "shown", label, result };
  }

  function scoreFor(memberId: string): number {
    return games.filter((g) => {
      if (g.status !== "final" || !g.atsWinner) return false;
      const pick = allPicks.find(
        (p) => p.memberId === memberId && p.gameId === g.id
      );
      return pick?.selection === g.atsWinner;
    }).length;
  }

  const gradedCount = games.filter(
    (g) => g.status === "final" && g.atsWinner
  ).length;
  const hiddenCount = games.filter((g) => !isRevealed(g.kickoffAt, now)).length;

  return (
    <Shell weeks={weeks} selected={week.id} title={week.label}>
      {hiddenCount > 0 && (
        <p className="mb-4 rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-400">
          {hiddenCount} {hiddenCount === 1 ? "game is" : "games are"} still
          sealed. Each column opens the moment that game kicks off.
        </p>
      )}

      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-900/80">
              <th className="sticky left-0 z-10 bg-neutral-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Player
              </th>
              {games.map((g) => (
                <th
                  key={g.id}
                  className="min-w-[6.5rem] border-l border-neutral-800 px-2 py-2 text-center font-normal"
                >
                  <div className="text-xs font-semibold text-neutral-300">
                    {g.awayAbbr}
                    <span className="text-neutral-600"> @ </span>
                    {g.homeAbbr}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] tabular-nums text-neutral-500">
                    {g.homeAbbr} {signed(g.homeSpread)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-600">
                    {isRevealed(g.kickoffAt, now)
                      ? kickoffLabel(g.kickoffAt).replace(/,/g, "")
                      : `opens ${timeLabel(revealAt(g.kickoffAt).toISOString())}`}
                    {/* revealAt tracks REVEAL_MINUTES, so this line stays
                        correct if the lock ever moves off kickoff again */}
                  </div>
                </th>
              ))}
              <th className="border-l border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Pts
              </th>
            </tr>
          </thead>

          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-neutral-800">
                <td
                  className={`sticky left-0 z-10 bg-neutral-950 px-3 py-2.5 font-medium whitespace-nowrap ${
                    m.id === me.id ? "text-amber-400" : "text-neutral-200"
                  }`}
                >
                  {m.name}
                </td>

                {games.map((g) => {
                  const cell = cellFor(m.id, g);
                  return (
                    <td
                      key={g.id}
                      className="border-l border-neutral-800 px-2 py-2.5 text-center"
                    >
                      {cell.state === "hidden" && (
                        <span className="text-neutral-700">&middot;&middot;&middot;</span>
                      )}
                      {cell.state === "none" && (
                        <span className="text-xs text-neutral-700">&mdash;</span>
                      )}
                      {cell.state === "shown" && (
                        <span
                          className={
                            cell.result === "win"
                              ? "rounded bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300"
                              : cell.result === "loss"
                                ? "rounded bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 line-through"
                                : "rounded bg-neutral-800 px-2 py-1 text-xs font-semibold text-neutral-200"
                          }
                        >
                          {cell.label}
                        </span>
                      )}
                    </td>
                  );
                })}

                <td className="border-l border-neutral-800 px-3 py-2.5 text-center font-mono tabular-nums text-neutral-300">
                  {gradedCount > 0 ? scoreFor(m.id) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        A cell showing three dots hasn&rsquo;t opened yet &mdash; and the pick
        behind it isn&rsquo;t loaded into this page at all, so there&rsquo;s
        nothing to dig out of the source. Your own row is always visible to you.
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function Shell({
  weeks,
  selected,
  title,
  children,
}: {
  weeks: { id: string; label: string }[];
  selected: string | null;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="mx-auto max-w-5xl">
        <AutoRefresh />
        <Nav current="grid" />

        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">The grid</h1>
            {title && <p className="text-sm text-neutral-500">{title}</p>}
          </div>
          <div className="flex items-center gap-4">
            {weeks.length > 1 && (
              <form method="get">
                <select
                  name="week"
                  defaultValue={selected ?? ""}
                  className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm outline-none focus:border-amber-500"
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <button className="ml-2 rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500">
                  Go
                </button>
              </form>
            )}
            <Link
              href="/"
              className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
            >
              Home
            </Link>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
