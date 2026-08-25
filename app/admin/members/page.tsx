import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";
import Avatar from "@/components/avatar";
import AvatarUpload from "@/components/avatar-upload";
import { db } from "@/lib/supabase";
import {
  addMember,
  renameMember,
  resetPassword,
  setActive,
  setAdmin,
} from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Display names need to be between two and twenty-four characters.",
  renamed: "Renamed.",
  username: "Username needs three or more characters — lowercase letters, numbers and underscores only.",
  password: "Password needs at least eight characters.",
  taken: "That username is already in use.",
  self: "You can't remove your own access.",
  db: "The database rejected that. Check /health.",
};

type Row = {
  id: string;
  name: string;
  username: string;
  is_admin: boolean;
  active: boolean;
  avatar_url: string | null;
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const admin = await requireAdmin();
  const { error, ok } = await searchParams;

  const { data } = await db()
    .from("members")
    .select("id, name, username, is_admin, active, avatar_url")
    .order("created_at", { ascending: true });

  const members = (data ?? []) as Row[];
  const activeCount = members.filter((m) => m.active).length;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto max-w-3xl">
        <AdminNav current="roster" />
        <h1 className="mb-8 text-3xl font-bold tracking-tight">Roster</h1>

        {error && (
          <p className="mb-6 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {ERRORS[error] ?? "Something went wrong."}
          </p>
        )}
        {ok && (
          <p className="mb-6 rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            Saved.
          </p>
        )}

        {/* ---------------- roster ---------------- */}
        <p className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
          {activeCount} active {activeCount === 1 ? "member" : "members"}
        </p>

        <div className="space-y-2 mb-12">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded border border-neutral-800 bg-neutral-900/60 p-4"
            >
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={m.name} url={m.avatar_url} size={44} />

                <div className="min-w-0 flex-1">
                  <form
                    action={renameMember}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      name="name"
                      defaultValue={m.name}
                      required
                      minLength={2}
                      maxLength={24}
                      className="w-40 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-semibold outline-none focus:border-amber-500"
                    />
                    <button className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100">
                      Rename
                    </button>

                    <span className="font-mono text-sm text-neutral-500">
                      @{m.username}
                    </span>
                    {m.is_admin && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                        Admin
                      </span>
                    )}
                    {!m.active && (
                      <span className="rounded bg-neutral-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Inactive
                      </span>
                    )}
                  </form>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AvatarUpload
                  memberId={m.id}
                  label={m.avatar_url ? "Change photo" : "Add photo"}
                />
                <form action={resetPassword} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    name="password"
                    type="text"
                    minLength={8}
                    required
                    placeholder="new password"
                    autoComplete="off"
                    className="w-44 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm outline-none focus:border-amber-500 placeholder:text-neutral-700"
                  />
                  <button className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100">
                    Set password
                  </button>
                </form>

                <form action={setAdmin}>
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="is_admin"
                    value={m.is_admin ? "false" : "true"}
                  />
                  <button className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100">
                    {m.is_admin ? "Remove admin" : "Make admin"}
                  </button>
                </form>

                <form action={setActive}>
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={m.active ? "false" : "true"}
                  />
                  <button className="rounded border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100">
                    {m.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        {/* ---------------- add ---------------- */}
        <h2 className="text-xl font-bold tracking-tight mb-1">Add a Member</h2>
        <p className="text-sm text-neutral-500 mb-5">
          You&rsquo;re setting their password, so send it to them yourself.
          Passwords are stored hashed — you can replace one, but never read it
          back.
        </p>

        <form
          action={addMember}
          className="rounded border border-neutral-800 bg-neutral-900/60 p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="new-name"
                className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
              >
                Display name
              </label>
              <input
                id="new-name"
                name="name"
                required
                autoComplete="off"
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label
                htmlFor="new-username"
                className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
              >
                Username
              </label>
              <input
                id="new-username"
                name="username"
                required
                autoCapitalize="none"
                autoComplete="off"
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs uppercase tracking-wider text-neutral-500 mb-2"
              >
                Password
              </label>
              <input
                id="new-password"
                name="password"
                type="text"
                minLength={8}
                required
                autoComplete="off"
                className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                name="is_admin"
                className="accent-amber-500"
              />
              Make them a commissioner too
            </label>
            <button className="rounded bg-amber-500 px-4 py-2 font-semibold text-neutral-950 hover:bg-amber-400">
              Add member
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs text-neutral-600">
          Signed in as {admin.name}.
        </p>
      </div>
    </main>
  );
}
