"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import type { AppUser } from "@/app/(home)/dashboard/fetch";
import { useEffect, useMemo, useState } from "react";
import { normalizeFacultyName } from "@/lib/faculty-name";

type HeaderProps = {
  user?: AppUser | null;
  screenHeading?: string | null;
  totalStudents?: number;
  lastUpdated?: string | null;
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

export function Header({ user, screenHeading, totalStudents, lastUpdated }: HeaderProps) {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hideUserInfo = pathname === "/auth/sign-in";
  const [emulatedHeading, setEmulatedHeading] = useState<string | null>(null);
  const [emulatedTotalStudents, setEmulatedTotalStudents] = useState<
    number | undefined
  >(undefined);
  const [emulatedLastUpdated, setEmulatedLastUpdated] = useState<string | null>(null);

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
        };
      })
      .then((data) => {
        setEmulatedHeading(
          normalizeFacultyName(data.screenHeading) ??
            normalizeFacultyName(emulatedFacultyId) ??
            emulatedFacultyId
        );
        setEmulatedTotalStudents(
          typeof data.totalStudents === "number"
            ? data.totalStudents
            : undefined
        );
        setEmulatedLastUpdated(data.lastUpdated ?? null);
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
        setEmulatedHeading(normalizeFacultyName(emulatedFacultyId) ?? emulatedFacultyId);
        setEmulatedTotalStudents(undefined);
        setEmulatedLastUpdated(null);
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
  const formattedLastUpdated = formatLastUpdatedLabel(resolvedLastUpdated);
  const shouldShowTotalStudents =
    typeof resolvedTotalStudents === "number" &&
    (isSuperadminDeanMode ||
      user?.role === "dean" ||
      user?.role === "hod" ||
      user?.role === "teacher" ||
      user?.role === "instructor");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stroke bg-white px-4 py-5 shadow-1 dark:border-stroke-dark dark:bg-gray-dark md:px-5 2xl:px-10">
      <button
        onClick={toggleSidebar}
        className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Toggle Sidebar</span>
      </button>

      {isMobile && (
        <Link href={"/"} className="ml-2 max-[430px]:hidden min-[375px]:ml-4">
          <Image
            src={"/assets/logos/logo-black.png"}
            width={40}
            height={40}
            alt="UOL | Student Early Alert System logo"
            role="presentation"
          />
        </Link>
      )}

      <div className="max-xl:hidden">
        <h1 className="mb-0.5 text-heading-5 font-bold text-dark dark:text-white">
          Student Early Alert System
        </h1>
        {(resolvedHeading || formattedLastUpdated) && (
          <div className="flex items-center gap-2">
            <p className="text-lg font-medium text-green-600 dark:text-dark-5">
              {resolvedHeading} {resolvedHeading && shouldShowTotalStudents && (
                <span className="font-semibold  dark:text-white">
                  {resolvedTotalStudents.toLocaleString()}
                 
                </span>
            
            )}
            </p>
            {formattedLastUpdated && (
              <p className="text-lg text-gray-600 dark:text-gray-300 border-l border-gray-300 pl-2">
                Last updated: {formattedLastUpdated}
              </p>
            )}
            <p className="text-lg text-gray-600 dark:text-gray-300 border-l border-gray-300 pl-2">Next Update: Tomorrow 04:00 AM</p>
            
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
       

        <ThemeToggleSwitch />


        {!hideUserInfo && (
          <div className="shrink-0">
            <UserInfo user={user} />
          </div>
        )}
      </div>
    </header>
  );
}
