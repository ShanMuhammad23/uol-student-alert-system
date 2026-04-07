import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TOP_CHANNELS_TABLE_SCROLL_ID } from "./table-scroll-anchor";

type SkeletonProps = { className?: string };

export function TopChannelsSkeleton({ className }: SkeletonProps = {}) {
  return (
    <div
      id={TOP_CHANNELS_TABLE_SCROLL_ID}
      className={cn(
        "scroll-mt-24 mb-12 rounded-[10px] bg-white px-7.5 pb-4 pt-7.5 shadow-1 dark:bg-gray-dark dark:shadow-card",
        className,
      )}
    >
  

      <Table>
        <TableHeader>
          <TableRow className="border-none uppercase [&>th]:text-center">
            <TableHead className="!text-left">Name - SAPID</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Classes Held</TableHead>
            <TableHead>Classes Attended</TableHead>
            <TableHead>Absent</TableHead>
            <TableHead>Attendance Percentage</TableHead>
            <TableHead>GPA</TableHead>
            <TableHead>Intervention Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={100}>
                <Skeleton className="h-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
