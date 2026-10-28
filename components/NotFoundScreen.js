import Link from "next/link";
import MoonScene from "./MoonScene";
import Wordmark from "./Wordmark";
import { ArrowIcon, HomeIcon } from "./icons";

export default function NotFoundScreen() {
  return (
    <div className="nf-page">
      <header className="nf-header">
        <Link href="/" className="roam-brand" aria-label="Roam home">
          <Wordmark />
        </Link>
        {/* The label hides on narrow screens, so the link names itself. */}
        <Link href="/" className="outline-pill" aria-label="Back to home">
          <HomeIcon />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="nf-main">
        <div className="nf-moon-wrap">
          <MoonScene />
        </div>
        <p className="nf-eyebrow">404 · Lost in space</p>
        <h1 className="nf-title">This page is off the map.</h1>
        <p className="nf-sub">We couldn’t find the trip you were looking for.</p>
        <Link href="/" className="dark-pill nf-cta">
          Back to home
          <ArrowIcon />
        </Link>
      </main>
    </div>
  );
}
