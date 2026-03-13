import Link from "next/link";
import { getHodInstructorStats } from "../fetch";
import type { AppUser } from "../fetch";
import { cn } from "@/lib/utils";

type PropsType = {
  user: AppUser | null;
  selectedProgramId?: string;
  selectedInstructorId?: string;
};

function buildInstructorUrl(
  instructorId: string,
  departmentIds: string[],
  programId?: string
): string {
  const params = new URLSearchParams({ selected_alert: "all", instructor: instructorId });
  if (departmentIds.length) params.set("department", departmentIds.join(","));
  if (programId) params.set("program", programId);
  return `/?${params.toString()}`;
}

export async function HodInstructorStats({
  user,
  selectedProgramId,
  selectedInstructorId,
}: PropsType) {
  if (!user || user.role !== "hod" || !user.department_ids?.length) return null;

  const stats = await getHodInstructorStats(user.department_ids, {
    ...(selectedInstructorId ? { instructorIds: [selectedInstructorId] } : {}),
    ...(selectedProgramId ? { programIds: [selectedProgramId] } : {}),
  });
  if (!stats.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {stats.map((i) => (
        <Link
          key={i.instructorId}
          href={buildInstructorUrl(i.instructorId, user.department_ids ?? [], selectedProgramId)}
          className={cn(
            "inline-flex bg-white flex-col rounded-lg border border-stroke px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
            "min-w-[160px]"
          )}
        >
          <span className="text-body-sm font-semibold text-dark dark:text-white">
            {i.instructorName}{" "}
            <span className="text-body-base dark:text-dark-5">({i.total})</span>
          </span>
          <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
            Att:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", i.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {i.yellowAttendance}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", i.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{i.redAttendance}</span>
            {" · "}
            GPA:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", i.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {i.yellowGpa}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", i.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{i.redGpa}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
