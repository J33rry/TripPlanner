import { connection } from "next/server";
import JoinTripScreen from "@/components/JoinTripScreen";
import { getInvite } from "@/lib/collab";

// Read fresh on every visit, so revoking a link takes effect immediately.
async function load(params) {
  await connection();
  const { inviteId } = await params;
  return { inviteId, invite: await getInvite(inviteId) };
}

export async function generateMetadata({ params }) {
  const { invite } = await load(params);
  return {
    title: invite ? `Join ${invite.title} — Roam` : "Trip invite — Roam",
    robots: { index: false },
  };
}

export default async function JoinTripPage({ params }) {
  const { inviteId, invite } = await load(params);
  return <JoinTripScreen inviteId={inviteId} invite={invite} />;
}
