import { CollabError, joinTrip } from "@/lib/collab";
import { instrument } from "@/lib/metrics";

// POST { inviteId, jwt } — the jwt (from account.createJWT) proves who is joining.
async function handle(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the invite ID and a session token." }, { status: 400 });
  }
  try {
    const tripId = await joinTrip(body?.inviteId, body?.jwt);
    return Response.json({ tripId });
  } catch (error) {
    if (error instanceof CollabError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Couldn’t join trip", error?.message || error);
    return Response.json({ error: "Couldn’t join the trip. Try again in a moment." }, { status: 500 });
  }
}

export const POST = instrument("trips_join", handle);
