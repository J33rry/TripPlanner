import { Outfit } from "next/font/google";
import "./globals.css";
import RoamShell from "@/components/RoamShell";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-display" });

export const metadata = {
  applicationName: "Roam",
  title: "Roam — Find your way somewhere wonderful",
  description:
    "Plan a thoughtful trip with Roam. Explore destinations, shape an itinerary, and make the plan your own.",
  openGraph: {
    title: "Roam — Find your way somewhere wonderful",
    description:
      "Explore destinations and build a trip plan you can edit and make your own.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <RoamShell>{children}</RoamShell>
      </body>
    </html>
  );
}
