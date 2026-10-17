import "server-only";
import { cache } from "react";
import { Account, Client, Query, TablesDB, Teams } from "node-appwrite";
import { APPWRITE } from "./appwrite";
import { fromRow } from "./tripStore";

// Joining a trip means adding someone to its team, which only the trip's
// owner can do from the browser. A join link stands in for the owner: the
// server checks the link and who's signed in, then adds them with a key
// scoped to rows.read, teams.read and teams.write. The same key lists who's on
// a trip, since Appwrite hides other members' details from the browser.
const INVITE_ID = /^[A-Za-z0-9_-]{20,64}$/;
const TEAM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

let services = null;
let warned = false;

function server() {
  const key = process.env.APPWRITE_COLLAB_API_KEY;
  if (!APPWRITE.projectId || !key) {
    if (!warned) console.warn("Trip invites: set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_COLLAB_API_KEY to open join links.");
    warned = true;
    return null;
  }
  if (!services) {
    const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId).setKey(key);
    services = { tables: new TablesDB(client), teams: new Teams(client) };
  }
  return services;
}

export class CollabError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function findInvitedRow(tables, inviteId) {
  const { rows } = await tables.listRows({
    databaseId: APPWRITE.databaseId,
    tableId: APPWRITE.tripsTableId,
    queries: [Query.equal("inviteId", inviteId), Query.limit(1)],
  });
  const row = rows[0];
  return row?.teamId ? row : null;
}

/** What the join page shows, or null when the link is wrong or was turned off. */
export const getInvite = cache(async (inviteId) => {
  if (!INVITE_ID.test(inviteId || "")) return null;
  const services = server();
  if (!services) return null;
  try {
    const row = await findInvitedRow(services.tables, inviteId);
    const trip = row && fromRow(row);
    if (!trip) return null;
    const { memberships } = await services.teams.listMemberships({ teamId: row.teamId, queries: [Query.limit(100)] });
    const joined = memberships.filter((membership) => membership.confirm);
    const owner = joined.find((membership) => membership.userId === trip.ownerId) || joined.find((membership) => membership.roles.includes("owner"));
    // Only what the page draws: never the row, team or member IDs.
    return { title: trip.title, data: trip.data, ownerName: owner?.userName || null, memberCount: joined.length };
  } catch (error) {
    console.error("Couldn’t load trip invite", error?.message || error);
    return null;
  }
});

/** The account behind a JWT from `account.createJWT()`. */
async function whoIs(jwt, action) {
  if (typeof jwt !== "string" || !jwt) throw new CollabError(`Log in again to ${action}.`, 401);
  try {
    return await new Account(new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId).setJWT(jwt)).get();
  } catch {
    throw new CollabError(`Log in again to ${action}.`, 401);
  }
}

/** Adds the user behind `jwt` to the invited trip as an editor; resolves to the trip's row ID. */
export async function joinTrip(inviteId, jwt) {
  if (!INVITE_ID.test(inviteId || "")) throw new CollabError("That invite link isn’t valid.", 400);
  const services = server();
  if (!services) throw new CollabError("Invites aren’t set up on this server.", 503);

  const user = await whoIs(jwt, "join this trip");
  if (!user.emailVerification) throw new CollabError("Verify your email before joining a trip.", 403);

  const row = await findInvitedRow(services.tables, inviteId);
  if (!row) throw new CollabError("This invite link isn’t working any more.", 404);

  try {
    // Added with a server key, the membership is accepted straight away.
    await services.teams.createMembership({ teamId: row.teamId, roles: ["editor"], userId: user.$id });
  } catch (error) {
    if (error?.code !== 409) throw error; // 409: already on the trip
  }
  return row.$id;
}

/**
 * Who's on a trip, for someone who is on it: names and roles, never emails.
 * `[{ membershipId, userId, name, owner }]`.
 */
export async function listTripMembers(teamId, jwt) {
  if (!TEAM_ID.test(teamId || "")) throw new CollabError("That trip isn’t valid.", 400);
  const services = server();
  if (!services) throw new CollabError("Trip members aren’t set up on this server.", 503);
  const user = await whoIs(jwt, "see who’s on this trip");
  const { memberships } = await services.teams.listMemberships({ teamId, queries: [Query.limit(100)] });
  const joined = memberships.filter((membership) => membership.confirm);
  if (!joined.some((membership) => membership.userId === user.$id)) throw new CollabError("You’re not on this trip.", 403);
  return joined.map((membership) => ({
    membershipId: membership.$id,
    userId: membership.userId,
    name: membership.userName || "Trip member",
    owner: membership.roles.includes("owner"),
  }));
}
