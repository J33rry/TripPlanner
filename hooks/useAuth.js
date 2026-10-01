"use client";

import { useCallback, useEffect, useState } from "react";
import { ID, OAuthProvider } from "appwrite";
import { appwrite, appwriteConfigured } from "@/lib/appwrite";

// "Remember me" off: the account session outlives the browser, so a cookie
// with no expiry marks this browser session; once it's gone we sign out.
const SCOPE_KEY = "roam_session_scope";
const ALIVE_COOKIE = "roam_session_alive";

const ERROR_MESSAGES = {
  user_invalid_credentials: "That email and password don’t match.",
  user_already_exists: "There’s already an account with that email — try logging in.",
  user_blocked: "This account has been blocked.",
  password_personal_data: "Your password shouldn’t contain your name or email.",
  password_recently_used: "Pick a password you haven’t used recently.",
  user_not_found: "We couldn’t find an account with that email.",
  user_invalid_token: "This reset link has expired. Request a new one.",
  general_rate_limit_exceeded: "Too many attempts. Wait a minute and try again.",
  user_oauth2_unauthorized: "Google sign-in didn’t complete. Try again.",
};

export function authErrorMessage(error) {
  if (!appwriteConfigured) return "Sign-in isn’t set up yet — add your Appwrite project ID to .env.local.";
  if (ERROR_MESSAGES[error?.type]) return ERROR_MESSAGES[error.type];
  if (error?.type === "general_argument_invalid" && /password/i.test(error.message)) {
    return "Use a password of at least 8 characters.";
  }
  if (error?.code === 0 || error instanceof TypeError) return "We couldn’t reach the sign-in service. Check your connection.";
  return error?.message || "Something went wrong. Try again.";
}

function services() {
  if (!appwriteConfigured) throw new Error("Appwrite is not configured");
  return appwrite();
}

const hasAliveCookie = () => document.cookie.split("; ").some((part) => part.startsWith(`${ALIVE_COOKIE}=`));

function rememberSession(remember) {
  try {
    if (remember) localStorage.removeItem(SCOPE_KEY);
    else localStorage.setItem(SCOPE_KEY, "browser");
  } catch { }
  document.cookie = `${ALIVE_COOKIE}=1; path=/; SameSite=Lax`;
}

function sessionExpired() {
  try {
    return localStorage.getItem(SCOPE_KEY) === "browser" && !hasAliveCookie();
  } catch {
    return false;
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const refresh = useCallback(async () => {
    try {
      const account = await appwrite().account.get();
      setUser(account);
      setStatus("user");
      return account;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appwriteConfigured) {
        if (!cancelled) setStatus("guest");
        return;
      }
      if (sessionExpired()) {
        try { localStorage.removeItem(SCOPE_KEY); } catch { }
        await appwrite().account.deleteSession({ sessionId: "current" }).catch(() => {});
      }
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const startSession = useCallback(async (create, remember) => {
    try {
      await create();
    } catch (error) {
      // A stale session blocks a new one; it already belongs to someone, so drop it and retry.
      if (error?.type !== "user_session_already_exists") throw error;
      await appwrite().account.deleteSession({ sessionId: "current" }).catch(() => {});
      await create();
    }
    rememberSession(remember);
    return refresh();
  }, [refresh]);

  const login = useCallback(
    (email, password, remember = true) =>
      startSession(() => services().account.createEmailPasswordSession({ email, password }), remember),
    [startSession]
  );

  const signup = useCallback(async (name, email, password) => {
    await services().account.create({ userId: ID.unique(), email, password, name });
    return startSession(() => services().account.createEmailPasswordSession({ email, password }), true);
  }, [startSession]);

  /** Leaves the page: Appwrite → Google → /auth/callback, which calls finishOAuth. */
  const loginWithGoogle = useCallback((next = "/") => {
    const origin = window.location.origin;
    const query = `next=${encodeURIComponent(next)}`;
    services().account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success: `${origin}/auth/callback?${query}`,
      failure: `${origin}/login?error=oauth&${query}`,
    });
  }, []);

  const finishOAuth = useCallback(
    (userId, secret) => startSession(() => services().account.createSession({ userId, secret }), true),
    [startSession]
  );

  const logout = useCallback(async () => {
    await appwrite().account.deleteSession({ sessionId: "current" }).catch(() => {});
    try { localStorage.removeItem(SCOPE_KEY); } catch { }
    setUser(null);
    setStatus("guest");
  }, []);

  const sendRecovery = useCallback(
    (email) => services().account.createRecovery({ email, url: `${window.location.origin}/reset-password` }),
    []
  );

  const resetPassword = useCallback(
    (userId, secret, password) => services().account.updateRecovery({ userId, secret, password }),
    []
  );

  return { user, status, login, signup, loginWithGoogle, finishOAuth, logout, sendRecovery, resetPassword };
}
