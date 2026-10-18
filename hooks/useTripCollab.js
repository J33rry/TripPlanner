"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTripExpenses } from "@/hooks/useTripExpenses";
import { useTripMembers } from "@/hooks/useTripMembers";
import { deleteExpense, saveExpense } from "@/lib/expenseStore";
import { formatMoney, netBalances } from "@/lib/splits";
import { createInviteLink, enableCollaboration, leaveTrip, removeMember, revokeInviteLink, setTripCurrency } from "@/lib/tripStore";

/**
 * Collaboration on the open trip: who's on it and what they've spent, with the
 * People menu's and Expenses tab's handlers. Only a synced trip (saved, and not
 * view-only) has members or expenses.
 *
 * `persistTrip()` saves the trip first (resolving to its entry, or null for a
 * guest), and `dropTrip(id)` closes a trip the user just left.
 */
export function useTripCollab({ user, openSaved, openSavedId, syncing, persistTrip, rememberSaved, dropTrip }) {
  const router = useRouter();
  const userId = user?.$id ?? null;
  const tripMembers = useTripMembers(syncing ? openSaved.teamId : null);
  const tripExpenses = useTripExpenses(syncing && openSaved.teamId ? openSaved.id : null);
  const balances = useMemo(() => netBalances(tripExpenses.expenses || []), [tripExpenses.expenses]);
  const currency = openSaved?.currency;
  // Members' names, with the account's own name for the user (membership privacy may hide names).
  const people = useMemo(() => {
    const me = { userId, name: user?.name || user?.email || "You" };
    if (!tripMembers.members) return userId ? [me] : [];
    return tripMembers.members.map((member) => (member.userId === userId ? { ...me, name: user?.name || member.name } : member));
  }, [tripMembers.members, userId, user]);
  /** `{ owes, amount }` while `memberId` has an unsettled balance on the open trip, else null. */
  const owing = (memberId) => {
    const amount = balances[memberId];
    return amount ? { owes: amount < 0, amount: formatMoney(Math.abs(amount), currency) } : null;
  };

  /** The owner's first "Invite": saves the trip, hands it to a team, and gives it a join link. */
  const handleInvite = async () => {
    const entry = await persistTrip();
    if (!entry) return null;
    const withTeam = await enableCollaboration(entry, userId);
    const invited = withTeam.inviteId ? withTeam : await createInviteLink(withTeam.id);
    rememberSaved(invited);
    return invited;
  };

  const handleNewInviteLink = async () => {
    if (!openSaved) return;
    const withTeam = openSaved.teamId ? openSaved : await enableCollaboration(openSaved, userId);
    rememberSaved(await createInviteLink(withTeam.id));
  };

  const handleStopInviting = async () => {
    if (openSavedId != null) rememberSaved(await revokeInviteLink(openSavedId));
  };

  const handleRemoveMember = async (membershipId) => {
    await removeMember(openSaved.teamId, membershipId);
    tripMembers.forget(membershipId);
  };

  const handleLeaveTrip = async () => {
    const left = openSaved;
    await leaveTrip(left.teamId, userId);
    dropTrip(left.id);
    router.push("/trips");
  };

  /** Adds or edits an expense; a trip nobody's been invited to yet gets its team first. */
  const handleSaveExpense = async (expense, rowId) => {
    let saved = openSaved;
    if (!saved.teamId) {
      saved = await enableCollaboration(saved, userId);
      rememberSaved(saved);
    }
    tripExpenses.applySaved(await saveExpense({ tripId: saved.id, teamId: saved.teamId, userId, expense, rowId }));
  };

  const handleDeleteExpense = async (expenseId) => {
    await deleteExpense(expenseId);
    tripExpenses.applyDeleted(expenseId);
  };

  const handleChangeCurrency = async (code) => rememberSaved(await setTripCurrency(openSaved.id, code));

  return {
    members: tripMembers.members,
    membersError: tripMembers.error,
    reloadMembers: tripMembers.reload,
    expenses: tripExpenses.expenses,
    expensesError: tripExpenses.error,
    reloadExpenses: tripExpenses.reload,
    people,
    owing,
    currency,
    handleInvite,
    handleNewInviteLink,
    handleStopInviting,
    handleRemoveMember,
    handleLeaveTrip,
    handleSaveExpense,
    handleDeleteExpense,
    handleChangeCurrency,
  };
}
