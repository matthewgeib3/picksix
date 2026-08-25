"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireMember } from "@/lib/auth";

export async function renameSelf(formData: FormData) {
  const me = await requireMember();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2 || name.length > 24) redirect("/profile?error=name");

  const { error } = await db()
    .from("members")
    .update({ name })
    .eq("id", me.id);

  if (error?.code === "23505") redirect("/profile?error=taken");
  if (error) redirect("/profile?error=db");

  revalidatePath("/profile");
  revalidatePath("/grid");
  revalidatePath("/standings");
  redirect("/profile?ok=1");
}
