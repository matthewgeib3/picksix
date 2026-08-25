"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { createSession, destroySession } from "@/lib/session";

/** A bcrypt hash of nonsense, used to keep timing even on unknown usernames. */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) redirect("/login?error=1");

  const { data } = await db()
    .from("members")
    .select("id, password_hash, active")
    .ilike("username", username)
    .maybeSingle();

  // Always run a compare, even when the username doesn't exist, so the
  // response time doesn't reveal which usernames are real.
  const ok = await bcrypt.compare(password, data?.password_hash ?? DUMMY_HASH);

  if (!data || !data.active || !ok) redirect("/login?error=1");

  await createSession(data.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
