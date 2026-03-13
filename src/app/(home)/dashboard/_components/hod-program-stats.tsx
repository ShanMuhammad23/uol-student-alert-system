import Link from "next/link";
import { getHodProgramStats } from "../fetch";
import type { AppUser } from "../fetch";
import { cn } from "@/lib/utils";

type PropsType = {
  user: AppUser | null;
  selectedProgramId?: string;
  /** When set, these programs are shown as selected (bordered) from MasterFilter. */
  masterFilterProgramIds?: string[];
};

function buildProgramUrl(programId: string, departmentIds: string[]): string {
  const params = new URLSearchParams({ selected_alert: "all", program: programId });
  if (departmentIds.length) params.set("department", departmentIds.join(","));
  return `/?${params.toString()}`;
}

export async function HodProgramStats({
  user,
  selectedProgramId,
  masterFilterProgramIds,
}: PropsType) {
  if (!user || user.role !== "hod" || !user.department_ids?.length) return null;

  const stats = await getHodProgramStats(user.department_ids);
  if (!stats.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((p) => {
        const isSelected =
          (masterFilterProgramIds?.length
            ? masterFilterProgramIds.includes(p.programId)
            : selectedProgramId === p.programId);
        return (
          <Link
            key={p.programId}
            href={buildProgramUrl(p.programId, user.department_ids ?? [])}
            className={cn(
              "inline-flex bg-white flex-col rounded-lg border px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
              "min-w-[160px]",
              isSelected
                ? "border-2 border-primary dark:border-primary"
                : "border-stroke"
            )}
          >
            <span className="text-body-sm font-semibold text-dark dark:text-white">
              {p.programId} <span className="text-body-base dark:text-dark-5">({p.total})</span>
            </span>
            <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
              Att: <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>{p.yellowAttendance}</span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{p.redAttendance}</span>
              {" · "}
              GPA: <span className={cn("text-amber-500 dark:text-amber-500 font-bold", p.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>{p.yellowGpa}</span>
              {" | "}
              <span className={cn("text-red-500 font-bold", p.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{p.redGpa}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
