"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const PAGE = "/admin/members";

function back(error?: string, ok?: string) {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (ok) params.set("ok", ok);
  const query = params.toString();
  redirect(query ? `${PAGE}?${query}` : PAGE);
}

export async function addMember(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const isAdmin = formData.get("is_admin") === "on";

  if (name.length < 2) back("name");
  if (!/^[a-z0-9_]{3,}$/.test(username)) back("username");
  if (password.length < 8) back("password");

  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await db().from("members").insert({
    name,
    username,
    password_hash: passwordHash,
    is_admin: isAdmin,
    active: true,
  });

  if (error?.code === "23505") back("taken");
  if (error) back("db");

  revalidatePath(PAGE);
  back(undefined, `added:${name}`);
}

export async function renameMember(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) back("db");
  if (name.length < 2 || name.length > 24) back("name");

  const { error } = await db().from("members").update({ name }).eq("id", id);

  if (error?.code === "23505") back("taken");
  if (error) back("db");

  revalidatePath(PAGE);
  revalidatePath("/grid");
  revalidatePath("/standings");
  back(undefined, "renamed");
}

export async function resetPassword(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!id) back("db");
  if (password.length < 8) back("password");

  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await db()
    .from("members")
    .update({ password_hash: passwordHash })
    .eq("id", id);

  if (error) back("db");

  revalidatePath(PAGE);
  back(undefined, "reset");
}

export async function setActive(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";

  // Don't let an admin lock themselves out of their own league.
  if (id === admin.id && !active) back("self");

  const { error } = await db().from("members").update({ active }).eq("id", id);
  if (error) back("db");

  revalidatePath(PAGE);
  back(undefined, active ? "activated" : "deactivated");
}

export async function setAdmin(formData: FormData) {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isAdmin = formData.get("is_admin") === "true";

  if (id === admin.id && !isAdmin) back("self");

  const { error } = await db()
    .from("members")
    .update({ is_admin: isAdmin })
    .eq("id", id);
  if (error) back("db");

  revalidatePath(PAGE);
  back(undefined, "role");
}
