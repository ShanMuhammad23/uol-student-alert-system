"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { saveScrollBeforeFilterNav } from "@/app/(home)/dashboard/_components/FilterScrollPreserve";

export type SortKey = "attendance" | "gpa";
export type SortOrder = "asc" | "desc";

type Props = {
  sortKey: SortKey;
  currentSort: SortKey | null;
  currentOrder: SortOrder;
  className?: string;
  children: React.ReactNode;
};

function nextOrder(currentSort: SortKey | null, currentOrder: SortOrder, sortKey: SortKey): SortOrder {
  if (currentSort !== sortKey) return "asc";
  return currentOrder === "asc" ? "desc" : "asc";
}

function SortAscIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function SortDescIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SortBothIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}

export function SortableTableHead({
  sortKey,
  currentSort,
  currentOrder,
  className,
  children,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const order = nextOrder(currentSort, currentOrder, sortKey);
  const next = new URLSearchParams(searchParams);
  next.set("sort", sortKey);
  next.set("order", order);
  const href = `/?${next.toString()}`;
  const isActive = currentSort === sortKey;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    saveScrollBeforeFilterNav();
    router.replace(href, { scroll: false });
  };

  const SortIcon = isActive
    ? currentOrder === "asc"
      ? SortAscIcon
      : SortDescIcon
    : SortBothIcon;

  return (
    <TableHead className={cn("text-center", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-semibold uppercase hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 rounded w-full py-2",
          isActive && "text-primary"
        )}
        aria-label={isActive ? `Sorted by ${children} ${currentOrder === "asc" ? "ascending" : "descending"}. Click to sort ${currentOrder === "asc" ? "descending" : "ascending"}.` : `Sort by ${children}`}
      >
        {children}
        <SortIcon className={cn("shrink-0", !isActive && "opacity-50")} />
      </button>
    </TableHead>
  );
}
