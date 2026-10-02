"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { safeNext, useRoam } from "./RoamShell";
import { ArrowIcon, EyeIcon, EyeOffIcon, GoogleIcon, LockIcon, MailIcon, UserIcon } from "./icons";
import { authErrorMessage } from "@/hooks/useAuth";

const MODES = { "/login": "login", "/signup": "signup", "/reset-password": "reset", "/auth/callback": "callback" };
// Which side the card sits on; the globe takes the other (see homeLayout in DestinationGlobe).
const SIDE = { login: "left", reset: "left", callback: "left", signup: "right" };
const HEADLINES = { left: ["Pick up where your", "curiosity left off"], right: ["Your next journey", "starts here"] };
const LEAVE_MS = 320;

function Field({ label, icon, trailing, ...input }) {
  return (
    <label className="auth-field">
      <span className="auth-label">{label}</span>
      <span className="auth-input">
        <span className="auth-input-icon" aria-hidden="true">{icon}</span>
        <input {...input} />
        {trailing}
      </span>
    </label>
  );
}

export default function AuthScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { auth, completeAuth, pendingTrip, resumePendingTrip } = useRoam();
  const mode = MODES[pathname] || "login";

  // The outgoing card slides off before the incoming one slides in from the other side.
  const [shown, setShown] = useState(mode);
  if (shown !== mode && SIDE[shown] === SIDE[mode]) setShown(mode);
  const leaving = shown !== mode;
  useEffect(() => {
    if (!leaving) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => setShown(mode), reduced ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving, mode]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [oauthErrorSeen, setOauthErrorSeen] = useState(false);

  const next = params.get("next");
  const carry = next ? `?next=${encodeURIComponent(next)}` : "";
  const recovery = mode === "reset" && params.get("userId") && params.get("secret")
    ? { userId: params.get("userId"), secret: params.get("secret") }
    : null;
  // Signup, or logging in to an unverified account, pauses here until the emailed code is entered.
  const [codeStep, setCodeStep] = useState(null);
  const [code, setCode] = useState("");
  const viaLink = params.get("method") === "link";
  const shownError = error || (mode === "login" && params.get("error") === "oauth" && !oauthErrorSeen
    ? "Google sign-in didn’t complete. Try again."
    : "");

  const [modeSeen, setModeSeen] = useState(mode);
  if (modeSeen !== mode) {
    setModeSeen(mode);
    setError("");
    setOauthErrorSeen(true);
    setPassword("");
    setShowPassword(false);
    setCodeStep(null);
    setCode("");
    if (mode !== "login") setNotice("");
  }

  // Already signed in: auth pages have nothing to offer.
  useEffect(() => {
    if (auth.status === "user" && !busy && (mode === "login" || mode === "signup")) router.replace(safeNext(next));
  }, [auth.status, busy, mode, next, router]);

  const handledCallback = useRef(false);
  useEffect(() => {
    if (mode !== "callback" || handledCallback.current) return;
    handledCallback.current = true;
    (async () => {
      try {
        const userId = params.get("userId");
        const secret = params.get("secret");
        if (!userId || !secret) {
          throw new Error(viaLink ? "This sign-in link is incomplete. Request a new one." : "Google sign-in didn’t complete. Try again.");
        }
        const account = await auth.finishTokenLogin(userId, secret);
        await completeAuth(account, next);
      } catch (callbackError) {
        setError(viaLink && callbackError?.type === "user_not_found"
          ? "This sign-in link isn’t valid. Request a new one."
          : authErrorMessage(callbackError));
      }
    })();
  }, [mode, params, auth, completeAuth, next, viaLink]);

  const run = async (kind, action, messageFor = authErrorMessage) => {
    setError("");
    setOauthErrorSeen(true);
    setBusy(kind);
    try {
      await action();
    } catch (actionError) {
      setError(messageFor(actionError));
      setBusy(null);
    }
  };

  const continueWithGoogle = () => run("google", async () => auth.loginWithGoogle(safeNext(next)));

  /** Login and signup either finish, or hand over to the code step. */
  const proceed = async ({ account, verify }) => {
    if (!verify) return completeAuth(account, next);
    setCodeStep(verify);
    setCode("");
    setNotice("");
    setBusy(null);
  };

  const resendCode = () => run("resend", async () => {
    await auth.sendCode(codeStep.userId, codeStep.email, codeStep.remember);
    setCode("");
    setBusy(null);
    setNotice(`We sent a new code to ${codeStep.email}.`);
  });

  const sendSignInLink = (event) => {
    if (busy || !event.currentTarget.form.reportValidity()) return;
    const cleanEmail = email.trim();
    run("link", async () => {
      await auth.sendSignInLink(cleanEmail, safeNext(next));
      setBusy(null);
      setNotice(`Check ${cleanEmail} for a sign-in link. It works once and expires in an hour.`);
    });
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim();
    if (codeStep && (shown === "login" || shown === "signup")) {
      run(
        "email",
        async () => completeAuth(await auth.verifyCode(codeStep.userId, code, codeStep.remember), next),
        (codeError) => codeError?.type === "user_invalid_token"
          ? "That code isn’t right or has expired. Check it, or send a new one."
          : authErrorMessage(codeError)
      );
    } else if (shown === "login") {
      run("email", async () => proceed(await auth.login(cleanEmail, password, remember)));
    } else if (shown === "signup") {
      run("email", async () => proceed(await auth.signup(name.trim(), cleanEmail, password)));
    } else if (recovery) {
      run("email", async () => {
        await auth.resetPassword(recovery.userId, recovery.secret, password);
        setBusy(null);
        setNotice("Password updated — log in with your new password.");
        router.replace("/login");
      });
    } else {
      run("email", async () => {
        await auth.sendRecovery(cleanEmail);
        setBusy(null);
        setNotice(`If ${cleanEmail} has a Roam account, a reset link is on its way.`);
      });
    }
  };

  const passwordField = (placeholder, autoComplete) => (
    <Field
      label="Password"
      icon={<LockIcon />}
      type={showPassword ? "text" : "password"}
      value={password}
      onChange={(event) => setPassword(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      minLength={autoComplete === "new-password" ? 8 : undefined}
      required
      trailing={(
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      )}
    />
  );
  const emailField = (
    <Field
      label="Email address"
      icon={<MailIcon />}
      type="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
      placeholder="you@yourmail.com"
      autoComplete="email"
      required
    />
  );
  const submitButton = (label) => (
    <button type="submit" className="dark-pill auth-submit" disabled={Boolean(busy)}>
      {busy === "email" ? <span className="spinner" aria-label="Working" /> : <>{label} <ArrowIcon /></>}
    </button>
  );
  const googleButton = (
    <button type="button" className="google-button" onClick={continueWithGoogle} disabled={Boolean(busy)}>
      {busy === "google" ? <span className="spinner is-dark" aria-label="Opening Google" /> : <GoogleIcon />}
      Continue with Google
    </button>
  );
  const messages = (
    <>
      {shownError && <p className="auth-message is-error" role="alert">{shownError}</p>}
      {notice && !shownError && <p className="auth-message" role="status">{notice}</p>}
    </>
  );
  const pendingNote = pendingTrip && (shown === "login" || shown === "signup") && (
    <div className="auth-pending">
      <span>{shown === "login" ? "Log in" : "Create an account"} to save <strong>{pendingTrip.tripTitle}</strong>.</span>
      <button type="button" onClick={resumePendingTrip}>Back to trip</button>
    </div>
  );

  let body;
  if (shown === "callback") {
    body = (
      <>
        <h1 id="auth-title">{shownError ? "Sign-in didn’t finish" : "Signing you in…"}</h1>
        <p className="auth-sub">
          {shownError
            ? "Nothing was changed. You can try again."
            : viaLink ? "Hold tight — checking your sign-in link." : "Hold tight — connecting your Google account."}
        </p>
        {shownError ? (
          <>
            {messages}
            <Link href={viaLink ? `/reset-password${carry}` : `/login${carry}`} className="dark-pill auth-submit">
              {viaLink ? "Get a new link" : "Back to log in"} <ArrowIcon />
            </Link>
          </>
        ) : (
          <div className="auth-waiting"><span className="spinner is-dark" /></div>
        )}
      </>
    );
  } else if (codeStep && (shown === "login" || shown === "signup")) {
    body = (
      <>
        <h1 id="auth-title">Check your email</h1>
        <p className="auth-sub">
          Enter the 6-digit code we sent to <strong>{codeStep.email}</strong>. It expires in 15 minutes.
        </p>
        <form className="auth-form" onSubmit={submit}>
          <Field
            label="Verification code"
            icon={<MailIcon />}
            className="auth-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            title="Enter the 6-digit code from the email"
            placeholder="000000"
            required
            autoFocus
          />
          {messages}
          {submitButton(shown === "signup" ? "Verify and create account" : "Verify and log in")}
        </form>
        <p className="auth-switch">
          Didn’t get it?
          <button type="button" className="auth-text-button" onClick={resendCode} disabled={Boolean(busy)}>
            {busy === "resend" ? "Sending…" : "Send a new code"}
          </button>
          <span aria-hidden="true"> · </span>
          <button type="button" className="auth-text-button" onClick={() => { setCodeStep(null); setError(""); setNotice(""); }} disabled={Boolean(busy)}>
            Use a different email
          </button>
        </p>
      </>
    );
  } else if (shown === "reset") {
    body = (
      <>
        <h1 id="auth-title">{recovery ? "Choose a new password" : "Reset your password"}</h1>
        <p className="auth-sub">
          {recovery ? "Make it at least 8 characters." : "We’ll email you a link to choose a new one, or one that just signs you in."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {recovery ? passwordField("New password", "new-password") : emailField}
          {messages}
          {submitButton(recovery ? "Update password" : "Send reset link")}
          {!recovery && (
            <button type="button" className="google-button auth-link-button" onClick={sendSignInLink} disabled={Boolean(busy)}>
              {busy === "link" ? <span className="spinner is-dark" aria-label="Sending link" /> : <MailIcon />}
              Email me a sign-in link
            </button>
          )}
        </form>
        <p className="auth-switch">Remembered it? <Link href={`/login${carry}`}>Log in</Link></p>
      </>
    );
  } else if (shown === "signup") {
    body = (
      <>
        {pendingNote}
        <h1 id="auth-title">Plan your next great escape</h1>
        <p className="auth-sub">Create an account to save trips and make every day count.</p>
        {googleButton}
        <div className="auth-divider"><span>or sign up with email</span></div>
        <form className="auth-form" onSubmit={submit}>
          <Field
            label="Full name"
            icon={<UserIcon />}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            maxLength={128}
            required
          />
          {emailField}
          {passwordField("Create a password", "new-password")}
          {messages}
          {submitButton("Create account")}
          <p className="auth-legal">By continuing, you agree to Roam’s Terms and Privacy Policy.</p>
        </form>
        <p className="auth-switch">Already have an account? <Link href={`/login${carry}`}>Log in</Link></p>
      </>
    );
  } else {
    body = (
      <>
        {pendingNote}
        <h1 id="auth-title">Welcome back</h1>
        <p className="auth-sub">Your next adventure is waiting.</p>
        {googleButton}
        <div className="auth-divider"><span>or log in with email</span></div>
        <form className="auth-form" onSubmit={submit}>
          {emailField}
          {passwordField("Your password", "current-password")}
          <div className="auth-row">
            <label className="auth-check">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Remember me</span>
            </label>
            <Link href={`/reset-password${carry}`}>Forgot password?</Link>
          </div>
          {messages}
          {submitButton("Log in")}
        </form>
        <p className="auth-switch">New to roam? <Link href={`/signup${carry}`}>Create an account</Link></p>
      </>
    );
  }

  const side = SIDE[shown];
  return (
    <div className={`auth-ui side-${side} ${leaving ? "is-leaving" : ""}`}>
      <section key={side} className={`auth-card mode-${shown}`} aria-labelledby="auth-title">
        <div key={shown} className="auth-card-body">{body}</div>
      </section>
      <p key={`headline-${side}`} className="auth-headline" aria-hidden="true">
        {HEADLINES[side][0]}<br />{HEADLINES[side][1]}<span className="auth-dot">.</span>
      </p>
    </div>
  );
}
