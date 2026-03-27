import Link from "next/link";
import { getInstructorCourseStats } from "../fetch";
import type { AppUser } from "../fetch";
import { cn } from "@/lib/utils";

type PropsType = {
  user: AppUser | null;
  selectedCourseId?: string;
};

function buildCourseUrl(courseId: string): string {
  const params = new URLSearchParams({ selected_alert: "all", course: courseId });
  return `/?${params.toString()}`;
}

export async function InstructorCourseStats({
  user,
  selectedCourseId,
}: PropsType) {
  if (!user || user.role !== "teacher") return null;

  const stats = await getInstructorCourseStats(user, {
    ...(selectedCourseId ? { courseIds: [selectedCourseId] } : {}),
  });
  if (!stats.length) return null;

  return (
    <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2">
      {stats.map((c) => (
        <Link
          key={c.courseId}
          href={buildCourseUrl(c.courseId)}
          className={cn(
            "inline-flex bg-white flex-col rounded-lg border border-stroke px-4 py-3 shadow-1 dark:bg-gray-dark transition hover:border-primary/50 hover:shadow dark:border-stroke-dark dark:hover:border-primary/50",
            "min-w-[160px]",
            selectedCourseId === c.courseId && "border-2 border-primary dark:border-primary"
          )}
        >
          <span className="text-body-sm font-semibold text-dark dark:text-white">
            {c.courseName}{" "}
            <span className="text-body-base dark:text-dark-5">({c.total})</span>
          </span>
          <span className="text-body-base text-dark-6 space-x-2 dark:text-dark-5">
            Att:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", c.yellowAttendance > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {c.yellowAttendance}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", c.redAttendance > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{c.redAttendance}</span>
            {" · "}
            GPA:{" "}
            <span className={cn("text-amber-500 dark:text-amber-500 font-bold", c.yellowGpa > 0 ? "text-amber-500 dark:text-amber-500" : "text-gray-600 dark:text-gray-400")}>
              {c.yellowGpa}
            </span>
            {" | "}
            <span className={cn("text-red-500 font-bold", c.redGpa > 0 ? "text-red-500" : "text-gray-600 dark:text-gray-400")}>{c.redGpa}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
