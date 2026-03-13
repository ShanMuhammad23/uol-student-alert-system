"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TableHead } from "@/components/ui/table";
import { saveScrollBeforeFilterNav } from "@/app/(home)/dashboard/_components/FilterScrollPreserve";

export function ClearSortButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort");
  const hasSort = sort === "attendance" || sort === "gpa";

  if (!hasSort) return <TableHead className="w-0 min-w-0 p-0" />;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    saveScrollBeforeFilterNav();
    const next = new URLSearchParams(searchParams);
    next.delete("sort");
    next.delete("order");
    const href = next.toString() ? `/?${next.toString()}` : "/";
    router.replace(href, { scroll: false });
  };

  return (
    <TableHead className="min-w-[60px] !text-center align-middle">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-dark-6 hover:bg-gray-100 hover:text-dark dark:text-dark-5 dark:hover:bg-dark-3 dark:hover:text-white"
        aria-label="Clear sort and restore default order"
      >
        Clear
      </button>
    </TableHead>
  );
}
