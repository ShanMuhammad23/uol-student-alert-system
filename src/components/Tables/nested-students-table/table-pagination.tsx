"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  baseSearchParams?: Record<string, string>;
};

function buildHref(
  pathname: string,
  params: Record<string, string>,
  page: number
): string {
  const search = new URLSearchParams({ ...params, page: String(page) });
  return `${pathname}?${search.toString()}`;
}

export function TablePagination({
  currentPage,
  totalPages,
  total,
  pageSize = PAGE_SIZE,
  baseSearchParams = {},
}: TablePaginationProps) {
  const pathname = usePathname();
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stroke px-1 pt-4 dark:border-stroke-dark">
      <p className="text-sm text-dark-6 dark:text-dark-5">
        Showing <span className="font-medium text-dark dark:text-white">{start}</span>
        {" – "}
        <span className="font-medium text-dark dark:text-white">{end}</span>
        {" of "}
        <span className="font-medium text-dark dark:text-white">{total}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Table pagination">
        <Link
          href={currentPage <= 1 ? buildHref(pathname, baseSearchParams, 1) : buildHref(pathname, baseSearchParams, currentPage - 1)}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center rounded border border-stroke px-3 text-sm font-medium transition-colors dark:border-stroke-dark",
            currentPage <= 1
              ? "pointer-events-none border-stroke bg-gray-2 text-dark-6 dark:bg-gray-dark-2 dark:text-dark-5"
              : "bg-white text-dark hover:bg-gray-2 dark:bg-gray-dark dark:text-white dark:hover:bg-gray-dark-2"
          )}
          aria-disabled={currentPage <= 1}
        >
          Previous
        </Link>
        <span className="flex items-center gap-1 px-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true;
              if (p === 1 || p === totalPages) return true;
              if (Math.abs(p - currentPage) <= 1) return true;
              return false;
            })
            .map((p, i, arr) => {
              const showEllipsisBefore = i > 0 && p - arr[i - 1]! > 1;
              return (
                <span key={p} className="flex items-center gap-1">
                  {showEllipsisBefore && (
                    <span className="h-9 w-9 text-center leading-9 text-dark-6">…</span>
                  )}
                  <Link
                    href={buildHref(pathname, baseSearchParams, p)}
                    className={cn(
                      "inline-flex h-9 min-w-9 items-center justify-center rounded border text-sm font-medium transition-colors",
                      p === currentPage
                        ? "border-primary bg-primary text-white"
                        : "border-stroke bg-white text-dark hover:bg-gray-2 dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:hover:bg-gray-dark-2"
                    )}
                  >
                    {p}
                  </Link>
                </span>
              );
            })}
        </span>
        <Link
          href={currentPage >= totalPages ? buildHref(pathname, baseSearchParams, totalPages) : buildHref(pathname, baseSearchParams, currentPage + 1)}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center rounded border border-stroke px-3 text-sm font-medium transition-colors dark:border-stroke-dark",
            currentPage >= totalPages
              ? "pointer-events-none border-stroke bg-gray-2 text-dark-6 dark:bg-gray-dark-2 dark:text-dark-5"
              : "bg-white text-dark hover:bg-gray-2 dark:bg-gray-dark dark:text-white dark:hover:bg-gray-dark-2"
          )}
          aria-disabled={currentPage >= totalPages}
        >
          Next
        </Link>
      </nav>
    </div>
  );
}
