"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  sapId: string;
  returnToUrl: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

/**
 * Link to student profile that preserves the current homepage URL (filters, expanded sections)
 * in the ?from= param so "Back to list" on the student page returns to the same state.
 */
export function StudentProfileLink({ sapId, returnToUrl, children, className, title }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl =
    pathname === "/"
      ? pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")
      : returnToUrl;
  const href = `/students/${sapId}?from=${encodeURIComponent(currentUrl)}`;

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
