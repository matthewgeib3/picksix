import Link from "next/link";
import { requireMember } from "@/lib/auth";
import Avatar from "@/components/avatar";
import AvatarUpload from "@/components/avatar-upload";
import { renameSelf } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "Display names need to be between two and twenty-four characters.",
  taken: "Somebody in the league already goes by that.",
  db: "Couldn't save that. Try again.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireMember();
  const { ok, error } = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="mx-auto max-w-md pt-6">
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
          <Link
            href="/"
            className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
          >
            Home
          </Link>
        </div>

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

        {/* ---------------- photo ---------------- */}
        <div className="mb-10 flex items-center gap-4">
          <Avatar name={me.name} url={me.avatarUrl} size={72} />
          <div>
            <AvatarUpload
              memberId={me.id}
              label={me.avatarUrl ? "Change photo" : "Add a photo"}
            />
            <p className="mt-2 text-xs text-neutral-600">
              Cropped to a square and shrunk before it uploads, so a big phone
              photo is fine.
            </p>
          </div>
        </div>

        {/* ---------------- name ---------------- */}
        <form action={renameSelf} className="space-y-3">
          <label
            htmlFor="name"
            className="block text-xs uppercase tracking-wider text-neutral-500"
          >
            Display name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={me.name}
            required
            minLength={2}
            maxLength={24}
            className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2.5 outline-none focus:border-amber-500"
          />
          <p className="text-xs text-neutral-600">
            What everyone sees on the grid and the leaderboard. Your username
            and password don&rsquo;t change &mdash; ask the commissioner for
            those.
          </p>
          <button className="rounded bg-amber-500 px-4 py-2 font-semibold text-neutral-950 hover:bg-amber-400">
            Save name
          </button>
        </form>
      </div>
    </main>
  );
}
