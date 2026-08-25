"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMember } from "@/lib/auth";
import { isLocked } from "@/lib/time";

export async function savePicks(formData: FormData) {
  const member = await requireMember();
  const weekId = String(formData.get("weekId") ?? "");
  if (!weekId) redirect("/picks?error=1");

  const { data: games } = await db()
    .from("games")
    .select("id, kickoff_at")
    .eq("week_id", weekId);

  const now = new Date();
  const rows: { member_id: string; game_id: string; selection: string }[] = [];
  let rejected = 0;

  for (const game of (games ?? []) as { id: string; kickoff_at: string }[]) {
    const selection = String(formData.get(`pick_${game.id}`) ?? "");
    if (selection !== "home" && selection !== "away") continue;

    // The real deadline lives here, not in the interface. A form submitted
    // late -- or replayed from a stale tab -- gets dropped on the floor.
    if (isLocked(game.kickoff_at, now)) {
      rejected += 1;
      continue;
    }

    rows.push({
      member_id: member.id,
      game_id: game.id,
      selection,
    });
  }

  if (rows.length > 0) {
    const { error } = await db()
      .from("picks")
      .upsert(rows, { onConflict: "member_id,game_id" });
    if (error) redirect("/picks?error=1");
  }

  revalidatePath("/picks");
  redirect(rejected > 0 ? "/picks?late=1" : "/picks?saved=1");
}
