"use client";

import { useCallback, useEffect, useState } from "react";
import { listMembers } from "@/lib/tripStore";

/** The people on a trip's team (null while loading, or when there's no team yet). */
export function useTripMembers(teamId) {
  const [state, setState] = useState({ teamId: null, members: null, error: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    listMembers(teamId)
      .then((members) => { if (!cancelled) setState({ teamId, members, error: false }); })
      .catch((loadError) => {
        console.error("Couldn’t load trip members", loadError);
        if (!cancelled) setState((current) => ({ ...current, teamId, error: true }));
      });
    return () => { cancelled = true; };
  }, [teamId, version]);

  const current = state.teamId === teamId;
  return {
    members: current ? state.members : null,
    error: current && state.error,
    reload: useCallback(() => setVersion((n) => n + 1), []),
    forget: useCallback(
      (membershipId) => setState((s) => ({ ...s, members: s.members?.filter((m) => m.membershipId !== membershipId) ?? null })),
      []
    ),
  };
}
