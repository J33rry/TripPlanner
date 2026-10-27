import { connection } from "next/server";
import { notFound } from "next/navigation";
import { currentAdmin } from "@/lib/adminAuth";
import { loadDashboard } from "@/lib/adminData";
import { adminConfigured } from "@/lib/adminStore";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";

export default async function AdminPage({ searchParams }) {
  await connection();
  // Without the admin key the page doesn't exist at all.
  if (!adminConfigured()) notFound();
  const admin = await currentAdmin();
  if (!admin) return <AdminLogin />;
  const { range } = await searchParams;
  return <AdminDashboard admin={admin} data={await loadDashboard(range)} />;
}
