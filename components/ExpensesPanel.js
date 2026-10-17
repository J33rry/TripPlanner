"use client";

import { useMemo, useState } from "react";
import ExpenseForm, { CATEGORY_LABELS } from "./ExpenseForm";
import SettleUpDialog from "./SettleUpDialog";
import { PlusIcon } from "./icons";
import { CURRENCIES, formatMoney, netBalances, sharesOf, simplifyDebts } from "@/lib/splits";

const CATEGORY_ICONS = { food: "🍽️", stay: "🛏️", transport: "🚕", activities: "🎟️", shopping: "🛍️", other: "🧾" };

const dateLabel = (iso) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/**
 * The trip's Expenses tab: what everyone spent, who owes whom, and the fewest
 * payments that settle it. `people` is the trip's members ({ userId, name });
 * `expenses` is null while loading.
 */
export default function ExpensesPanel({ expenses, error, onRetry, people, me, currency, canChangeCurrency, onChangeCurrency, budget, onSave, onDelete }) {
  const [editing, setEditing] = useState(null); // "new" or an expense
  const [settling, setSettling] = useState(null); // { payment } or { existing }
  const [currencyBusy, setCurrencyBusy] = useState(false);
  const money = (minor) => formatMoney(minor, currency);

  const list = useMemo(() => expenses || [], [expenses]);
  const net = useMemo(() => netBalances(list), [list]);
  const payments = useMemo(() => simplifyDebts(net), [net]);

  // Names: current members first, then whatever an old expense remembers.
  const nameOf = (userId) => {
    if (userId === me) return "You";
    const member = people.find((person) => person.userId === userId);
    if (member) return member.name;
    for (const expense of list) {
      if (expense.paidBy === userId && expense.paidByName) return expense.paidByName;
      const split = expense.splits.find((item) => item.userId === userId && item.name);
      if (split) return split.name;
    }
    return "Former member";
  };

  const spent = list.filter((expense) => expense.kind === "expense");
  const total = spent.reduce((sum, expense) => sum + expense.amount, 0);
  const myShare = spent.reduce((sum, expense) => sum + (sharesOf(expense)?.[me] || 0), 0);
  const mine = net[me] || 0;

  const balancePeople = [...people.map((person) => person.userId)];
  for (const userId of Object.keys(net)) if (net[userId] && !balancePeople.includes(userId)) balancePeople.push(userId);

  const groups = useMemo(() => {
    const sorted = [...list].sort((a, b) => b.spentAt.localeCompare(a.spentAt) || b.createdAt.localeCompare(a.createdAt));
    const byDay = new Map();
    for (const expense of sorted) {
      const day = expense.spentAt.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(expense);
    }
    return [...byDay.entries()];
  }, [list]);

  const changeCurrency = async (code) => {
    setCurrencyBusy(true);
    try {
      await onChangeCurrency(code);
    } catch (currencyError) {
      console.error("Couldn’t change currency", currencyError);
    } finally {
      setCurrencyBusy(false);
    }
  };

  if (error) {
    return (
      <div className="expenses-empty" role="alert">
        <p>Couldn’t load this trip’s expenses.</p>
        <button type="button" className="dark-pill small" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (!expenses) return <p className="expenses-loading">Loading expenses…</p>;

  const involvement = (expense) => {
    const shares = sharesOf(expense) || {};
    const myPart = shares[me] || 0;
    if (expense.paidBy === me && expense.amount - myPart > 0) return { text: `you lent ${money(expense.amount - myPart)}`, tone: "is-plus" };
    if (expense.paidBy !== me && myPart) return { text: `you borrowed ${money(myPart)}`, tone: "is-minus" };
    return { text: "not involved", tone: "" };
  };

  return (
    <div className="expenses">
      <section className="expense-summary" aria-label="Summary">
        <div className="expense-stat">
          <small>Trip total</small>
          <strong>{money(total)}</strong>
          {budget && <span>Planned: {budget}</span>}
        </div>
        <div className="expense-stat">
          <small>Your share</small>
          <strong>{money(myShare)}</strong>
        </div>
        <div className={`expense-stat ${mine > 0 ? "is-plus" : mine < 0 ? "is-minus" : ""}`}>
          <small>{mine > 0 ? "You’re owed" : mine < 0 ? "You owe" : "Your balance"}</small>
          <strong>{mine ? money(Math.abs(mine)) : "Settled up"}</strong>
        </div>
      </section>

      <div className="expense-toolbar">
        <button type="button" className="dark-pill small" onClick={() => setEditing("new")}><PlusIcon /> Add expense</button>
        <button type="button" className="ghost-pill" onClick={() => setSettling({ payment: payments.find((payment) => payment.from === me) || null })} disabled={people.length < 2}>
          Settle up
        </button>
        <label className="expense-currency">
          <span>Currency</span>
          {canChangeCurrency && !list.length ? (
            <select value={currency} onChange={(event) => changeCurrency(event.target.value)} disabled={currencyBusy}>
              {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          ) : (
            <b title={list.length ? "Fixed once the trip has expenses" : "Only the trip’s owner can change it"}>{currency}</b>
          )}
        </label>
      </div>

      {people.length < 2 && (
        <p className="expense-hint">Invite friends with <b>Invite</b> in the header to split costs with them.</p>
      )}

      {list.length > 0 && (
        <section className="expense-section" aria-labelledby="balances-title">
          <h3 id="balances-title">Balances</h3>
          <ul className="balance-list">
            {balancePeople.map((userId) => {
              const amount = net[userId] || 0;
              return (
                <li key={userId}>
                  <span>{nameOf(userId)}</span>
                  <b className={amount > 0 ? "is-plus" : amount < 0 ? "is-minus" : ""}>
                    {amount > 0 ? `${userId === me ? "get" : "gets"} back ${money(amount)}` : amount < 0 ? `${userId === me ? "owe" : "owes"} ${money(-amount)}` : "settled up"}
                  </b>
                </li>
              );
            })}
          </ul>
          {payments.length > 0 && (
            <>
              <h3>Fewest payments to settle up</h3>
              <ul className="payment-list">
                {payments.map((payment) => (
                  <li key={`${payment.from}-${payment.to}`}>
                    <span><b>{nameOf(payment.from)}</b> {payment.from === me ? "pay" : "pays"} <b>{payment.to === me ? "you" : nameOf(payment.to)}</b> {money(payment.amount)}</span>
                    <button type="button" className="ghost-pill" onClick={() => setSettling({ payment })}>Record</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {list.length === 0 ? (
        <div className="expenses-empty">
          <p>No expenses yet. Add what anyone spends on the trip, and Roam works out who owes whom.</p>
        </div>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="expense-section">
            <h3>{dateLabel(day)}</h3>
            <ul className="expense-list">
              {items.map((expense) =>
                expense.kind === "settlement" ? (
                  <li key={expense.id}>
                    <button type="button" className="expense-row" onClick={() => setSettling({ existing: expense })}>
                      <span className="expense-icon" aria-hidden="true">💸</span>
                      <span className="expense-text">
                        <strong>{nameOf(expense.paidBy)} paid {expense.splits[0]?.userId === me ? "you" : nameOf(expense.splits[0]?.userId)}</strong>
                        <small>Repayment</small>
                      </span>
                      <span className="expense-amount">{money(expense.amount)}</span>
                    </button>
                  </li>
                ) : (
                  <li key={expense.id}>
                    <button type="button" className="expense-row" onClick={() => setEditing(expense)}>
                      <span className="expense-icon" aria-hidden="true" title={CATEGORY_LABELS[expense.category]}>{CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.other}</span>
                      <span className="expense-text">
                        <strong>{expense.description}</strong>
                        <small>{nameOf(expense.paidBy)} paid {money(expense.amount)}</small>
                      </span>
                      <span className={`expense-amount ${involvement(expense).tone}`}>{involvement(expense).text}</span>
                    </button>
                  </li>
                )
              )}
            </ul>
          </section>
        ))
      )}

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          people={people}
          me={me}
          currency={currency}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => setEditing(null)}
        />
      )}
      {settling && (
        <SettleUpDialog
          payment={settling.payment}
          existing={settling.existing}
          people={people}
          me={me}
          currency={currency}
          onSave={onSave}
          onDelete={onDelete}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}
