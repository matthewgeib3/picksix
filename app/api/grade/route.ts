import { NextResponse } from "next/server";
import { sweep } from "@/lib/grade";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Grading endpoint, called by the scheduler.
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" on cron requests when
 * that env var is set. If it isn't set the route is open, which is fine --
 * the worst a stranger can do is make us re-read scores from ESPN.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const report = await sweep();
  return NextResponse.json(report);
}
