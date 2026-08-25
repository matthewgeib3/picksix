import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client.
 *
 * This uses the SECRET key, which bypasses row-level security and can read
 * and write anything. It must never be imported into a file that runs in the
 * browser -- every file that touches it is a server component, a server
 * action, or a route handler.
 */

const url = process.env.SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

export const envStatus = {
  url: Boolean(url),
  secret: Boolean(secret),
  sessionSecret: Boolean(process.env.SESSION_SECRET),
};

export const envReady = envStatus.url && envStatus.secret;

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
