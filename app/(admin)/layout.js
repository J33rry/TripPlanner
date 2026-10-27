import { Outfit } from "next/font/google";
import "../globals.css";
import "./admin.css";
import { THEME_SCRIPT } from "@/lib/theme";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-display" });

// Its own root layout, so the admin page loads none of the site's shell (globe,
// header, trip state) and nothing in the public bundle links to or names it.
export const metadata = {
  title: "Admin — Roam",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="admin-body">{children}</body>
    </html>
  );
}
