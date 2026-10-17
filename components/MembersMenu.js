"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon, CopyIcon, UsersIcon } from "./icons";
import { inviteUrl } from "@/lib/tripStore";

const COPIED_MS = 1800;
const FAILED = Symbol("failed");

const initials = (name) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

/**
 * "Invite" / "People" in the trip header. For the owner, opening it the first
 * time saves the trip and creates its join link (`onInvite`, which resolves to
 * the saved trip, or null when it sent a guest off to log in). Everyone on the
 * trip sees who else is on it. `members` comes from useTripMembers; nobody
 * can leave or be removed while `owing(userId)` returns an unsettled balance
 * (`{ owes, amount }`, amount already formatted).
 */
export default function MembersMenu({
  saved,
  isOwner,
  userId,
  members,
  membersError,
  owing,
  onReloadMembers,
  onInvite,
  onNewLink,
  onStopInviting,
  onRemove,
  onLeave,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);
  const copiedTimer = useRef(null);
  const teamId = saved?.teamId ?? null;

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

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

  const run = async (label, action) => {
    setBusy(label);
    setError("");
    try {
      return await action();
    } catch (actionError) {
      console.error("Couldn’t update trip members", actionError);
      setError("That didn’t work. Check your connection and try again.");
      return FAILED;
    } finally {
      setBusy("");
    }
  };

  const toggle = async () => {
    if (open) return setOpen(false);
    setCopied(false);
    if (isOwner && !saved?.inviteId && !teamId) {
      const entry = await run("invite", onInvite);
      if (entry === null) return;
    } else if (teamId) {
      onReloadMembers(); // someone may have joined since
    }
    setOpen(true);
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return wrapRef.current?.querySelector("input")?.select();
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const remove = async (member) => {
    const unsettled = owing(member.userId);
    if (unsettled) {
      return setError(`${member.name} ${unsettled.owes ? "still owes" : "is still owed"} ${unsettled.amount}. Settle up in Expenses before removing them.`);
    }
    if (!window.confirm(`Remove ${member.name} from this trip? They won’t be able to see or edit it any more.`)) return;
    await run(`remove-${member.membershipId}`, () => onRemove(member.membershipId));
  };

  const leave = async () => {
    const unsettled = owing(userId);
    if (unsettled) return setError(`You ${unsettled.owes ? "still owe" : "are still owed"} ${unsettled.amount}. Settle up in Expenses before leaving.`);
    if (!window.confirm("Leave this trip? You’ll need a new invite to get back in.")) return;
    if ((await run("leave", onLeave)) !== FAILED) setOpen(false);
  };

  const url = saved?.inviteId ? inviteUrl(saved.inviteId) : "";
  const count = members?.length ?? 0;
  const label = busy === "invite" ? "Inviting…" : !teamId ? "Invite" : count > 1 ? `${count} people` : "People";

  return (
    <div className="share" ref={wrapRef}>
      <button type="button" className="outline-pill" onClick={toggle} disabled={busy === "invite"} aria-haspopup="dialog" aria-expanded={open}>
        <UsersIcon /><span>{label}</span>
      </button>
      {open && (
        <div className="share-menu members-menu" role="dialog" aria-label="People on this trip">
          <h2>Plan together</h2>
          {isOwner ? (
            url ? (
              <>
                <p>Anyone with this link can join and edit the trip once they log in. Only you can delete it or remove people.</p>
                <div className="share-link">
                  <label className="sr-only" htmlFor="invite-url">Invite link</label>
                  <input id="invite-url" value={url} readOnly onFocus={(event) => event.target.select()} />
                  <button type="button" className="dark-pill small" onClick={() => copy(url)}>
                    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                  </button>
                </div>
                <div className="members-link-actions">
                  <button type="button" className="share-stop is-quiet" disabled={Boolean(busy)} onClick={() => run("new", onNewLink)}>
                    {busy === "new" ? "Making a new link…" : "New link"}
                  </button>
                  <button type="button" className="share-stop" disabled={Boolean(busy)} onClick={() => run("stop", onStopInviting)}>
                    {busy === "stop" ? "Turning off…" : "Turn off link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>The invite link is off, so nobody new can join. People already on the trip can still edit it.</p>
                <button type="button" className="dark-pill small" disabled={Boolean(busy)} onClick={() => run("new", onNewLink)}>
                  {busy === "new" ? "Creating…" : "Create invite link"}
                </button>
              </>
            )
          ) : (
            <p>Everyone here can change the itinerary. Only the trip’s owner can delete it or invite people.</p>
          )}

          {teamId && (
            <ul className="members-list" aria-busy={members === null}>
              {members === null && <li className="members-loading">{membersError ? "Couldn’t load who’s on this trip." : "Loading…"}</li>}
              {members?.map((member) => (
                <li key={member.membershipId}>
                  <span className="member-avatar" aria-hidden="true">{initials(member.name)}</span>
                  <span className="member-text">
                    <strong>{member.name}{member.userId === userId && " (you)"}</strong>
                    <small>{member.owner ? "Owner" : "Can edit"}</small>
                  </span>
                  {isOwner && !member.owner && (
                    <button
                      type="button"
                      className="icon-button"
                      disabled={Boolean(busy)}
                      onClick={() => remove(member)}
                      aria-label={`Remove ${member.name}`}
                      title="Remove from trip"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isOwner && (
            <button type="button" className="share-stop" disabled={Boolean(busy)} onClick={leave}>
              {busy === "leave" ? "Leaving…" : "Leave trip"}
            </button>
          )}
          {error && <p className="share-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
