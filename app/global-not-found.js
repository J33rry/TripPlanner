import { Outfit } from "next/font/google";
import "./globals.css";
import NotFoundScreen from "@/components/NotFoundScreen";
import { THEME_SCRIPT } from "@/lib/theme";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-display" });

// The app has two root layouts ((roam) and (admin)), so unmatched URLs need a
// self-contained 404 that brings its own <html>, fonts and theme.
export const metadata = {
  title: "Page not found — Roam",
  description: "This page is off the map.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={outfit.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <NotFoundScreen />
      </body>
    </html>
  );
}
