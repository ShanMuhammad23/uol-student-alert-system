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
  /** Optional course code + section for deep-linking into course attendance on student page. */
  courseCode?: string | null;
  section?: string | null;
};

/**
 * Link to student profile that preserves the current homepage URL (filters, expanded sections)
 * in the ?from= param so "Back to list" on the student page returns to the same state.
 */
export function StudentProfileLink({
  sapId,
  returnToUrl,
  children,
  className,
  title,
  courseCode,
  section,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl =
    pathname === "/"
      ? pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")
      : returnToUrl;
  const params = new URLSearchParams();
  params.set("from", currentUrl);
  if (courseCode) params.set("course", courseCode);
  if (section) params.set("section", section);
  const href = `/students/${sapId}?${params.toString()}`;

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
