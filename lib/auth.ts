import { redirect } from "next/navigation";
import { db } from "./supabase";
import { readSession } from "./session";

export type Member = {
  id: string;
  name: string;
  isAdmin: boolean;
};

/**
 * Who is asking, according to the database -- not just the cookie.
 *
 * The cookie says which member id you are; this re-checks that the member
 * still exists and is still active. That means deactivating someone in the
 * admin screen locks them out immediately, instead of whenever their cookie
 * happens to expire.
 */
export async function currentMember(): Promise<Member | null> {
  const session = await readSession();
  if (!session) return null;

  const { data, error } = await db()
    .from("members")
    .select("id, name, is_admin, active")
    .eq("id", session.memberId)
    .maybeSingle();

  if (error || !data || !data.active) return null;

  return { id: data.id, name: data.name, isAdmin: data.is_admin };
}

export async function requireMember(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/login");
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member.isAdmin) redirect("/");
  return member;
}

/** True only while the league has no members at all. Gates /setup. */
export async function leagueIsEmpty(): Promise<boolean> {
  const { count, error } = await db()
    .from("members")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}
