"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="admin-login">
      <form className="admin-login-card" action={action}>
        <p className="admin-eyebrow">Roam</p>
        <h1>Admin</h1>
        <label className="admin-field">
          <span>User ID</span>
          <input name="username" autoComplete="username" required maxLength={64} defaultValue={state?.username} autoFocus />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required maxLength={256} />
        </label>
        {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
        <button type="submit" className="admin-primary" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
