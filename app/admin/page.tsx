import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  activeMembers,
  currentWeek,
  gamesForWeek,
  picksForGames,
} from "@/lib/week";
import { kickoffLabel, isLocked } from "@/lib/time";
import AdminNav from "@/components/admin-nav";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/admin/publish",
    title: "Publish a Week",
    body: "Pull both slates, tick six games, freeze the spreads. Also where a week gets flipped to practice or deleted.",
    when: "Every Tuesday",
  },
  {
    href: "/admin/results",
    title: "Enter Results",
    body: "Pull final scores on demand, or type one in by hand when the feed gets it wrong. Saving recomputes who covered.",
    when: "As needed",
  },
  {
    href: "/admin/members",
    title: "Manage the Roster",
    body: "Add players, set and reset passwords, hand out or revoke commissioner rights, deactivate someone.",
    when: "Rarely",
  },
];

export default async function AdminHome() {
  const admin = await requireAdmin();

  const week = await currentWeek();
  const members = await activeMembers();
  const games = week ? await gamesForWeek(week.id) : [];
  const picks = await picksForGames(games.map((g) => g.id));

  const now = new Date();
  const openGames = games.filter((g) => !isLocked(g.kickoffAt, now));

  // Who's behind. Counts only -- never what anyone actually picked.
  const submitted = members.map((m) => ({
    name: m.name,
    count: picks.filter((p) => p.memberId === m.id).length,
  }));
  const complete = submitted.filter((s) => s.count >= games.length).length;
  const behind = submitted.filter((s) => s.count < games.length);

  const { count: ungraded } = await db()
    .from("games")
    .select("id", { count: "exact", head: true })
    .neq("status", "final")
    .lt("kickoff_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  const nextKickoff = openGames[0];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="overview" />

        <h1 className="mb-6 text-2xl font-bold tracking-tight">
          {week ? week.label : "Nothing Published"}
        </h1>

        {/* ---------------- status ---------------- */}
        <div className="mb-8 grid gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800 sm:grid-cols-3">
          <Stat
            value={week ? `${complete}/${members.length}` : "—"}
            label="Players all in"
          />
          <Stat
            value={week ? String(openGames.length) : "—"}
            label="Games still open"
          />
          <Stat
            value={String(ungraded ?? 0)}
            label="Awaiting a result"
            warn={(ungraded ?? 0) > 0}
          />
        </div>

        {week && behind.length > 0 && (
          <div className="mb-8 rounded-lg border border-amber-900 bg-amber-950/25 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-300">
              Still Owe Picks
            </p>
            <ul className="space-y-1 text-sm text-amber-200/80">
              {behind.map((s) => (
                <li key={s.name}>
                  {s.name}{" "}
                  <span className="font-mono text-xs text-amber-200/50">
                    {s.count}/{games.length}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-amber-200/50">
              Counts only. Nothing on this page shows what anyone picked.
            </p>
          </div>
        )}

        {nextKickoff && (
          <p className="mb-8 text-sm text-neutral-500">
            Next lock:{" "}
            <span className="text-neutral-300">
              {nextKickoff.awayAbbr} at {nextKickoff.homeAbbr}
            </span>
            , {kickoffLabel(nextKickoff.kickoffAt)}
          </p>
        )}

        {(ungraded ?? 0) > 0 && (
          <p className="mb-8 text-sm text-neutral-400">
            {ungraded} {ungraded === 1 ? "game has" : "games have"} finished
            without a result recorded.{" "}
            <Link
              href="/admin/results"
              className="text-amber-500 underline underline-offset-4"
            >
              Pull the scores
            </Link>
            .
          </p>
        )}

        {/* ---------------- the three jobs ---------------- */}
        <div className="space-y-2">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-neutral-600"
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-semibold">{card.title}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
                  {card.when}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-neutral-500">
                {card.body}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-neutral-700">
          Signed in as {admin.name}. Everything here is invisible to anyone
          without commissioner rights.
        </p>
      </div>
    </main>
  );
}

function Stat({
  value,
  label,
  warn,
}: {
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-neutral-950 px-4 py-4">
      <div
        className={`font-mono text-2xl font-semibold tabular-nums ${
          warn ? "text-amber-400" : "text-neutral-100"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
    </div>
  );
}
