import { db, describeEnv, envReady, envStatus, pingRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TABLES = ["members", "weeks", "games", "picks", "tiebreakers"] as const;

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const env = describeEnv();

  const checks: Check[] = [
    {
      label: "SUPABASE_URL",
      ok: envStatus.url && env.valid,
      detail: envStatus.url
        ? env.valid
          ? `host ${env.host}`
          : `not a valid URL: "${env.url}"`
        : "missing",
    },
    {
      label: "SUPABASE_SECRET_KEY",
      ok: envStatus.secret && env.secretPrefix.startsWith("sb_secret"),
      detail: envStatus.secret
        ? `starts "${env.secretPrefix}", ${env.secretLength} chars`
        : "missing",
    },
    {
      label: "SESSION_SECRET",
      ok: envStatus.sessionSecret,
      detail: envStatus.sessionSecret ? "found" : "missing",
    },
  ];

  if (!envReady) {
    checks.push({
      label: "connection",
      ok: false,
      detail: "skipped — fix the env vars first",
    });
    return checks;
  }

  const ping = await pingRest();
  checks.push({
    label: "connection",
    ok: ping.startsWith("HTTP"),
    detail: ping,
  });

  for (const table of TABLES) {
    try {
      const { count, error } = await db()
        .from(table)
        .select("*", { count: "exact", head: true });

      checks.push({
        label: `table: ${table}`,
        ok: !error,
        detail: error ? `${error.message}${error.hint ? ` — ${error.hint}` : ""}` : `ok, ${count ?? 0} rows`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? ` (${err.cause.message})`
          : "";
      checks.push({
        label: `table: ${table}`,
        ok: false,
        detail: `${message}${cause}`,
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
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          Pick Six &middot; Health Check
        </h1>
        <p className="text-neutral-400 mb-8">
          {allGood
            ? "Everything is wired up."
            : "Something below needs fixing."}
        </p>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.label}
              className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-neutral-800 pb-2"
            >
              <span
                className={`shrink-0 w-4 ${c.ok ? "text-emerald-400" : "text-red-400"}`}
              >
                {c.ok ? "✓" : "✗"}
              </span>
              <span className="w-52 shrink-0 text-neutral-300">{c.label}</span>
              <span
                className={`break-all ${c.ok ? "text-neutral-500" : "text-red-300"}`}
              >
                {c.detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-neutral-600">
          No secrets are printed here — only the project host and the first few
          characters of the key, which are enough to spot a paste error.
        </p>
      </div>
    </main>
  );
}
