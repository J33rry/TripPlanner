"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutIcon, MapIcon, UserIcon } from "./icons";

const initials = (user) =>
  (user.name || user.email || "")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export default function AccountMenu({ user, onLogout, onNavigate }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!user) {
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return (
      <div className="account">
        <Link href={`/login${next}`} className="account-login" onClick={onNavigate}>
          <span className="account-avatar is-guest" aria-hidden="true"><UserIcon /></span>
          <span>Log in</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className="account-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.name || user.email}`}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(user) || <UserIcon />}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            {user.name && <strong>{user.name}</strong>}
            <small>{user.email}</small>
          </div>
          <Link href="/trips" role="menuitem" onClick={() => { setOpen(false); onNavigate(); }}>
            <MapIcon /> Your trips
          </Link>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
            <LogoutIcon /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
