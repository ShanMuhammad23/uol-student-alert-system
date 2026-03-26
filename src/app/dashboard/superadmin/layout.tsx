import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Sidebar } from "@/components/Layouts/sidebar";
import { getCurrentUser } from "@/app/(home)/dashboard/fetch";

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

  return (
    <div className="mt-4 flex min-h-[calc(100vh-10rem)] gap-4">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
