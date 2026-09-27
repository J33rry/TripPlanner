import TripRouteScreen from "@/components/TripRouteScreen";

// Trips are stored in the visitor's browser, so this page can't know the
// trip on the server: RoamShell reads the id from the URL, opens the trip
// and sets the tab title once it's loaded.
export const metadata = {
  title: "Trip — Roam",
};

export default function TripPage() {
  return <TripRouteScreen />;
}
