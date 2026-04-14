export function toNonNegativeNumber(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

export function calculateMissingAttendance(
  totalClassesHeld: number | null | undefined,
  attendanceMarkedClasses: number | null | undefined
): number {
  const held = toNonNegativeNumber(totalClassesHeld);
  const marked = toNonNegativeNumber(attendanceMarkedClasses);
  return Math.max(held - marked, 0);
}
