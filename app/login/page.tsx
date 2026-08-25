import { redirect } from "next/navigation";
import { currentMember, leagueIsEmpty } from "@/lib/auth";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentMember()) redirect("/");
  if (await leagueIsEmpty()) redirect("/setup");

  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight mb-1">
          Pick <span className="text-amber-500">Six</span>
        </h1>
        <p className="text-neutral-500 text-sm mb-8">2026 season</p>

        {error && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            That username and password don&rsquo;t match. Try again, or ask the
            commissioner to reset it.
          </p>
        )}

        <form action={login} className="space-y-5">
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
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 font-mono text-neutral-100 outline-none focus:border-amber-500"
            />
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
              required
              autoComplete="current-password"
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-neutral-100 outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-amber-500 px-4 py-2.5 font-semibold text-neutral-950 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
