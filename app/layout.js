import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Trip Planner — AI-Powered Itinerary Builder",
  description:
    "Describe your dream trip and let AI create a detailed, interactive day-by-day itinerary you can customize, reorder, and refine.",
  openGraph: {
    title: "Trip Planner — AI-Powered Itinerary Builder",
    description:
      "Describe your dream trip and let AI create a detailed, interactive day-by-day itinerary.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">{children}</body>
    </html>
  );
}
