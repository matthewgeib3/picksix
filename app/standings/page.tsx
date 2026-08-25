import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeMembers } from "@/lib/week";
import { gradeOpenGames } from "@/lib/grade";

export const dynamic = "force-dynamic";

type GradedGame = {
  id: string;
  league: "cfb" | "nfl";
  ats_winner: "home" | "away";
};

type PickRow = {
  member_id: string;
  game_id: string;
  selection: "home" | "away";
};

type Line = {
  id: string;
  name: string;
  points: number;
  losses: number;
  missed: number;
  cfbWins: number;
  cfbTotal: number;
  nflWins: number;
  nflTotal: number;
};

export default async function StandingsPage() {
  const me = await requireMember();

  // Opening the standings is itself a grading trigger. The scheduled job only
  // runs once a day on Vercel's free tier, and this closes the gap: whoever
  // checks the table first on a Sunday evening pulls the finals in for
  // everyone. It costs nothing when there's nothing to grade -- the query
  // that looks for finished-but-ungraded games simply comes back empty.
  await gradeOpenGames(8);

  const members = await activeMembers();

  // Practice weeks are excluded here, which is the only place it matters --
  // they still publish, lock, reveal and grade exactly like a real week.
  const { data: weekRows } = await db()
    .from("weeks")
    .select("id")
    .eq("counts", true);

  const countingWeeks = ((weekRows ?? []) as { id: string }[]).map((w) => w.id);

  const [{ data: gameRows }, { data: pickRows }] = await Promise.all([
    countingWeeks.length
      ? db()
          .from("games")
          .select("id, league, ats_winner")
          .in("week_id", countingWeeks)
          .eq("status", "final")
          .not("ats_winner", "is", null)
      : Promise.resolve({ data: [] as GradedGame[] }),
    db().from("picks").select("member_id, game_id, selection"),
  ]);

  const graded = (gameRows ?? []) as GradedGame[];
  const picks = (pickRows ?? []) as PickRow[];

  const lines: Line[] = members.map((m) => {
    const line: Line = {
      id: m.id,
      name: m.name,
      points: 0,
      losses: 0,
      missed: 0,
      cfbWins: 0,
      cfbTotal: 0,
      nflWins: 0,
      nflTotal: 0,
    };

    const mine = new Map(
      picks.filter((p) => p.member_id === m.id).map((p) => [p.game_id, p.selection])
    );

    for (const game of graded) {
      const pick = mine.get(game.id);

      if (game.league === "cfb") line.cfbTotal += 1;
      else line.nflTotal += 1;

      if (!pick) {
        line.missed += 1;
        continue;
      }

      if (pick === game.ats_winner) {
        line.points += 1;
        if (game.league === "cfb") line.cfbWins += 1;
        else line.nflWins += 1;
      } else {
        line.losses += 1;
      }
    }

    return line;
  });

  lines.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // Shared rank for ties: two people on 14 points are both 2nd.
  const ranks = new Map<string, number>();
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    ranks.set(
      line.id,
      previous && previous.points === line.points
        ? ranks.get(previous.id)!
        : index + 1
    );
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Standings</h1>
            <p className="text-sm text-neutral-500">
              {graded.length} {graded.length === 1 ? "game" : "games"} graded
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
          >
            Back
          </Link>
        </div>

        {graded.length === 0 ? (
          <p className="text-neutral-400">
            Nothing has been graded yet. Standings fill in as games go final.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-neutral-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-900/80 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Player</th>
                    <th className="px-3 py-2 text-right font-semibold">Pts</th>
                    <th className="px-3 py-2 text-right font-semibold">Record</th>
                    <th className="px-3 py-2 text-right font-semibold">CFB</th>
                    <th className="px-3 py-2 text-right font-semibold">NFL</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className={`border-t border-neutral-800 ${
                        line.id === me.id ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3 font-mono tabular-nums text-neutral-500">
                        {ranks.get(line.id)}
                      </td>
                      <td
                        className={`px-3 py-3 font-medium ${
                          line.id === me.id ? "text-amber-400" : ""
                        }`}
                      >
                        {line.name}
                        {line.missed > 0 && (
                          <span className="ml-2 text-xs text-neutral-600">
                            {line.missed} missed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-base font-semibold tabular-nums">
                        {line.points}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-400">
                        {line.points}&ndash;{line.losses}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-500">
                        {line.cfbWins}/{line.cfbTotal}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-500">
                        {line.nflWins}/{line.nflTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-neutral-600">
              One point per correct pick against the spread, cumulative all
              season. A missed pick counts as a loss. If two people finish level
              after the Super Bowl, the Super Bowl spread pick breaks it, then
              closest to the combined total.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
