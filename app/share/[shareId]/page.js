import { connection } from "next/server";
import SharedTripScreen from "@/components/SharedTripScreen";
import { getSharedTrip } from "@/lib/sharedTrips";
import { dayCount, destinationLabel } from "@/lib/tripDisplay";

// Read fresh on every visit, so turning a link off takes effect immediately.
async function load(params) {
  await connection();
  const { shareId } = await params;
  return getSharedTrip(shareId);
}

export async function generateMetadata({ params }) {
  const shared = await load(params);
  if (!shared) return { title: "Shared trip — Roam", robots: { index: false } };
  const description = `${destinationLabel(shared.data)} · ${dayCount(shared.data)} — a trip planned with Roam.`;
  return {
    title: `${shared.title} — Roam`,
    description,
    robots: { index: false },
    openGraph: { title: shared.title, description, type: "website" },
  };
}

export default async function SharedTripPage({ params }) {
  return <SharedTripScreen shared={await load(params)} />;
}
