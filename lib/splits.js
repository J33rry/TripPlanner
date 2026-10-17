import { z } from "zod";

// Splitwise-style maths for a trip's shared expenses. Amounts are always
// integers in the currency's minor unit (paise, cents), so shares add up to
// the exact total and balances never drift by a fraction of a rupee.

export const DEFAULT_CURRENCY = "INR";
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "THB", "SGD", "JPY", "AUD", "CAD", "CHF", "IDR", "LKR", "NPR", "MYR", "VND"];
export const SPLIT_TYPES = ["equal", "exact", "percent", "shares"];
export const CATEGORIES = ["food", "stay", "transport", "activities", "shopping", "other"];

export class SplitError extends Error {}

/** Digits after the decimal point: 2 for INR, 0 for JPY. */
export function minorDigits(currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

/** "1,234.50" or 1234.5 → 123450 (for INR). NaN when it isn't a number. */
export function toMinor(major, currency) {
  const value = typeof major === "string" ? Number(major.replace(/[,\s]/g, "")) : Number(major);
  return Number.isFinite(value) ? Math.round(value * 10 ** minorDigits(currency)) : NaN;
}

export const fromMinor = (minor, currency) => minor / 10 ** minorDigits(currency);

export function formatMoney(minor, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(fromMinor(minor, currency));
  } catch {
    return `${currency} ${fromMinor(minor, currency).toFixed(minorDigits(currency))}`;
  }
}

/**
 * Divides `amount` by the weights so the parts sum to exactly `amount`: each
 * gets the floor of its exact share, and the leftover minor units go to the
 * largest fractional parts (ties: earlier in the list first).
 */
function allocate(amount, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const parts = entries.map((entry, index) => {
    const exact = (amount * entry.weight) / total;
    // A hair of tolerance so 100 × 0.5 doesn't floor to 49 through float error.
    const floor = Math.floor(exact + 1e-9);
    return { userId: entry.userId, index, floor, fraction: exact - floor };
  });
  let left = amount - parts.reduce((sum, part) => sum + part.floor, 0);
  const order = [...parts].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const part of order) {
    if (left <= 0) break;
    part.floor += 1;
    left -= 1;
  }
  return Object.fromEntries(parts.map((part) => [part.userId, part.floor]));
}

/**
 * Who owes what of an expense: `{ userId: minor }`, always summing to `amount`.
 * `splits` is `[{ userId, value }]`, where `value` means nothing for "equal",
 * is a minor amount for "exact", a percentage for "percent" and a weight for
 * "shares". Throws SplitError with a message fit to show when it doesn't add up.
 */
export function computeShares(amount, splitType, splits) {
  if (!Number.isInteger(amount) || amount <= 0) throw new SplitError("Enter an amount above zero.");
  const people = (splits || []).filter((split) => split?.userId);
  if (new Set(people.map((split) => split.userId)).size !== people.length) throw new SplitError("Someone is in the split twice.");

  switch (splitType) {
    case "equal": {
      if (!people.length) throw new SplitError("Pick at least one person to split with.");
      return allocate(amount, people.map((split) => ({ userId: split.userId, weight: 1 })));
    }
    case "exact": {
      const owed = people.filter((split) => split.value > 0);
      if (owed.some((split) => !Number.isInteger(split.value))) throw new SplitError("Amounts can’t go below the smallest coin.");
      if (people.some((split) => split.value < 0)) throw new SplitError("Amounts can’t be negative.");
      const sum = owed.reduce((total, split) => total + split.value, 0);
      if (sum !== amount) throw new SplitError(sum < amount ? "The amounts add up to less than the total." : "The amounts add up to more than the total.");
      return Object.fromEntries(owed.map((split) => [split.userId, split.value]));
    }
    case "percent":
    case "shares": {
      if (people.some((split) => !(split.value >= 0))) throw new SplitError(`${splitType === "percent" ? "Percentages" : "Shares"} can’t be negative.`);
      const weighted = people.filter((split) => split.value > 0);
      if (!weighted.length) throw new SplitError("Give at least one person a share.");
      if (splitType === "percent") {
        const sum = weighted.reduce((total, split) => total + split.value, 0);
        if (Math.abs(sum - 100) > 0.001) throw new SplitError(`The percentages add up to ${Math.round(sum * 100) / 100}%, not 100%.`);
      }
      return allocate(amount, weighted.map((split) => ({ userId: split.userId, weight: split.value })));
    }
    default:
      throw new SplitError("Pick how to split it.");
  }
}

/**
 * Everyone's net position across the trip: positive means they're owed that
 * much, negative means they owe it. A settlement (A paid B back) is stored as
 * A paying an expense owed entirely by B, so the same sum covers both.
 */
export function netBalances(expenses) {
  const net = {};
  const add = (userId, change) => {
    net[userId] = (net[userId] || 0) + change;
  };
  for (const expense of expenses) {
    let shares;
    try {
      shares = computeShares(expense.amount, expense.splitType, expense.splits);
    } catch {
      continue; // a row someone broke by hand shouldn't break everyone's balances
    }
    add(expense.paidBy, expense.amount);
    for (const [userId, share] of Object.entries(shares)) add(userId, -share);
  }
  return net;
}

/**
 * The fewest payments that settle everyone up: repeatedly the person who owes
 * most pays the person owed most. Never more than (people − 1) payments.
 */
export function simplifyDebts(net) {
  const byAmount = (a, b) => b.amount - a.amount || (a.userId < b.userId ? -1 : 1);
  const creditors = Object.entries(net).filter(([, amount]) => amount > 0).map(([userId, amount]) => ({ userId, amount })).sort(byAmount);
  const debtors = Object.entries(net).filter(([, amount]) => amount < 0).map(([userId, amount]) => ({ userId, amount: -amount })).sort(byAmount);
  const payments = [];
  while (creditors.length && debtors.length) {
    const [creditor, debtor] = [creditors[0], debtors[0]];
    const amount = Math.min(creditor.amount, debtor.amount);
    payments.push({ from: debtor.userId, to: creditor.userId, amount });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (!creditor.amount) creditors.shift();
    if (!debtor.amount) debtors.shift();
    creditors.sort(byAmount);
    debtors.sort(byAmount);
  }
  return payments;
}

/** What each person's share of an expense is, or null when it doesn't add up. */
export function sharesOf(expense) {
  try {
    return computeShares(expense.amount, expense.splitType, expense.splits);
  } catch {
    return null;
  }
}

const splitSchema = z.object({
  userId: z.string().min(1).max(36),
  name: z.string().max(128).default(""),
  value: z.number().finite().default(0),
});

export const expenseSchema = z
  .object({
    kind: z.enum(["expense", "settlement"]).default("expense"),
    description: z.string().trim().min(1, "Say what it was for").max(256),
    amount: z.number().int().positive("Enter an amount above zero"),
    paidBy: z.string().min(1, "Pick who paid").max(36),
    paidByName: z.string().max(128).default(""),
    splitType: z.enum(SPLIT_TYPES),
    splits: z.array(splitSchema).min(1, "Pick at least one person to split with").max(100),
    category: z.enum(CATEGORIES).catch("other"),
    spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Pick a date"),
  })
  .superRefine((expense, context) => {
    try {
      computeShares(expense.amount, expense.splitType, expense.splits);
    } catch (error) {
      context.addIssue({ code: "custom", path: ["splits"], message: error.message });
    }
  });

/** `{ success, data }` or `{ success: false, error }` with the first problem as a sentence. */
export function validateExpense(input) {
  const result = expenseSchema.safeParse(input);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error.issues[0]?.message || "Check the expense." };
}

/** A repayment from one person to another, in the same shape as an expense. */
export const settlement = ({ from, fromName = "", to, toName = "", amount, spentAt }) => ({
  kind: "settlement",
  description: "Settle up",
  amount,
  paidBy: from,
  paidByName: fromName,
  splitType: "exact",
  splits: [{ userId: to, name: toName, value: amount }],
  category: "other",
  spentAt,
});
