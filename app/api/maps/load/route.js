// The trip map asks here before it creates a Google map, since each one is a
// billable Dynamic Maps load; once this month's free allowance is used up the
// answer is no and the map stays hidden (lib/googleQuota.js).
import { claimFreeQuota } from "@/lib/googleQuota";
import { instrument } from "@/lib/metrics";

async function handle() {
  return Response.json({ allowed: await claimFreeQuota("maps_load") }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = instrument("maps_load", handle);
