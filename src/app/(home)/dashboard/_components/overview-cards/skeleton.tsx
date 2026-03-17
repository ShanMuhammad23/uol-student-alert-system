import { Skeleton } from "@/components/ui/skeleton";

export function OverviewCardsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark flex-1"
        >
          <Skeleton className="size-12 rounded-full" />

          <div className="mt-6 flex items-end justify-between">
            <div>
              <Skeleton className="mb-1.5 h-7 w-18" />

            </div>

            <Skeleton className="h-5 w-15" />
          </div>
        </div>
      ))}
    </div>
  );
}
