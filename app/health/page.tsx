import { db, envReady, envStatus } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TABLES = ["members", "weeks", "games", "picks", "tiebreakers"] as const;

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [
    {
      label: "SUPABASE_URL",
      ok: envStatus.url,
      detail: envStatus.url ? "found" : "missing from .env.local",
    },
    {
      label: "SUPABASE_SECRET_KEY",
      ok: envStatus.secret,
      detail: envStatus.secret ? "found" : "missing from .env.local",
    },
    {
      label: "SESSION_SECRET",
      ok: envStatus.sessionSecret,
      detail: envStatus.sessionSecret ? "found" : "missing from .env.local",
    },
  ];

  if (!envReady) {
    checks.push({
      label: "database",
      ok: false,
      detail: "skipped -- fix the env file first, then restart the dev server",
    });
    return checks;
  }

  for (const table of TABLES) {
    try {
      const { count, error } = await db()
        .from(table)
        .select("*", { count: "exact", head: true });

      checks.push({
        label: `table: ${table}`,
        ok: !error,
        detail: error ? error.message : `ok, ${count ?? 0} rows`,
      });
    } catch (err) {
      checks.push({
        label: `table: ${table}`,
        ok: false,
        detail: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return checks;
}

export default async function HealthPage() {
  const checks = await runChecks();
  const allGood = checks.every((c) => c.ok);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-mono text-sm">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          Pick Six &middot; health check
        </h1>
        <p className="text-neutral-400 mb-8">
          {allGood
            ? "Everything is wired up. You can delete this page later."
            : "Something below needs fixing."}
        </p>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.label}
              className="flex items-start gap-3 border-b border-neutral-800 pb-2"
            >
              <span
                className={
                  c.ok
                    ? "text-emerald-400 shrink-0 w-4"
                    : "text-red-400 shrink-0 w-4"
                }
              >
                {c.ok ? "✓" : "✗"}
              </span>
              <span className="w-52 shrink-0 text-neutral-300">{c.label}</span>
              <span className={c.ok ? "text-neutral-500" : "text-red-300"}>
                {c.detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-neutral-600">
          Env vars are only read when the dev server starts. After editing
          .env.local, stop it with Ctrl+C and run npm run dev again.
        </p>
      </div>
    </main>
  );
}
