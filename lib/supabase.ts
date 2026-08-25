import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 *
 * This uses the SECRET key, which bypasses row-level security and can read
 * and write anything. It must never be imported into a file that runs in the
 * browser -- every file that touches it is a server component, a server
 * action, or a route handler.
 */

// Trimmed on purpose. Pasting a value into a hosting dashboard very often
// picks up a trailing newline, which turns a valid URL into an unreachable
// one and produces a bare "fetch failed" with no explanation.
const url = (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const secret = (process.env.SUPABASE_SECRET_KEY ?? "").trim();

export const envStatus = {
  url: Boolean(url),
  secret: Boolean(secret),
  sessionSecret: Boolean((process.env.SESSION_SECRET ?? "").trim()),
};

export const envReady = envStatus.url && envStatus.secret;

/** Safe to show in diagnostics -- the project URL is not a secret. */
export function describeEnv() {
  let host = "unparseable";
  let valid = false;
  try {
    host = new URL(url).host;
    valid = true;
  } catch {
    /* leave defaults */
  }
  return {
    url,
    host,
    valid,
    secretPrefix: secret.slice(0, 10),
    secretLength: secret.length,
  };
}

/** Hits the REST root directly, to separate "bad URL" from "bad key". */
export async function pingRest(): Promise<string> {
  if (!envReady) return "env not set";
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    return `HTTP ${res.status}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? ` (${err.cause.message})`
        : "";
    return `${message}${cause}`;
  }
}

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!envReady) {
    throw new Error(
      "Supabase env vars are missing. Check .env.local, then restart the dev server."
    );
  }
  if (!client) {
    client = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
