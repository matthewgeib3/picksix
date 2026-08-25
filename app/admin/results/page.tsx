import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";
import {
  allWeeks,
  currentWeek,
  gamesForWeek,
  picksForGames,
  weekById,
} from "@/lib/week";
import { kickoffLabel, isLocked } from "@/lib/time";
import { saveResults, pullResults } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const week = params.week ? await weekById(params.week) : await currentWeek();
  const weeks = await allWeeks();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="results" />

        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <div className="flex items-center gap-4">
            {weeks.length > 0 && (
              <form method="get">
                <select
                  name="week"
                  defaultValue={week?.id ?? ""}
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
          </div>
        </div>

        {params.error === "score" && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            Scores have to be whole numbers, and both sides need filling in.
            Leave both blank to clear a game.
          </p>
        )}
        {params.error === "halfpoint" && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            Every spread has to land on a half point, like &minus;6.5. Nothing
            was saved.
          </p>
        )}
        {params.error === "spread" && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            One of those spreads isn&rsquo;t a sensible number. Nothing was
            saved.
          </p>
        )}
        {params.ok && (
          <p className="mb-6 rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {params.ok}
          </p>
        )}

        {!week ? (
          <p className="text-neutral-400">No weeks published yet.</p>
        ) : (
          <Week weekId={week.id} label={week.label} />
        )}
      </div>
    </main>
  );
}

async function Week({ weekId, label }: { weekId: string; label: string }) {
  const games = await gamesForWeek(weekId);
  const picks = await picksForGames(games.map((g) => g.id));
  const now = new Date();

  const pickCount = (gameId: string) =>
    picks.filter((p) => p.gameId === gameId).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        <form action={pullResults}>
          <input type="hidden" name="weekId" value={weekId} />
          <button className="rounded border border-neutral-600 px-3 py-1.5 text-sm hover:border-neutral-400">
            Pull scores from ESPN
          </button>
        </form>
      </div>

      <form action={saveResults}>
        <input type="hidden" name="weekId" value={weekId} />

        <div className="divide-y divide-neutral-900 rounded border border-neutral-800">
          {games.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <span className="w-40 shrink-0 font-medium">
                {g.awayAbbr} <span className="text-neutral-600">@</span>{" "}
                {g.homeAbbr}
              </span>

              <span className="flex w-32 shrink-0 items-center gap-1.5">
                <input
                  name={`spread_${g.id}`}
                  defaultValue={g.homeSpread}
                  disabled={isLocked(g.kickoffAt, now)}
                  className="w-20 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-center font-mono text-sm tabular-nums outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                />
                {!isLocked(g.kickoffAt, now) && pickCount(g.id) > 0 && (
                  <span
                    title={`${pickCount(g.id)} picks already submitted`}
                    className="text-[10px] text-amber-600"
                  >
                    {pickCount(g.id)}&nbsp;in
                  </span>
                )}
              </span>

              <span className="w-36 shrink-0 text-xs tabular-nums text-neutral-600">
                {kickoffLabel(g.kickoffAt)}
              </span>

              <span className="flex items-center gap-2">
                <input
                  name={`away_${g.id}`}
                  defaultValue={g.awayScore ?? ""}
                  inputMode="numeric"
                  placeholder={g.awayAbbr}
                  className="w-16 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-center font-mono tabular-nums outline-none focus:border-amber-500 placeholder:text-neutral-700"
                />
                <span className="text-neutral-700">&ndash;</span>
                <input
                  name={`home_${g.id}`}
                  defaultValue={g.homeScore ?? ""}
                  inputMode="numeric"
                  placeholder={g.homeAbbr}
                  className="w-16 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-center font-mono tabular-nums outline-none focus:border-amber-500 placeholder:text-neutral-700"
                />
              </span>

              <span className="text-xs uppercase tracking-wider">
                {g.atsWinner ? (
                  <span className="text-emerald-400">
                    {g.atsWinner === "home" ? g.homeAbbr : g.awayAbbr} covered
                  </span>
                ) : (
                  <span className="text-neutral-600">{g.status}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <button className="mt-4 rounded bg-amber-500 px-4 py-2 font-semibold text-neutral-950 hover:bg-amber-400">
          Save scores
        </button>
        <p className="mt-3 text-xs text-neutral-600">
          Away score on the left, home on the right. Clear both boxes to put a
          game back to ungraded.
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          The spread box is editable until that game kicks off, for when the
          feed hands you a bad number. An amber count beside it means people
          have already picked against the current line &mdash; tell them if you
          move it. After kickoff the box locks: that number is what everyone
          was graded against, and changing it would silently rewrite results.
        </p>
      </form>
    </>
  );
}
