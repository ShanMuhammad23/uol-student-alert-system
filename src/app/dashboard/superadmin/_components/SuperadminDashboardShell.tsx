"use client";

import type { PropsWithChildren } from "react";
import { Sidebar } from "@/components/Layouts/sidebar";
import { useSidebarContext } from "@/components/Layouts/sidebar/sidebar-context";
import { MenuIcon } from "@/components/Layouts/header/icons";
import type { AppUser } from "@/app/(home)/dashboard/fetch";

type SuperadminDashboardShellProps = PropsWithChildren<{
  user: AppUser;
}>;

export function SuperadminDashboardShell({
  user,
  children,
}: SuperadminDashboardShellProps) {
  const { isOpen, toggleSidebar } = useSidebarContext();

  return (
    <div className="-mx-8">
      <div className="relative flex min-h-[calc(100vh-5rem)] ">
        <Sidebar user={user} />

        {!isOpen && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="absolute left-4 top-4 z-30 rounded-lg border border-stroke bg-white px-2 py-1.5 text-dark shadow-1 transition hover:bg-gray-2 dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:hover:bg-white/10"
          >
            <span className="sr-only">Open sidebar</span>
            <MenuIcon className="size-5" />
          </button>
        )}

        <div className="min-w-0 flex-1 px-8 py-4 h-screen overflow-y-auto scrollbar-hide">{children}</div>
      </div>
    </div>
  );
}
