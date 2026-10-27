"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_PATH, signIn, signOut } from "@/lib/adminAuth";

export async function login(_state, formData) {
  const username = String(formData.get("username") || "").trim().slice(0, 64);
  const password = String(formData.get("password") || "").slice(0, 256);
  const requestHeaders = await headers();
  const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() || requestHeaders.get("x-real-ip");
  const error = await signIn(username, password, clientIp);
  if (error) return { error, username };
  redirect(ADMIN_PATH);
}

export async function logout() {
  await signOut();
  redirect(ADMIN_PATH);
}
