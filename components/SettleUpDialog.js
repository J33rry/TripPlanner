"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { formatMoney, fromMinor, settlement, toMinor, validateExpense } from "@/lib/splits";

const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Records one person paying another back. Opened from a suggested payment
 * (`payment`: { from, to, amount }) or on an existing repayment to edit it.
 */
export default function SettleUpDialog({ payment, existing, people, me, currency, onSave, onDelete, onClose }) {
  const start = existing ? { from: existing.paidBy, to: existing.splits[0]?.userId, amount: existing.amount } : payment || {};
  const [from, setFrom] = useState(start.from || me);
  const [to, setTo] = useState(start.to || people.find((person) => person.userId !== (start.from || me))?.userId || "");
  const [amountText, setAmountText] = useState(start.amount ? String(fromMinor(start.amount, currency)) : "");
  const [spentAt, setSpentAt] = useState(existing?.spentAt?.slice(0, 10) || today());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  // Someone who has left can still appear on an old repayment.
  const everyone = [...people];
  for (const userId of [start.from, start.to]) {
    if (userId && !everyone.some((person) => person.userId === userId)) {
      everyone.push({ userId, name: existing?.paidBy === userId ? existing.paidByName || "Former member" : existing?.splits[0]?.name || "Former member" });
    }
  }
  const nameOf = (userId) => everyone.find((person) => person.userId === userId)?.name || "Former member";
  const label = (person) => (person.userId === me ? `${person.name} (you)` : person.name);

  const submit = async (event) => {
    event.preventDefault();
    if (from === to) return setError("Pick two different people.");
    const amount = toMinor(amountText, currency);
    const draft = settlement({ from, fromName: nameOf(from), to, toName: nameOf(to), amount: Number.isInteger(amount) ? amount : 0, spentAt });
    const checked = validateExpense(draft);
    if (!checked.success) return setError(checked.error);
    setBusy("save");
    setError("");
    try {
      await onSave(checked.data, existing?.id ?? null);
      onClose();
    } catch (saveError) {
      console.error("Couldn’t record payment", saveError);
      setError(saveError.message || "Couldn’t save. Check your connection and try again.");
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this payment? Everyone’s balances will change.")) return;
    setBusy("delete");
    try {
      await onDelete(existing.id);
      onClose();
    } catch (deleteError) {
      console.error("Couldn’t delete payment", deleteError);
      setError("Couldn’t delete. Check your connection and try again.");
      setBusy("");
    }
  };

  return (
    <Sheet title={existing ? "Edit payment" : "Settle up"} onClose={onClose}>
      <form className="expense-form" onSubmit={submit} noValidate>
        <p className="sheet-intro">Record money paid back outside Roam, in cash or by UPI, so everyone’s balance updates.</p>
        <div className="field-row">
          <label className="field">
            <span>Who paid</span>
            <select value={from} onChange={(event) => setFrom(event.target.value)}>
              {everyone.map((person) => <option key={person.userId} value={person.userId}>{label(person)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select value={to} onChange={(event) => setTo(event.target.value)}>
              {everyone.map((person) => <option key={person.userId} value={person.userId}>{label(person)}</option>)}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Amount ({currency})</span>
            <input value={amountText} onChange={(event) => setAmountText(event.target.value)} inputMode="decimal" placeholder="0" autoFocus />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} />
          </label>
        </div>
        {payment && !existing && (
          <p className="sheet-intro">Suggested: {nameOf(payment.from)} pays {nameOf(payment.to)} {formatMoney(payment.amount, currency)}.</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          {existing && (
            <button type="button" className="share-stop" onClick={remove} disabled={Boolean(busy)}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          )}
          <button type="button" className="ghost-pill" onClick={onClose}>Cancel</button>
          <button type="submit" className="dark-pill small" disabled={Boolean(busy)}>{busy === "save" ? "Saving…" : "Record payment"}</button>
        </div>
      </form>
    </Sheet>
  );
}
