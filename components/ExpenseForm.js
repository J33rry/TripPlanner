"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { CATEGORIES, computeShares, formatMoney, fromMinor, SPLIT_TYPES, toMinor, validateExpense } from "@/lib/splits";

export const CATEGORY_LABELS = { food: "Food & drink", stay: "Stay", transport: "Transport", activities: "Activities", shopping: "Shopping", other: "Other" };
const SPLIT_LABELS = { equal: "Equally", exact: "Exact amounts", percent: "Percentages", shares: "Shares" };

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local

/** Text inputs for each split type, filled from an expense being edited. */
function initialValues(expense, people, currency) {
  const values = { exact: {}, percent: {}, shares: Object.fromEntries(people.map((person) => [person.userId, "1"])) };
  if (expense && expense.splitType !== "equal") {
    values[expense.splitType] = Object.fromEntries(
      expense.splits.map((split) => [split.userId, String(expense.splitType === "exact" ? fromMinor(split.value, currency) : split.value)])
    );
  }
  return values;
}

/**
 * Add or edit a shared expense: who paid, and how it's split between the
 * people on the trip. Shows each person's share as you type and won't save
 * until the split adds up.
 */
export default function ExpenseForm({ expense, people: members, me, currency, onSave, onDelete, onClose }) {
  // People who've left the trip still show on expenses they were part of.
  const people = [...members];
  for (const split of expense?.splits || []) {
    if (!people.some((person) => person.userId === split.userId)) people.push({ userId: split.userId, name: split.name || "Former member" });
  }

  const [description, setDescription] = useState(expense?.description || "");
  const [amountText, setAmountText] = useState(expense ? String(fromMinor(expense.amount, currency)) : "");
  const [spentAt, setSpentAt] = useState(expense?.spentAt?.slice(0, 10) || today());
  const [paidBy, setPaidBy] = useState(expense?.paidBy || me);
  const [category, setCategory] = useState(expense?.category || "food");
  const [splitType, setSplitType] = useState(expense?.splitType || "equal");
  const [included, setIncluded] = useState(
    () => new Set(expense?.splitType === "equal" ? expense.splits.map((split) => split.userId) : members.map((person) => person.userId))
  );
  const [values, setValues] = useState(() => initialValues(expense, people, currency));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const money = (minor) => formatMoney(minor, currency);
  const amount = toMinor(amountText, currency);
  const amountOk = Number.isInteger(amount) && amount > 0;

  const nameOf = (userId) => people.find((person) => person.userId === userId)?.name || "Former member";
  const splits =
    splitType === "equal"
      ? people.filter((person) => included.has(person.userId)).map((person) => ({ userId: person.userId, name: person.name, value: 0 }))
      : people.map((person) => {
          const text = (values[splitType][person.userId] || "").trim();
          const value = !text ? 0 : splitType === "exact" ? toMinor(text, currency) : Number(text);
          return { userId: person.userId, name: person.name, value };
        });
  const badNumber = splits.some((split) => Number.isNaN(split.value));

  let shares = null;
  let splitProblem = "";
  if (badNumber) splitProblem = "One of the numbers isn’t a number.";
  else if (amountOk) {
    try {
      shares = computeShares(amount, splitType, splits);
    } catch (splitError) {
      splitProblem = splitError.message;
    }
  }

  // "₹200 left to assign" / "10% left": the running total people check as they type.
  let progress = "";
  if (!badNumber && amountOk && splitType === "exact") {
    const left = amount - splits.reduce((sum, split) => sum + Math.max(0, split.value), 0);
    progress = left === 0 ? "" : left > 0 ? `${money(left)} left to assign` : `${money(-left)} more than the total`;
  } else if (!badNumber && splitType === "percent") {
    const left = Math.round((100 - splits.reduce((sum, split) => sum + Math.max(0, split.value), 0)) * 100) / 100;
    progress = left === 0 ? "" : left > 0 ? `${left}% left to assign` : `${-left}% too much`;
  }

  const setValue = (userId, text) => setValues((current) => ({ ...current, [splitType]: { ...current[splitType], [userId]: text } }));
  const toggle = (userId) =>
    setIncluded((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const submit = async (event) => {
    event.preventDefault();
    const draft = {
      kind: "expense",
      description,
      amount: amountOk ? amount : 0,
      paidBy,
      paidByName: nameOf(paidBy),
      splitType,
      splits: splits.filter((split) => splitType === "equal" || split.value > 0),
      category,
      spentAt,
    };
    const checked = validateExpense(draft);
    if (!checked.success) return setError(checked.error);
    setBusy("save");
    setError("");
    try {
      await onSave(checked.data, expense?.id ?? null);
      onClose();
    } catch (saveError) {
      console.error("Couldn’t save expense", saveError);
      setError(saveError.message || "Couldn’t save. Check your connection and try again.");
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${expense.description}”? Everyone’s balances will change.`)) return;
    setBusy("delete");
    try {
      await onDelete(expense.id);
      onClose();
    } catch (deleteError) {
      console.error("Couldn’t delete expense", deleteError);
      setError("Couldn’t delete. Check your connection and try again.");
      setBusy("");
    }
  };

  return (
    <Sheet title={expense ? "Edit expense" : "Add an expense"} onClose={onClose}>
      <form className="expense-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>What was it for?</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Dinner at the night market" maxLength={256} autoFocus />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Amount ({currency})</span>
            <input value={amountText} onChange={(event) => setAmountText(event.target.value)} inputMode="decimal" placeholder="0" />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Paid by</span>
            <select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>{person.userId === me ? `${person.name} (you)` : person.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="split-fieldset">
          <legend>Split</legend>
          <div className="segmented" role="radiogroup" aria-label="How to split it">
            {SPLIT_TYPES.map((type) => (
              <button key={type} type="button" role="radio" aria-checked={splitType === type} className={splitType === type ? "is-active" : ""} onClick={() => setSplitType(type)}>
                {SPLIT_LABELS[type]}
              </button>
            ))}
          </div>
          <ul className="split-people">
            {people.map((person) => (
              <li key={person.userId}>
                {splitType === "equal" ? (
                  <label className="split-check">
                    <input type="checkbox" checked={included.has(person.userId)} onChange={() => toggle(person.userId)} />
                    <span>{person.userId === me ? `${person.name} (you)` : person.name}</span>
                  </label>
                ) : (
                  <>
                    <span className="split-name">{person.userId === me ? `${person.name} (you)` : person.name}</span>
                    <label className="split-value">
                      <span className="sr-only">{SPLIT_LABELS[splitType]} for {person.name}</span>
                      <input
                        value={values[splitType][person.userId] || ""}
                        onChange={(event) => setValue(person.userId, event.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                      />
                      <small>{splitType === "exact" ? currency : splitType === "percent" ? "%" : "×"}</small>
                    </label>
                  </>
                )}
                <span className="split-share">{shares?.[person.userId] ? money(shares[person.userId]) : "—"}</span>
              </li>
            ))}
          </ul>
          {amountOk && (progress || splitProblem) && <p className="split-status" role="status">{progress || splitProblem}</p>}
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          {expense && (
            <button type="button" className="share-stop" onClick={remove} disabled={Boolean(busy)}>
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          )}
          <button type="button" className="ghost-pill" onClick={onClose}>Cancel</button>
          <button type="submit" className="dark-pill small" disabled={Boolean(busy)}>{busy === "save" ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Sheet>
  );
}
