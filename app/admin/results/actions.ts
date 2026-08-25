"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { atsWinner } from "@/lib/time";
import { gradeOpenGames } from "@/lib/grade";

const PAGE = "/admin/results";

function back(weekId: string, query: string): never {
  redirect(`${PAGE}?week=${encodeURIComponent(weekId)}&${query}`);
}

export async function saveResults(formData: FormData) {
  await requireAdmin();

  const weekId = String(formData.get("weekId") ?? "");
  if (!weekId) redirect(PAGE);

  const { data: games } = await db()
    .from("games")
    .select("id, home_spread")
    .eq("week_id", weekId);

  let saved = 0;
  let cleared = 0;

  for (const game of (games ?? []) as { id: string; home_spread: number }[]) {
    const awayRaw = String(formData.get(`away_${game.id}`) ?? "").trim();
    const homeRaw = String(formData.get(`home_${game.id}`) ?? "").trim();

    // Both blank: wipe the result and put the game back to ungraded.
    if (!awayRaw && !homeRaw) {
      await db()
        .from("games")
        .update({
          home_score: null,
          away_score: null,
          ats_winner: null,
          status: "scheduled",
        })
        .eq("id", game.id);
      cleared += 1;
      continue;
    }

    const away = Number(awayRaw);
    const home = Number(homeRaw);

    if (!Number.isInteger(away) || !Number.isInteger(home) || away < 0 || home < 0) {
      back(weekId, "error=score");
    }

    await db()
      .from("games")
      .update({
        home_score: home,
        away_score: away,
        ats_winner: atsWinner(home, away, Number(game.home_spread)),
        status: "final",
      })
      .eq("id", game.id);

    saved += 1;
  }

  revalidatePath("/standings");
  revalidatePath("/grid");
  revalidatePath(PAGE);
  back(weekId, `ok=${saved} scored, ${cleared} cleared`);
}

export async function pullResults(formData: FormData) {
  await requireAdmin();
  const weekId = String(formData.get("weekId") ?? "");

  const report = await gradeOpenGames();

  revalidatePath("/standings");
  revalidatePath("/grid");
  revalidatePath(PAGE);

  const summary =
    `checked ${report.checked}, graded ${report.graded}` +
    (report.errors.length ? ` — ${report.errors.length} problem(s)` : "");

  back(weekId, `ok=${encodeURIComponent(summary)}`);
}
