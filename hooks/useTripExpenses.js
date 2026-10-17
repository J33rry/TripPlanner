"use client";

import { useCallback, useEffect, useState } from "react";
import { listExpenses, watchExpenses } from "@/lib/expenseStore";

const upsert = (list, expense) => [...list.filter((item) => item.id !== expense.id), expense];

/**
 * A trip's expenses, kept live: changes anyone on the trip makes arrive over
 * Appwrite Realtime. `tripId` is null when the trip has no team, so no
 * expenses yet. `expenses` is null while loading.
 */
export function useTripExpenses(tripId) {
  const [state, setState] = useState({ tripId: null, expenses: null, error: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    const update = (change) => setState((s) => (s.tripId === tripId && s.expenses ? { ...s, expenses: change(s.expenses) } : s));
    const stop = watchExpenses(tripId, {
      onSave: (expense) => update((list) => upsert(list, expense)),
      onDelete: (id) => update((list) => list.filter((item) => item.id !== id)),
    });
    listExpenses(tripId)
      .then((expenses) => { if (!cancelled) setState({ tripId, expenses, error: false }); })
      .catch((loadError) => {
        console.error("Couldn’t load trip expenses", loadError);
        if (!cancelled) setState({ tripId, expenses: null, error: true });
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [tripId, version]);

  const current = state.tripId === tripId;
  return {
    expenses: tripId ? (current ? state.expenses : null) : [],
    error: current && state.error,
    reload: useCallback(() => setVersion((n) => n + 1), []),
    /** Shows a save or delete right away, before its realtime echo arrives. */
    applySaved: useCallback((expense) => setState((s) => (s.tripId === expense.tripId && s.expenses ? { ...s, expenses: upsert(s.expenses, expense) } : s)), []),
    applyDeleted: useCallback((id) => setState((s) => (s.expenses ? { ...s, expenses: s.expenses.filter((item) => item.id !== id) } : s)), []),
  };
}
