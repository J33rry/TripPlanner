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
  signup_email_taken: "That email already has a Roam account. Log in, or use Continue with Google if that’s how you signed up.",
  user_blocked: "This account has been blocked.",
  password_personal_data: "Your password shouldn’t contain your name or email.",
  password_recently_used: "Pick a password you haven’t used recently.",
  user_not_found: "We couldn’t find an account with that email.",
  user_invalid_token: "This link has expired or was already used. Request a new one.",
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

const dropSession = () => appwrite().account.deleteSession({ sessionId: "current" }).catch(() => {});

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

/** Runs a session-creating call; a stale session blocks a new one, so drop it and retry. */
async function openSession(create) {
  try {
    await create();
  } catch (error) {
    if (error?.type !== "user_session_already_exists") throw error;
    await dropSession();
    await create();
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const refresh = useCallback(async () => {
    let account = await appwrite().account.get().catch(() => null);
    // Only verified emails count as signed in; anything else must finish the code step first.
    if (account && !account.emailVerification) {
      await dropSession();
      account = null;
    }
    setUser(account);
    setStatus(account ? "user" : "guest");
    return account;
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
        await dropSession();
      }
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const startSession = useCallback(async (create, remember) => {
    await openSession(create);
    rememberSession(remember);
    return refresh();
  }, [refresh]);

  /** Emails a 6-digit code; entering it signs in and marks the email verified. */
  const sendCode = useCallback(async (userId, email, remember = true) => {
    await services().account.createEmailToken({ userId, email });
    return { userId, email, remember };
  }, []);

  const verifyCode = useCallback(
    (userId, code, remember = true) => startSession(() => services().account.createSession({ userId, secret: code }), remember),
    [startSession]
  );

  /** Resolves to { account } once signed in, or { verify } when the email still needs its code. */
  const login = useCallback(async (email, password, remember = true) => {
    await openSession(() => services().account.createEmailPasswordSession({ email, password }));
    const account = await services().account.get();
    if (!account.emailVerification) {
      await dropSession();
      return { verify: await sendCode(account.$id, account.email, remember) };
    }
    rememberSession(remember);
    return { account: await refresh() };
  }, [refresh, sendCode]);

  /** No session until the emailed code is entered, so every account starts verified. */
  const signup = useCallback(async (name, email, password) => {
    let account;
    try {
      account = await services().account.create({ userId: ID.unique(), email, password, name });
    } catch (error) {
      // Appwrite 2.x answers a taken email with a generic bad request rather than user_already_exists.
      if (error?.type !== "user_already_exists" && error?.type !== "general_bad_request") throw error;
      // Usually a signup that never got its code: the same password picks it back up.
      return login(email, password).catch((loginError) => {
        if (loginError?.type !== "user_invalid_credentials") throw loginError;
        throw Object.assign(new Error("Email already registered"), { type: "signup_email_taken" });
      });
    }
    return { verify: await sendCode(account.$id, account.email) };
  }, [login, sendCode]);

  /** Leaves the page: Appwrite → Google → /auth/callback, which calls finishTokenLogin. */
  const loginWithGoogle = useCallback((next = "/") => {
    const origin = window.location.origin;
    const query = `next=${encodeURIComponent(next)}`;
    services().account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success: `${origin}/auth/callback?${query}`,
      failure: `${origin}/login?error=oauth&${query}`,
    });
  }, []);

  /** Emails a one-time sign-in link that lands on /auth/callback, like Google does. */
  const sendSignInLink = useCallback((email, next = "/") => {
    const query = `method=link&next=${encodeURIComponent(next)}`;
    return services().account.createMagicURLToken({
      userId: ID.unique(),
      email,
      url: `${window.location.origin}/auth/callback?${query}`,
    });
  }, []);

  const finishTokenLogin = useCallback(
    (userId, secret) => startSession(() => services().account.createSession({ userId, secret }), true),
    [startSession]
  );

  const logout = useCallback(async () => {
    await dropSession();
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

  return {
    user, status, login, signup, sendCode, verifyCode, loginWithGoogle, sendSignInLink, finishTokenLogin, logout,
    sendRecovery, resetPassword,
  };
}
