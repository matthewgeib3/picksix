"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { leagueIsEmpty } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function createFirstAdmin(formData: FormData) {
  // Re-checked on the server: the page hides this form once a member exists,
  // but the form itself could be submitted directly, so the rule lives here.
  if (!(await leagueIsEmpty())) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) redirect("/setup?error=name");
  if (!/^[a-z0-9_]{3,}$/.test(username)) redirect("/setup?error=username");
  if (password.length < 8) redirect("/setup?error=password");

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await db()
    .from("members")
    .insert({
      name,
      username,
      password_hash: passwordHash,
      is_admin: true,
      active: true,
    })
    .select("id")
    .single();

  if (error?.code === "23505") redirect("/setup?error=taken");
  if (error || !data) redirect("/setup?error=db");

  await createSession(data.id);
  redirect("/admin/members");
}
