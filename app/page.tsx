import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { logout } from "./login/actions";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/picks", label: "Make picks", note: "This week's six games", ready: true },
  { href: "/grid", label: "The grid", note: "Everyone's picks, once they open", ready: true },
  { href: "/standings", label: "Standings", note: "Season leaderboard", ready: true },
];

export default async function HomePage() {
  const member = await requireMember();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-lg pt-10">
        <h1 className="text-4xl font-bold tracking-tight mb-1">
          Pick <span className="text-amber-500">Six</span>
        </h1>
        <p className="text-neutral-500 text-sm mb-10">
          2026 season &middot; signed in as {member.name}
        </p>

        <div className="space-y-2 mb-10">
          {LINKS.map((l) =>
            l.ready ? (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded border border-neutral-800 bg-neutral-900/60 p-4 hover:border-neutral-600"
              >
                <span className="font-semibold">{l.label}</span>
                <span className="block text-sm text-neutral-500">{l.note}</span>
              </Link>
            ) : (
              <div
                key={l.href}
                className="rounded border border-neutral-900 bg-neutral-900/30 p-4 opacity-50"
              >
                <span className="font-semibold">{l.label}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-600">
                  building
                </span>
                <span className="block text-sm text-neutral-600">{l.note}</span>
              </div>
            )
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          {member.isAdmin && (
            <>
              <Link
                href="/admin/publish"
                className="text-amber-500 underline underline-offset-4 hover:text-amber-400"
              >
                Publish a week
              </Link>
              <Link
                href="/admin/members"
                className="text-amber-500 underline underline-offset-4 hover:text-amber-400"
              >
                Roster
              </Link>
            </>
          )}
          <form action={logout}>
            <button className="text-neutral-500 underline underline-offset-4 hover:text-neutral-300">
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
