import { redirect } from "next/navigation";
import { leagueIsEmpty } from "@/lib/auth";
import { createFirstAdmin } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Display name needs at least two characters.",
  username: "Username needs at least three characters, letters and numbers only.",
  password: "Password needs at least eight characters.",
  taken: "That username is already in use.",
  db: "Couldn't save that. Check /health and try again.",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await leagueIsEmpty())) redirect("/login");

  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Something went wrong." : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-amber-500 font-semibold mb-3">
          One-time setup
        </p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Create the commissioner
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed mb-8">
          The league has no members yet. This creates the first account and
          makes it an admin. Once it exists, this page turns itself off for
          good.
        </p>

        {message && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {message}
          </p>
        )}

        <form action={createFirstAdmin} className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
            >
              Display name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="off"
              placeholder="Matt"
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-amber-500"
            />
            <p className="mt-2 text-xs text-neutral-600">
              What everyone sees on the leaderboard.
            </p>
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="off"
              placeholder="matt"
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 font-mono text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-amber-500"
            />
            <p className="mt-2 text-xs text-neutral-600">
              What you type to log in. Not case sensitive.
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-neutral-100 outline-none focus:border-amber-500"
            />
            <p className="mt-2 text-xs text-neutral-600">
              Eight characters or more. Stored hashed, so it can be replaced
              but never read back.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded bg-amber-500 px-4 py-2.5 font-semibold text-neutral-950 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Create account
          </button>
        </form>
      </div>
    </main>
  );
}
