import Link from "next/link";
import {
  BookUser,
  LineChart,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StaffTab = "directory" | "add" | "unregistered" | "login-trend";

const TABS: {
  id: StaffTab;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "directory",
    href: "?tab=directory",
    label: "Directory",
    description: "Registered staff accounts",
    icon: BookUser,
  },
  {
    id: "unregistered",
    href: "?tab=unregistered",
    label: "Unregistered",
    description: "Instructors not yet granted access",
    icon: UserX,
  },
  {
    id: "login-trend",
    href: "?tab=login-trend",
    label: "Login Trend",
    description: "Staff login activity",
    icon: LineChart,
  },
  {
    id: "add",
    href: "?tab=add",
    label: "Add Staff",
    description: "Create a new staff account",
    icon: UserPlus,
  },
];

export function StaffTabs({ activeTab }: { activeTab: StaffTab }) {
  return (
    <nav
      aria-label="Staff sections"
      className="w-full overflow-x-auto scrollbar-hide"
    >
      <div
        className={cn(
          "inline-flex min-w-full gap-1 rounded-2xl border p-1.5",
          "border-slate-200/80 bg-slate-100/80",
          "shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]",
          "dark:border-white/10 dark:bg-white/[0.04]",
          "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
        )}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              title={tab.description}
              className={cn(
                "group relative inline-flex min-h-11 min-w-[9.5rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium outline-none transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-gray-dark",
                isActive
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-slate-900 dark:text-white dark:ring-white/10"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                )}
              />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
