import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";
import { SuperadminDashboardShell } from "./_components/SuperadminDashboardShell";

export default async function SuperadminDashboardLayout({
  children,
}: PropsWithChildren) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  if (user.role !== "superadmin") {
    redirect("/dashboard");
  }

  return <SuperadminDashboardShell user={user}>{children}</SuperadminDashboardShell>;
}
