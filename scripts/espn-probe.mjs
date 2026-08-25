/**
 * Pick Six · ESPN probe
 *
 * Answers three questions before we build anything on top of ESPN:
 *   1. Does the scoreboard endpoint return spreads for upcoming games?
 *   2. What shape is the odds data in?
 *   3. Do finished games come back with final scores we can grade against?
 *
 * Run with:  node scripts/espn-probe.mjs
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football";

const ENDPOINTS = [
  {
    name: "CFB · 2026 week 1",
    url: `${BASE}/college-football/scoreboard?groups=80&dates=2026&seasontype=2&week=1`,
  },
  {
    name: "NFL · 2026 week 1",
    url: `${BASE}/nfl/scoreboard?dates=2026&seasontype=2&week=1`,
  },
  {
    name: "NFL · 2025 week 1 (should be final)",
    url: `${BASE}/nfl/scoreboard?dates=2025&seasontype=2&week=1`,
  },
];

function summarize(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === "home");
  const away = comp.competitors?.find((c) => c.homeAway === "away");
  const odds = comp.odds?.[0];

  return {
    id: event.id,
    matchup: `${away?.team?.abbreviation ?? "?"} @ ${home?.team?.abbreviation ?? "?"}`,
    kickoff: event.date,
    status: comp.status?.type?.name ?? "?",
    score:
      home?.score != null && away?.score != null
        ? `${away.score}-${home.score}`
        : "-",
    spread: odds?.details ?? "NO ODDS",
    total: odds?.overUnder ?? "-",
  };
}

async function probe({ name, url }) {
  console.log("\n" + "=".repeat(64));
  console.log(name);
  console.log("=".repeat(64));

  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "picksix-probe" } });
  } catch (err) {
    console.log("REQUEST FAILED:", err.message);
    return;
  }

  console.log("HTTP", res.status);
  if (!res.ok) return;

  const data = await res.json();
  const events = data.events ?? [];
  console.log("events:", events.length);

  const rows = events.map(summarize).filter(Boolean);
  const withOdds = rows.filter((r) => r.spread !== "NO ODDS").length;
  console.log(`events with a spread: ${withOdds} / ${rows.length}`);

  console.log("\nfirst 5:");
  for (const r of rows.slice(0, 5)) {
    console.log(
      `  ${r.matchup.padEnd(12)} ${r.kickoff}  ${r.status.padEnd(16)} ` +
        `score ${String(r.score).padEnd(7)} spread ${String(r.spread).padEnd(12)} ou ${r.total}`
    );
  }

  // Dump the raw odds object once, so we can see exactly which fields exist.
  const first = events.find((e) => e.competitions?.[0]?.odds?.[0]);
  if (first) {
    console.log("\nraw odds object for", summarize(first).matchup + ":");
    console.log(JSON.stringify(first.competitions[0].odds[0], null, 2).slice(0, 1400));
  } else {
    console.log("\nno odds object found anywhere in this slate");
  }
}

for (const endpoint of ENDPOINTS) {
  await probe(endpoint);
}

console.log("\ndone\n");
