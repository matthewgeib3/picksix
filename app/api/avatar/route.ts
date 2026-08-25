import { NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000; // the browser already shrank it; this is a backstop

export async function POST(request: Request) {
  const me = await currentMember();
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  const targetId = String(form.get("memberId") ?? me.id);

  // You may change your own. A commissioner may change anyone's.
  if (targetId !== me.id && !me.isAdmin) {
    return NextResponse.json(
      { error: "That's not your profile." },
      { status: 403 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too big." }, { status: 413 });
  }

  const bytes = await file.arrayBuffer();
  const path = `${targetId}.jpg`;

  const { error: uploadError } = await db()
    .storage.from("avatars")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = db().storage.from("avatars").getPublicUrl(path);

  // The storage path never changes, so without a cache-buster browsers would
  // keep showing the old photo after a replacement.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await db()
    .from("members")
    .update({ avatar_url: url })
    .eq("id", targetId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url });
}
