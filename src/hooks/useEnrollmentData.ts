import { useQuery } from "@tanstack/react-query";
import type { EnrollmentRecord } from "@/lib/enrollment";

const ENROLLMENT_QUERY_KEY = ["enrollment"] as const;
const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes TTL
const GC_TIME_MS = 10 * 60 * 1000; // 10 minutes cache retention

async function fetchEnrollment(): Promise<EnrollmentRecord[]> {
  const res = await fetch("/api/enrollment", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Enrollment fetch failed: ${res.status}`);
  }
  const raw = await res.json();
  return Array.isArray(raw) ? raw : [];
}

export function useEnrollmentData() {
  return useQuery({
    queryKey: ENROLLMENT_QUERY_KEY,
    queryFn: fetchEnrollment,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}
