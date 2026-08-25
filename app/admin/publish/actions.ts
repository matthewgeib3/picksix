"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { isHalfPoint, type League } from "@/lib/espn";

const PAGE = "/admin/publish";

function back(error: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(error)}`);
}

type Carried = {
  espnEventId: string;
  league: League;
  homeTeam: string;
  awayTeam: string;
  homeAbbr: string;
  awayAbbr: string;
  kickoffAt: string;
};

export async function publishWeek(formData: FormData) {
  await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  const season = Number(formData.get("season") ?? 2026);

  if (label.length < 2) back("label");
  if (!Number.isInteger(season)) back("season");

  const picked = formData.getAll("pick").map(String);
  if (picked.length === 0) back("empty");
  if (picked.length > 10) back("toomany");

  // Build the rows first so a bad spread aborts before anything is written.
  const rows = picked.map((id) => {
    const carriedRaw = formData.get(`data_${id}`);
    if (!carriedRaw) back("data");

    let carried: Carried;
    try {
      carried = JSON.parse(String(carriedRaw)) as Carried;
    } catch {
      return back("data");
    }

    const spreadRaw = String(formData.get(`spread_${id}`) ?? "").trim();
    const spread = Number(spreadRaw);

    if (!spreadRaw || !Number.isFinite(spread)) back("spread");
    if (!isHalfPoint(spread)) back("halfpoint");
    if (Math.abs(spread) > 99) back("spread");

    return {
      league: carried.league,
      espn_event_id: carried.espnEventId,
      home_team: carried.homeTeam,
      away_team: carried.awayTeam,
      home_abbr: carried.homeAbbr,
      away_abbr: carried.awayAbbr,
      home_spread: spread,
      kickoff_at: carried.kickoffAt,
      status: "scheduled" as const,
    };
  });

  // Next slot in the season's ordering.
  const { data: last } = await db()
    .from("weeks")
    .select("sort_order")
    .eq("season", season)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (last?.sort_order ?? 0) + 1;

  const asInt = (key: string): number | null => {
    const value = Number(formData.get(key));
    return Number.isInteger(value) && value > 0 ? value : null;
  };

  const { data: week, error: weekError } = await db()
    .from("weeks")
    .insert({
      season,
      label,
      sort_order: sortOrder,
      status: "live",
      published_at: new Date().toISOString(),
      // Remembered only so next Tuesday's screen can default to week N+1.
      cfb_week: asInt("cfbWeek"),
      cfb_type: asInt("cfbType"),
      nfl_week: asInt("nflWeek"),
      nfl_type: asInt("nflType"),
    })
    .select("id")
    .single();

  if (weekError?.code === "23505") back("duplicate");
  if (weekError || !week) back("db");

  const { error: gamesError } = await db()
    .from("games")
    .insert(rows.map((r) => ({ ...r, week_id: week.id })));

  if (gamesError) {
    // Don't leave an empty week behind if the games failed to land.
    await db().from("weeks").delete().eq("id", week.id);
    back("games");
  }

  revalidatePath("/");
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=${encodeURIComponent(label)}`);
}

export async function setCounts(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const counts = formData.get("counts") === "true";
  if (!id) back("db");

  const { error } = await db().from("weeks").update({ counts }).eq("id", id);
  if (error) back("db");

  revalidatePath(PAGE);
  revalidatePath("/standings");
  redirect(`${PAGE}?ok=${counts ? "counting" : "practice"}`);
}

export async function unpublishWeek(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) back("db");

  const { data: week } = await db()
    .from("weeks")
    .select("id, counts")
    .eq("id", id)
    .maybeSingle();

  if (!week) back("db");

  // A practice week is disposable by design -- that's the whole point of
  // rehearsing. A counting week is not: deleting it would take real picks
  // down with it, so it stays locked once anyone has submitted.
  if (week.counts) {
    const { data: games } = await db()
      .from("games")
      .select("id")
      .eq("week_id", id);

    const gameIds = ((games ?? []) as { id: string }[]).map((g) => g.id);

    if (gameIds.length > 0) {
      const { count } = await db()
        .from("picks")
        .select("id", { count: "exact", head: true })
        .in("game_id", gameIds);

      if ((count ?? 0) > 0) back("haspicks");
    }
  }

  // Games cascade from the week, and picks cascade from the games, so this
  // one delete takes the whole thing with it.
  const { error } = await db().from("weeks").delete().eq("id", id);
  if (error) back("db");

  revalidatePath(PAGE);
  revalidatePath("/standings");
  redirect(`${PAGE}?ok=removed`);
}
