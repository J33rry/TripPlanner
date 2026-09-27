import HomeScreen from "@/components/HomeScreen";

// The globe, intro and trip view live in RoamShell (app/layout.js) so they
// persist across navigation; this route only adds the home overlay.
export default function HomePage() {
  return <HomeScreen />;
}
