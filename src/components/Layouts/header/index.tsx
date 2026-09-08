"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import { HeaderEffectivenessCard } from "@/components/effectiveness/HeaderEffectivenessCard";
import { useEffect, useMemo, useState } from "react";
import { normalizeFacultyName } from "@/lib/faculty-name";
import type { InstructorFacultyRollupItem } from "@/lib/instructor-faculty-rollup";
import { HeaderInterventionReminderCard } from "@/components/dashboard/HeaderInterventionReminderCard";

type HeaderProps = {
  user?: AppUser | null;
  screenHeading?: string | null;
  totalStudents?: number;
  lastUpdated?: string | null;
  instructorFacultyRollup?: InstructorFacultyRollupItem[];
  trainedStaffCount?: number;
  needTrainingCount?: number;
};

function formatLastUpdatedLabel(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function Header({
  user,
  screenHeading,
  totalStudents,
  lastUpdated,
  instructorFacultyRollup,
  trainedStaffCount,
  needTrainingCount,
}: HeaderProps) {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hideUserInfo =
    pathname === "/auth/sign-in" || pathname === "/auth/forgot-password";
  const [emulatedHeading, setEmulatedHeading] = useState<string | null>(null);
  const [emulatedTotalStudents, setEmulatedTotalStudents] = useState<
    number | undefined
  >(undefined);
  const [emulatedLastUpdated, setEmulatedLastUpdated] = useState<string | null>(
    null
  );
  const [emulatedTrainedStaffCount, setEmulatedTrainedStaffCount] = useState<
    number | undefined
  >(undefined);
  const [emulatedNeedTrainingCount, setEmulatedNeedTrainingCount] = useState<
    number | undefined
  >(undefined);

  const asParam = searchParams.get("as");
  const emulatedFacultyId = searchParams.get("faculty");
  const isSuperadminDeanMode =
    user?.role === "superadmin" &&
    pathname === "/dashboard" &&
    asParam === "dean" &&
    typeof emulatedFacultyId === "string" &&
    emulatedFacultyId.trim().length > 0;

  useEffect(() => {
    if (!isSuperadminDeanMode || !emulatedFacultyId) {
      setEmulatedHeading(null);
      setEmulatedTotalStudents(undefined);
      setEmulatedLastUpdated(null);
      setEmulatedTrainedStaffCount(undefined);
      setEmulatedNeedTrainingCount(undefined);
      return;
    }

    const controller = new AbortController();
    fetch(
      `/api/dashboard/header-faculty?faculty=${encodeURIComponent(
        emulatedFacultyId
      )}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch emulated header");
        return (await res.json()) as {
          screenHeading?: string;
          totalStudents?: number;
          lastUpdated?: string | null;
          trainedStaffCount?: number;
          needTrainingCount?: number;
        };
      })
      .then((data) => {
        setEmulatedHeading(
          normalizeFacultyName(data.screenHeading) ??
            normalizeFacultyName(emulatedFacultyId) ??
            emulatedFacultyId
        );
        setEmulatedTotalStudents(
          typeof data.totalStudents === "number" ? data.totalStudents : undefined
        );
        setEmulatedLastUpdated(data.lastUpdated ?? null);
        setEmulatedTrainedStaffCount(
          typeof data.trainedStaffCount === "number"
            ? data.trainedStaffCount
            : undefined
        );
        setEmulatedNeedTrainingCount(
          typeof data.needTrainingCount === "number"
            ? data.needTrainingCount
            : undefined
        );
      })
      .catch((err: unknown) => {
        if (
          typeof err === "object" &&
          err != null &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        setEmulatedHeading(
          normalizeFacultyName(emulatedFacultyId) ?? emulatedFacultyId
        );
        setEmulatedTotalStudents(undefined);
        setEmulatedLastUpdated(null);
        setEmulatedTrainedStaffCount(undefined);
        setEmulatedNeedTrainingCount(undefined);
      });

    return () => controller.abort();
  }, [isSuperadminDeanMode, emulatedFacultyId]);

  const resolvedHeading = useMemo(() => {
    if (isSuperadminDeanMode) {
      return (
        normalizeFacultyName(emulatedHeading) ??
        normalizeFacultyName(emulatedFacultyId) ??
        emulatedFacultyId
      );
    }
    return normalizeFacultyName(screenHeading) ?? screenHeading;
  }, [isSuperadminDeanMode, emulatedHeading, emulatedFacultyId, screenHeading]);
  const resolvedTotalStudents = isSuperadminDeanMode
    ? emulatedTotalStudents
    : totalStudents;
  const resolvedLastUpdated = isSuperadminDeanMode
    ? emulatedLastUpdated ?? lastUpdated
    : lastUpdated;
  const resolvedTrainedStaffCount = isSuperadminDeanMode
    ? emulatedTrainedStaffCount
    : trainedStaffCount;
  const resolvedNeedTrainingCount = isSuperadminDeanMode
    ? emulatedNeedTrainingCount
    : needTrainingCount;
  const formattedLastUpdated = formatLastUpdatedLabel(resolvedLastUpdated);
  const shouldShowTotalStudents =
    typeof resolvedTotalStudents === "number" &&
    (isSuperadminDeanMode ||
      user?.role === "dean" ||
      user?.role === "hod" ||
      user?.role === "teacher" ||
      user?.role === "instructor");
  const shouldShowTrainingCounts =
    typeof resolvedTrainedStaffCount === "number" &&
    typeof resolvedNeedTrainingCount === "number" &&
    (isSuperadminDeanMode || user?.role === "dean" || user?.role === "hod");

  const instructorFacultySummaryLine = useMemo(() => {
    if (!user || (user.role !== "instructor" && user.role !== "teacher")) {
      return null;
    }
    if (!instructorFacultyRollup?.length) return null;
    return instructorFacultyRollup
      .map((i) => `${i.displayLabel} (${i.studentCount.toLocaleString()})`)
      .join(", ");
  }, [user, instructorFacultyRollup]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-stroke bg-white px-3 shadow-1 dark:border-stroke-dark dark:bg-gray-dark sm:gap-3 sm:px-4 md:h-[5.5rem] md:px-5 lg:gap-4 2xl:px-10">
      <button
        type="button"
        onClick={toggleSidebar}
        className="shrink-0 rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href="/" className="ml-1 shrink-0 max-[430px]:hidden min-[375px]:ml-2">
          <Image
            src="/assets/logos/logo-black.png"
            width={40}
            height={40}
            alt="UOL | Student Early Alert System logo"
            role="presentation"
          />
        </Link>
      )}

      <div className="min-w-0 flex-1 max-lg:hidden">
        <h1 className="truncate text-base font-bold leading-tight text-dark dark:text-white xl:text-heading-5">
          Student Early Alert System
        </h1>
        {(resolvedHeading ||
          formattedLastUpdated ||
          instructorFacultySummaryLine) &&
          !hideUserInfo && (
            <div className="mt-0.5 min-w-0 space-y-0.5">
              {(resolvedHeading || formattedLastUpdated) && (
                <div className="flex min-w-0 items-center gap-x-2 gap-y-0.5 overflow-hidden">
                  {resolvedHeading ? (
                    <p className="min-w-0 truncate text-sm font-medium text-green-600 dark:text-white xl:text-lg">
                      {resolvedHeading}{" "}
                      {shouldShowTotalStudents &&
                        typeof resolvedTotalStudents === "number" && (
                          <span className="font-semibold dark:text-white">
                            {resolvedTotalStudents.toLocaleString()}
                          </span>
                        )}
                    </p>
                  ) : null}
                  {formattedLastUpdated ? (
                    <p className="hidden min-w-0 shrink truncate border-l border-gray-300 pl-2 text-xs text-gray-600 dark:border-gray-300 dark:text-gray-300 xl:block xl:text-sm 2xl:text-base">
                      Last updated: {formattedLastUpdated}
                    </p>
                  ) : null}
                </div>
              )}
              {instructorFacultySummaryLine ? (
                <p className="truncate text-xs font-normal leading-snug text-slate-600 dark:text-slate-400 xl:max-w-3xl 2xl:max-w-4xl">
                  {instructorFacultySummaryLine}
                </p>
              ) : null}
            </div>
          )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 lg:gap-3">
        {shouldShowTrainingCounts ? (
          <div className="hidden h-12 max-w-[11.5rem] shrink-0 flex-col justify-center overflow-hidden rounded-lg border border-yellow-300/80 bg-yellow-200 px-2.5 py-1.5 dark:border-gray-600 dark:bg-gray-800 xl:flex">
            <p className="truncate text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300">
              {resolvedTrainedStaffCount} instructors Trained
            </p>
            <p className="truncate text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300">
              {resolvedNeedTrainingCount} instructors Need Training
            </p>
          </div>
        ) : null}

        <HeaderInterventionReminderCard user={user} />
        <HeaderEffectivenessCard user={user} />

        <div className="shrink-0">
          <ThemeToggleSwitch />
        </div>

        {!hideUserInfo && (
          <div className="shrink-0">
            <UserInfo user={user} />
          </div>
        )}
      </div>
    </header>
  );
}
