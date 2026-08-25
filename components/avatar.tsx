/**
 * A member's face, or their initials if they haven't uploaded one.
 *
 * Plain <img> rather than next/image on purpose: these are already 256px
 * squares of about 30KB, so there's nothing left to optimise, and it saves
 * wiring the Supabase host into the image config.
 */

const COLORS = [
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-rose-500/20 text-rose-300",
  "bg-violet-500/20 text-violet-300",
  "bg-lime-500/20 text-lime-300",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable colour per name, so someone's circle doesn't change on reload. */
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export default function Avatar({
  name,
  url,
  size = 32,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const box = { width: size, height: size };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={box}
        className="shrink-0 rounded-full object-cover ring-1 ring-neutral-700"
      />
    );
  }

  return (
    <span
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${colorFor(
        name
      )}`}
    >
      {initials(name)}
    </span>
  );
}
