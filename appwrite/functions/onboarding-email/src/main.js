// Sends the Roam welcome email the first time a verified user signs in.
//
// Triggered by users.*.sessions.*.create, which covers every way in: the signup code,
// Google and sign-in links. Deployed by `npm run deploy:onboarding`.
import { readFileSync } from "node:fs";
import { Client, ID, Messaging, Users } from "node-appwrite";

const TEMPLATE = readFileSync(new URL("./welcome.html", import.meta.url), "utf8");
const SUBJECT = "Welcome to Roam — let’s plan your first trip";
// Labels are server-only, so users can't clear this and get re-sent the email.
const WELCOMED = "welcomed";
const DAY_MS = 24 * 60 * 60 * 1000;

const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function renderWelcome(user, appUrl) {
  const firstName = (user.name || "").trim().split(/\s+/)[0];
  const values = {
    "{{greeting}}": firstName ? `Welcome to Roam, ${escapeHtml(firstName)}` : "Welcome to Roam",
    "{{appUrl}}": escapeHtml(appUrl),
  };
  return TEMPLATE.replace(/\{\{greeting\}\}|\{\{appUrl\}\}/g, (token) => values[token]);
}

function eventBody(req) {
  try {
    return req.bodyJson ?? {};
  } catch {
    return {};
  }
}

export default async function onboardingEmail({ req, res, log, error }) {
  const userId = eventBody(req).userId;
  if (!userId) return res.json({ skipped: "no user in event" });

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers["x-appwrite-key"]);
  const users = new Users(client);

  const user = await users.get({ userId });
  // Password logins to unverified accounts open a session briefly before the code step.
  if (!user.emailVerification) return res.json({ skipped: "email not verified" });
  if (user.labels.includes(WELCOMED)) return res.json({ skipped: "already welcomed" });

  const labels = [...user.labels, WELCOMED];
  // Accounts from before this function existed are marked, not emailed.
  const maxAgeDays = Number(process.env.WELCOME_MAX_AGE_DAYS || 7);
  if (Date.now() - Date.parse(user.registration) > maxAgeDays * DAY_MS) {
    await users.updateLabels({ userId, labels });
    return res.json({ skipped: "existing account" });
  }

  // Label first so two quick sign-ins can't both send; undo it if sending fails so the next sign-in retries.
  await users.updateLabels({ userId, labels });
  try {
    await new Messaging(client).createEmail({
      messageId: ID.unique(),
      subject: SUBJECT,
      content: renderWelcome(user, process.env.APP_URL || "https://roam.app"),
      users: [userId],
      html: true,
    });
  } catch (sendError) {
    await users.updateLabels({ userId, labels: user.labels }).catch(() => {});
    error(`Couldn’t send welcome email to ${userId}: ${sendError.message}`);
    throw sendError;
  }

  log(`Welcome email queued for ${userId}`);
  return res.json({ sent: true });
}
