"use client";
import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import type { JSX } from "react";
import * as icons from "./icons";
import Link from "next/link";

type PropsType = {
  label: string;
  titleHref: string;
  data: {
    value?: number | string;
    /** Yellow | Red counts in one card (e.g. GPA or Attendance) */
    yellow?: number;
    red?: number;
    grossYellow?: number;
    grossRed?: number;
    growthRate?: number;
  };
  isActive?: boolean;
  user?: unknown;
  masterFilter?: unknown;
  gpaFilters?: unknown;
  attendanceFilters?: unknown;
  yellowActive?: boolean;
  redActive?: boolean;
  onYellowClick?: () => void;
  onRedClick?: () => void;
};

export function OverviewCard({
  label,
  titleHref,
  data,
  isActive,
  yellowActive,
  redActive,
  onYellowClick,
  onRedClick,
}: PropsType) {
  const hasGrowth = data.growthRate !== undefined;
  const isDecreasing = hasGrowth && data.growthRate! < 0;
  const hasYellowRed = data.yellow !== undefined && data.red !== undefined;

  return (
    <div
      className={cn(
        "flex justify-between h-full flex-1 md:min-w-[240px]",
        isActive && "ring-0"
      )}
    >
      <div>
        <Link
          href={titleHref}
          scroll={false}
          className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <dd className="text-xl font-bold text-dark dark:text-white hover:underline">
            {label}
          </dd>
        </Link>

        <div className="mt-6 flex items-end justify-between">
          <dl>
            {hasYellowRed ? (
              <dt className="mb-1.5 flex items-center gap-4 text-heading-4 font-bold">
                <button
                  type="button"
                  onClick={onYellowClick}
                  className={cn(
                    "rounded px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    data.yellow! > 0
                      ? "text-yellow-400 dark:text-yellow-400 hover:bg-yellow-400/10 cursor-pointer"
                      : "text-gray-600 dark:text-gray-400 cursor-default",
                    yellowActive &&
                      "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                  )}
                  aria-pressed={yellowActive}
                  aria-label="Show intervention breakdown for yellow GPA alerts"
                  disabled={data.yellow === 0}
                >
                  {data.yellow}
                  {data.grossYellow !== undefined && (
                    <span className="block text-base font-medium text-yellow-400 dark:text-yellow-400">
                      {data.grossYellow}
                    </span>
                  )}
                </button>
                <span className="text-dark-4 dark:text-dark-5" aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  onClick={onRedClick}
                  className={cn(
                    "rounded px-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    data.red! > 0
                      ? "text-red-600 dark:text-red-600 hover:bg-red-600/10 cursor-pointer"
                      : "text-grey-600 dark:text-white cursor-default",
                    redActive &&
                      "ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-dark rounded-md"
                  )}
                  aria-pressed={redActive}
                  aria-label="Show intervention breakdown for red GPA alerts"
                  disabled={data.red === 0}
                >
                  {data.red}
                  {data.grossRed !== undefined && (
                    <span className="block text-base font-medium text-red-600 dark:text-red-600">
                      {data.grossRed}
                    </span>
                  )}
                </button>
              </dt>
            ) : (
              <dt className="mb-1.5 text-heading-6 font-bold text-dark dark:text-white">
                {data.value}
              </dt>
            )}
          </dl>
          {hasGrowth && (
            <dl
              className={cn(
                "text-sm font-medium",
                isDecreasing ? "text-red" : "text-green"
              )}
            >
              <dt className="flex items-center gap-1.5">
                {data.growthRate}%
                {isDecreasing ? (
                  <ArrowDownIcon aria-hidden />
                ) : (
                  <ArrowUpIcon aria-hidden />
                )}
              </dt>

              <dd className="sr-only">
                {label} {isDecreasing ? "Decreased" : "Increased"} by{" "}
                {data.growthRate}%
              </dd>
            </dl>
          )}
        </div>
      </div>

      {label === "Attendance" && (
        <div className="ml-4 flex items-center">
          <icons.YellowAlert className="h-10 w-10 text-yellow-400 dark:text-yellow-400" />
        </div>
      )}
    </div>
  );
}
