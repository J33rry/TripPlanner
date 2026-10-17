import { test } from "node:test";
import assert from "node:assert/strict";
import { computeShares, formatMoney, netBalances, settlement, simplifyDebts, SplitError, toMinor, validateExpense } from "./splits.js";

const sum = (shares) => Object.values(shares).reduce((total, share) => total + share, 0);
const people = (...ids) => ids.map((userId) => ({ userId, value: 0 }));

test("an equal split of ₹100 three ways hands the spare paisa to the first person", () => {
  const shares = computeShares(10000, "equal", people("a", "b", "c"));
  assert.deepEqual(shares, { a: 3334, b: 3333, c: 3333 });
  assert.equal(sum(shares), 10000);
});

test("percent splits round to whole paise and still add up", () => {
  const shares = computeShares(9999, "percent", [
    { userId: "a", value: 33.33 },
    { userId: "b", value: 33.33 },
    { userId: "c", value: 33.34 },
  ]);
  assert.equal(sum(shares), 9999);
  assert.throws(() => computeShares(1000, "percent", [{ userId: "a", value: 50 }, { userId: "b", value: 40 }]), /90%/);
});

test("shares split by weight, and zero shares are left out", () => {
  const shares = computeShares(90000, "shares", [
    { userId: "a", value: 2 },
    { userId: "b", value: 1 },
    { userId: "c", value: 0 },
  ]);
  assert.deepEqual(shares, { a: 60000, b: 30000 });
});

test("exact amounts must add up to the total", () => {
  assert.deepEqual(computeShares(90000, "exact", [{ userId: "a", value: 50000 }, { userId: "b", value: 40000 }]), { a: 50000, b: 40000 });
  assert.throws(() => computeShares(90000, "exact", [{ userId: "a", value: 50000 }, { userId: "b", value: 30000 }]), SplitError);
  assert.throws(() => computeShares(90000, "exact", [{ userId: "a", value: 95000 }]), /more than/);
});

test("bad input is rejected", () => {
  assert.throws(() => computeShares(0, "equal", people("a")), SplitError);
  assert.throws(() => computeShares(100, "equal", []), SplitError);
  assert.throws(() => computeShares(100, "equal", people("a", "a")), /twice/);
  assert.throws(() => computeShares(100, "shares", [{ userId: "a", value: -1 }]), /negative/);
});

const trip = [
  // A pays ₹3000 for dinner, split equally between A, B and C.
  { kind: "expense", amount: 300000, paidBy: "a", splitType: "equal", splits: people("a", "b", "c") },
  // B pays ₹900 for a taxi: ₹500 for A, ₹400 for B.
  { kind: "expense", amount: 90000, paidBy: "b", splitType: "exact", splits: [{ userId: "a", value: 50000 }, { userId: "b", value: 40000 }] },
];

test("balances match the sums done by hand and net to zero", () => {
  const net = netBalances(trip);
  // A: paid 3000, owes 1000 + 500 → +1500. B: paid 900, owes 1000 + 400 → −500. C: owes 1000 → −1000.
  assert.deepEqual(net, { a: 150000, b: -50000, c: -100000 });
  assert.equal(sum(net), 0);
});

test("simplified debts settle everyone in at most n − 1 payments", () => {
  const net = netBalances(trip);
  const payments = simplifyDebts(net);
  assert.deepEqual(payments, [
    { from: "c", to: "a", amount: 100000 },
    { from: "b", to: "a", amount: 50000 },
  ]);
  assert.ok(payments.length <= Object.keys(net).length - 1);

  const bigger = { a: 7000, b: 2000, c: -4000, d: -3500, e: -1500 };
  const settled = { ...bigger };
  const transfers = simplifyDebts(bigger);
  assert.ok(transfers.length <= 4);
  for (const { from, to, amount } of transfers) {
    settled[from] += amount;
    settled[to] -= amount;
  }
  assert.ok(Object.values(settled).every((amount) => amount === 0));
});

test("recording the suggested settlements brings every balance to zero", () => {
  const payments = simplifyDebts(netBalances(trip));
  const paidBack = [...trip, ...payments.map((payment) => settlement({ ...payment, spentAt: "2026-10-18" }))];
  assert.ok(Object.values(netBalances(paidBack)).every((amount) => amount === 0));
  assert.deepEqual(simplifyDebts(netBalances(paidBack)), []);
});

test("money converts to minor units per currency", () => {
  assert.equal(toMinor("1,234.50", "INR"), 123450);
  assert.equal(toMinor("1500", "JPY"), 1500);
  assert.ok(Number.isNaN(toMinor("abc", "INR")));
  assert.match(formatMoney(123450, "INR", "en-IN"), /1,234\.50/);
});

test("validateExpense reports the first problem as a sentence", () => {
  const ok = validateExpense({ description: "Dinner", amount: 300000, paidBy: "a", splitType: "equal", splits: people("a", "b"), category: "food", spentAt: "2026-10-18" });
  assert.equal(ok.success, true);
  const bad = validateExpense({ description: "Taxi", amount: 1000, paidBy: "a", splitType: "exact", splits: [{ userId: "a", value: 400 }], category: "nope", spentAt: "2026-10-18" });
  assert.deepEqual(bad, { success: false, error: "The amounts add up to less than the total." });
});
