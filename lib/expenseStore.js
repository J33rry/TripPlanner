import { Channel, ID, Permission, Query, Role } from "appwrite";
import { APPWRITE, appwrite } from "./appwrite";
import { validateExpense } from "./splits";

const PAGE = 100;

const table = () => ({ databaseId: APPWRITE.databaseId, tableId: APPWRITE.expensesTableId });

function parseSplits(json) {
  try {
    const splits = JSON.parse(json || "[]");
    return Array.isArray(splits) ? splits : [];
  } catch {
    return [];
  }
}

export function fromExpenseRow(row) {
  return {
    id: row.$id,
    tripId: row.tripId,
    kind: row.kind,
    description: row.description,
    amount: row.amount,
    paidBy: row.paidBy,
    paidByName: row.paidByName || "",
    splitType: row.splitType,
    splits: parseSplits(row.splits),
    category: row.category || "other",
    spentAt: row.spentAt,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    createdAt: row.$createdAt,
  };
}

/** Every expense and repayment on the trip, oldest first. */
export async function listExpenses(tripId) {
  const { tables } = appwrite();
  const expenses = [];
  for (let cursor = null; ; ) {
    const queries = [Query.equal("tripId", tripId), Query.orderAsc("$createdAt"), Query.limit(PAGE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { rows } = await tables.listRows({ ...table(), queries });
    expenses.push(...rows.map(fromExpenseRow));
    if (rows.length < PAGE) return expenses;
    cursor = rows[rows.length - 1].$id;
  }
}

/**
 * Creates an expense (or a repayment, see `settlement` in splits.js), or
 * replaces the one `rowId` names. Rows belong to the trip's team, so everyone
 * on the trip can see and change them. Throws with a readable message when the
 * expense doesn't add up.
 */
export async function saveExpense({ tripId, teamId, userId, expense, rowId = null }) {
  const checked = validateExpense(expense);
  if (!checked.success) throw new Error(checked.error);
  const { splits, ...fields } = checked.data;
  const data = { ...fields, splits: JSON.stringify(splits), spentAt: new Date(`${fields.spentAt.slice(0, 10)}T12:00:00Z`).toISOString(), updatedBy: userId };
  const { tables } = appwrite();
  const row = rowId
    ? await tables.updateRow({ ...table(), rowId, data })
    : await tables.createRow({
        ...table(),
        rowId: ID.unique(),
        data: { ...data, tripId, createdBy: userId },
        permissions: [Permission.read(Role.team(teamId)), Permission.update(Role.team(teamId)), Permission.delete(Role.team(teamId))],
      });
  return fromExpenseRow(row);
}

export async function deleteExpense(rowId) {
  await appwrite().tables.deleteRow({ ...table(), rowId });
}

/** Clears a trip's expenses (before the trip itself is deleted). */
export async function deleteTripExpenses(tripId) {
  const expenses = await listExpenses(tripId);
  await Promise.all(expenses.map((expense) => deleteExpense(expense.id)));
}

/**
 * Calls `onSave(expense)` when anyone adds or edits one of the trip's
 * expenses, and `onDelete(id)` when one is removed. Returns a function that
 * stops watching.
 */
export function watchExpenses(tripId, { onSave, onDelete }) {
  const channel = Channel.tablesdb(APPWRITE.databaseId).table(APPWRITE.expensesTableId).row();
  const subscription = appwrite().realtime.subscribe(
    channel,
    (event) => {
      const row = event.payload;
      if (row?.tripId !== tripId) return;
      if (event.events.some((name) => name.endsWith(".delete"))) onDelete(row.$id);
      else onSave(fromExpenseRow(row));
    },
    [Query.equal("tripId", tripId)]
  );
  subscription.catch((error) => console.error("Couldn’t watch trip expenses", error));
  return () => {
    subscription.then((sub) => sub.unsubscribe()).catch(() => {});
  };
}
