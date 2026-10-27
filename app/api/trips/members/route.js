import { CollabError, listTripMembers } from "@/lib/collab";
import { instrument } from "@/lib/metrics";

// POST { teamId, jwt } — who's on a trip, for someone on it (the jwt proves who's asking).
async function handle(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the trip’s team ID and a session token." }, { status: 400 });
  }
  try {
    return Response.json({ members: await listTripMembers(body?.teamId, body?.jwt) });
  } catch (error) {
    if (error instanceof CollabError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Couldn’t list trip members", error?.message || error);
    return Response.json({ error: "Couldn’t load who’s on this trip." }, { status: 500 });
  }
}

export const POST = instrument("trips_members", handle);
