"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { atsWinner, isLocked } from "@/lib/time";
import { isHalfPoint } from "@/lib/espn";
import { sweep } from "@/lib/grade";

const PAGE = "/admin/results";

function back(weekId: string, query: string): never {
  redirect(`${PAGE}?week=${encodeURIComponent(weekId)}&${query}`);
}

type GameRow = {
  id: string;
  home_spread: number;
  kickoff_at: string;
};

export async function saveResults(formData: FormData) {
  await requireAdmin();

  const weekId = String(formData.get("weekId") ?? "");
  if (!weekId) redirect(PAGE);

  const { data: games } = await db()
    .from("games")
    .select("id, home_spread, kickoff_at")
    .eq("week_id", weekId);

  const now = new Date();
  let scored = 0;
  let cleared = 0;
  let spreadsMoved = 0;
  let spreadsRefused = 0;

  for (const game of (games ?? []) as GameRow[]) {
    /* ---------- the spread ---------- */

    let spread = Number(game.home_spread);
    const spreadRaw = String(formData.get(`spread_${game.id}`) ?? "").trim();

    if (spreadRaw) {
      const proposed = Number(spreadRaw);

      if (!Number.isFinite(proposed) || Math.abs(proposed) > 99) {
        back(weekId, "error=spread");
      }
      if (!isHalfPoint(proposed)) {
        back(weekId, "error=halfpoint");
      }

      if (proposed !== spread) {
        // A line can only be corrected before that game kicks off. After
        // that it's the number everyone was graded against, and moving it
        // would silently rewrite results.
        if (isLocked(game.kickoff_at, now)) {
          spreadsRefused += 1;
        } else {
          await db()
            .from("games")
            .update({ home_spread: proposed })
            .eq("id", game.id);
          spread = proposed;
          spreadsMoved += 1;
        }
      }
    }

    /* ---------- the score ---------- */

    const awayRaw = String(formData.get(`away_${game.id}`) ?? "").trim();
    const homeRaw = String(formData.get(`home_${game.id}`) ?? "").trim();

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
        ats_winner: atsWinner(home, away, spread),
        status: "final",
      })
      .eq("id", game.id);

    scored += 1;
  }

  revalidatePath("/standings");
  revalidatePath("/grid");
  revalidatePath("/picks");
  revalidatePath(PAGE);

  const parts = [`${scored} scored`, `${cleared} cleared`];
  if (spreadsMoved) parts.push(`${spreadsMoved} spread(s) changed`);
  if (spreadsRefused)
    parts.push(`${spreadsRefused} spread change refused — already kicked off`);

  back(weekId, `ok=${encodeURIComponent(parts.join(", "))}`);
}

export async function pullResults(formData: FormData) {
  await requireAdmin();
  const weekId = String(formData.get("weekId") ?? "");

  const report = await sweep();

  revalidatePath("/standings");
  revalidatePath("/grid");
  revalidatePath(PAGE);

  const summary =
    `checked ${report.checked}, graded ${report.graded}` +
    (report.moved ? `, ${report.moved} kickoff time(s) updated` : "") +
    (report.errors.length ? ` — ${report.errors.length} problem(s)` : "");

  back(weekId, `ok=${encodeURIComponent(summary)}`);
}
