import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { fetchSlate, type SlateGame } from "@/lib/espn";
import { kickoffLabel, spreadLabel } from "@/lib/time";
import { publishWeek, unpublishWeek, setCounts } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  label: "Give the week a name.",
  empty: "Tick at least one game before publishing.",
  toomany: "That's more than ten games — something's off.",
  spread: "One of the spreads isn't a number.",
  halfpoint: "Every spread has to land on a half point, like -6.5.",
  duplicate: "A week with that name already exists this season.",
  haspicks:
    "People have already picked in that week. Flip it to practice first if you really mean to delete it and their picks.",
  data: "Something got mangled in the form. Reload and try again.",
  db: "The database rejected that. Check /health.",
  games: "The week saved but the games didn't. Nothing was kept.",
};

type Params = {
  season?: string;
  cfbType?: string;
  cfbWeek?: string;
  nflType?: string;
  nflWeek?: string;
  error?: string;
  ok?: string;
};

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function safeSlate(
  league: "cfb" | "nfl",
  query: { year: number; seasonType: number; week: number }
): Promise<{ games: SlateGame[]; error: string | null }> {
  try {
    return { games: await fetchSlate(league, query), error: null };
  } catch (err) {
    return {
      games: [],
      error: err instanceof Error ? err.message : "ESPN request failed",
    };
  }
}

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const season = num(params.season, 2026);
  const cfbType = num(params.cfbType, 2);
  const cfbWeek = num(params.cfbWeek, 1);
  const nflType = num(params.nflType, 2);
  const nflWeek = num(params.nflWeek, 1);

  const [cfb, nfl, weeksResult] = await Promise.all([
    safeSlate("cfb", { year: season, seasonType: cfbType, week: cfbWeek }),
    safeSlate("nfl", { year: season, seasonType: nflType, week: nflWeek }),
    db()
      .from("weeks")
      .select("id, label, status, published_at, sort_order, counts")
      .eq("season", season)
      .order("sort_order", { ascending: false }),
  ]);

  const weeks = weeksResult.data ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-500 font-semibold mb-2">
              Commissioner
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Publish a week</h1>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
          >
            Back
          </Link>
        </div>

        {params.error && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {ERRORS[params.error] ?? "Something went wrong."}
          </p>
        )}
        {params.ok && (
          <p className="mb-6 rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {params.ok === "removed"
              ? "Week removed."
              : `Published "${params.ok}". Spreads are frozen as of now.`}
          </p>
        )}

        {/* ---------------- slate selectors ---------------- */}
        <form
          method="get"
          className="mb-8 rounded border border-neutral-800 bg-neutral-900/60 p-4 flex flex-wrap items-end gap-4"
        >
          <Field label="Season">
            <input
              name="season"
              defaultValue={season}
              className="w-20 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500"
            />
          </Field>

          <Field label="College week">
            <div className="flex gap-1">
              <select
                name="cfbType"
                defaultValue={cfbType}
                className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm outline-none focus:border-amber-500"
              >
                <option value="2">Regular</option>
                <option value="3">Post</option>
              </select>
              <input
                name="cfbWeek"
                defaultValue={cfbWeek}
                className="w-14 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500"
              />
            </div>
          </Field>

          <Field label="NFL week">
            <div className="flex gap-1">
              <select
                name="nflType"
                defaultValue={nflType}
                className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm outline-none focus:border-amber-500"
              >
                <option value="2">Regular</option>
                <option value="3">Post</option>
              </select>
              <input
                name="nflWeek"
                defaultValue={nflWeek}
                className="w-14 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-sm outline-none focus:border-amber-500"
              />
            </div>
          </Field>

          <button className="rounded border border-neutral-600 px-3 py-1.5 text-sm hover:border-neutral-400">
            Load slates
          </button>
        </form>

        {/* ---------------- the picker ---------------- */}
        <form action={publishWeek}>
          <input type="hidden" name="season" value={season} />

          <div className="mb-6 flex flex-wrap items-end gap-4 rounded border border-neutral-800 bg-neutral-900/60 p-4">
            <Field label="Week name">
              <input
                name="label"
                required
                placeholder="NFL Week 1"
                className="w-56 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none focus:border-amber-500 placeholder:text-neutral-700"
              />
            </Field>
            <p className="text-sm text-neutral-500 pb-2">
              Tick six games total. Spreads freeze exactly as shown the moment
              you publish.
            </p>
          </div>

          <Slate title="College" league="cfb" result={cfb} />
          <Slate title="NFL" league="nfl" result={nfl} />

          <button className="mt-2 rounded bg-amber-500 px-5 py-2.5 font-semibold text-neutral-950 hover:bg-amber-400">
            Publish week
          </button>
        </form>

        {/* ---------------- already published ---------------- */}
        {weeks.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-bold tracking-tight mb-4">
              Published weeks
            </h2>
            <div className="space-y-2">
              {weeks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/60 px-4 py-3"
                >
                  <div>
                    <span className="font-semibold">{w.label}</span>
                    {!w.counts && (
                      <span className="ml-3 rounded bg-neutral-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Practice
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <form action={setCounts}>
                      <input type="hidden" name="id" value={w.id} />
                      <input
                        type="hidden"
                        name="counts"
                        value={w.counts ? "false" : "true"}
                      />
                      <button className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300">
                        {w.counts ? "Make practice" : "Make it count"}
                      </button>
                    </form>
                    <form action={unpublishWeek}>
                      <input type="hidden" name="id" value={w.id} />
                      <button className="text-sm text-neutral-500 underline underline-offset-4 hover:text-red-400">
                        {w.counts ? "Remove" : "Delete week + picks"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-600">
              Practice weeks can be deleted at any time, picks included. A
              counting week can only be removed while nobody has picked in it
              &mdash; flip it to practice first if you genuinely want it gone.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function Slate({
  title,
  league,
  result,
}: {
  title: string;
  league: "cfb" | "nfl";
  result: { games: SlateGame[]; error: string | null };
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-[0.14em] text-neutral-500 font-semibold mb-3">
        {title} &middot; {result.games.length} games
      </h2>

      {result.error && (
        <p className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          ESPN didn&rsquo;t answer: {result.error}
        </p>
      )}

      <div className="divide-y divide-neutral-900 rounded border border-neutral-800">
        {result.games.map((g) => {
          const carried = JSON.stringify({
            espnEventId: g.espnEventId,
            league,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            homeAbbr: g.homeAbbr,
            awayAbbr: g.awayAbbr,
            kickoffAt: g.kickoffAt,
          });

          const hooked = g.homeSpread !== null;
          const nudged =
            g.rawHomeSpread !== null &&
            g.homeSpread !== null &&
            g.rawHomeSpread !== g.homeSpread;

          const boxId = `pick-${g.espnEventId}`;

          return (
            <div
              key={g.espnEventId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-neutral-900/40"
            >
              <input
                id={boxId}
                type="checkbox"
                name="pick"
                value={g.espnEventId}
                className="accent-amber-500 w-4 h-4 shrink-0 cursor-pointer"
              />
              <input type="hidden" name={`data_${g.espnEventId}`} value={carried} />

              <label
                htmlFor={boxId}
                className="w-44 shrink-0 font-medium cursor-pointer"
              >
                {g.awayAbbr} <span className="text-neutral-600">@</span>{" "}
                {g.homeAbbr}
              </label>

              <span className="w-40 shrink-0 text-sm text-neutral-500 tabular-nums">
                {kickoffLabel(g.kickoffAt)}
              </span>

              <span className="w-28 shrink-0 text-sm text-neutral-400 tabular-nums">
                {hooked
                  ? spreadLabel(g.homeSpread as number, g.homeAbbr, g.awayAbbr)
                  : "no line"}
              </span>

              <input
                name={`spread_${g.espnEventId}`}
                defaultValue={g.homeSpread ?? ""}
                placeholder="-6.5"
                className="w-20 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-sm tabular-nums outline-none focus:border-amber-500 placeholder:text-neutral-700"
              />

              {nudged && (
                <span className="text-[10px] uppercase tracking-wider text-amber-600">
                  hooked from {g.rawHomeSpread}
                </span>
              )}
              {!hooked && g.rawHomeSpread === 0 && (
                <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                  pick&rsquo;em — set it yourself
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-neutral-600">
        The number in the box is what gets frozen. Edit it to override ESPN.
        Signed from the home team&rsquo;s side: −6.5 means home is favored.
      </p>
    </section>
  );
}
