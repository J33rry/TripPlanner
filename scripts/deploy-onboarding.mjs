// Deploys the onboarding (welcome) email function, and the Brevo provider it sends through. Safe to re-run.
//
//   npm run deploy:onboarding
//
// Needs APPWRITE_API_KEY with functions.read/write (plus providers.read/write to set up Brevo),
// and ROAM_APP_URL for the email's "Plan your first trip" button.
// Set BREVO_SMTP_LOGIN, BREVO_SMTP_KEY and MAIL_FROM_EMAIL to create or update the Messaging provider;
// leave them out if one is already set up in the console.
// Reads NEXT_PUBLIC_APPWRITE_* and the rest from .env.local / .env when present.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, Functions, Messaging, Query, Runtime, SmtpEncryption } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const appUrl = process.env.ROAM_APP_URL;

if (!projectId || !apiKey || !appUrl) {
  console.error("Set NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY and ROAM_APP_URL first.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const functions = new Functions(client);
const messaging = new Messaging(client);

const functionId = "onboarding-email";
const source = "appwrite/functions/onboarding-email";

// Catch a key without the right scopes before changing anything.
const REQUIRED_SCOPES = ["functions.read", "functions.write", "providers.read", "providers.write"];
try {
  await Promise.all([functions.list({ queries: [Query.limit(1)] }), messaging.listProviders({ queries: [Query.limit(1)] })]);
} catch (error) {
  if (error?.type !== "general_unauthorized_scope") throw error;
  console.error(`✗ APPWRITE_API_KEY can't do this: ${error.message}`);
  console.error(`  In the Appwrite console → Overview → Integrations → API keys, give the key: ${REQUIRED_SCOPES.join(", ")}`);
  process.exit(1);
}

// ── Brevo as the Messaging email provider ───────────────────────────────────
const { BREVO_SMTP_LOGIN, BREVO_SMTP_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME = "Roam" } = process.env;
if (BREVO_SMTP_LOGIN && BREVO_SMTP_KEY && MAIL_FROM_EMAIL) {
  const provider = {
    providerId: "brevo",
    name: "Brevo",
    host: "smtp-relay.brevo.com",
    port: 587,
    username: BREVO_SMTP_LOGIN,
    password: BREVO_SMTP_KEY,
    encryption: SmtpEncryption.Tls,
    fromName: MAIL_FROM_NAME,
    fromEmail: MAIL_FROM_EMAIL,
    enabled: true,
  };
  try {
    await messaging.createSmtpProvider(provider);
    console.log("✓ created Brevo email provider");
  } catch (error) {
    if (error?.code !== 409) throw error;
    await messaging.updateSmtpProvider(provider);
    console.log("✓ updated Brevo email provider");
  }
} else {
  const { providers } = await messaging.listProviders();
  if (!providers.some((provider) => provider.type === "email" && provider.enabled)) {
    console.warn("! No enabled email provider in Messaging, so welcome emails can't send yet.");
    console.warn("  Set BREVO_SMTP_LOGIN, BREVO_SMTP_KEY and MAIL_FROM_EMAIL and re-run, or add one in the console.");
  }
}

// ── The function ───────────────────────────────────────────────────────────
const config = {
  functionId,
  name: "Roam onboarding email",
  runtime: Runtime.Node22,
  execute: [], // Events only; nobody can call it over HTTP.
  events: ["users.*.sessions.*.create"],
  timeout: 15,
  logging: true,
  entrypoint: "src/main.js",
  commands: "npm install --omit=dev",
  scopes: ["users.read", "users.write", "targets.read", "messages.write"],
};
try {
  await functions.get({ functionId });
  await functions.update(config);
  console.log(`✓ updated function "${functionId}"`);
} catch (error) {
  if (error?.code !== 404) throw error;
  await functions.create(config);
  console.log(`✓ created function "${functionId}"`);
}

const { variables } = await functions.listVariables({ functionId });
for (const [key, value] of Object.entries({ APP_URL: appUrl })) {
  const existing = variables.find((variable) => variable.key === key);
  if (existing) await functions.updateVariable({ functionId, variableId: existing.$id, key, value });
  else await functions.createVariable({ functionId, variableId: key.toLowerCase().replace(/_/g, "-"), key, value });
}
console.log(`✓ set APP_URL to ${appUrl}`);

// ── Upload and wait for the build ──────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), "roam-fn-"));
const archive = join(dir, "code.tar.gz");
try {
  // COPYFILE_DISABLE keeps macOS tar from adding ._ metadata files.
  execFileSync("tar", ["-czf", archive, "--exclude", "node_modules", "-C", source, "."], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  const deployment = await functions.createDeployment({
    functionId,
    code: InputFile.fromPath(archive, "code.tar.gz"),
    activate: true,
  });
  process.stdout.write("… building");
  for (let waited = 0; ; waited += 3) {
    const { status, buildLogs } = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
    if (status === "ready") break;
    if (status === "failed" || waited > 300) {
      console.error(`\n✗ build ${status === "failed" ? "failed" : "timed out"}\n${buildLogs || ""}`);
      process.exit(1);
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log("\n✓ deployed and active");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("New verified accounts now get the Roam welcome email on their first sign-in.");
