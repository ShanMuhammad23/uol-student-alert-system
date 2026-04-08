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

type HeaderProps = {
  user?: AppUser | null;
  screenHeading?: string | null;
  totalStudents?: number;
};

const FACULTY_NAME_FALLBACK: Record<string, string> = {
  "50000172": "Faculty of Social Sciences",
  FAC_ENG: "Faculty of Social Sciences",
  FAC_MGT: "Faculty of Social Sciences",
  "50000178": "Faculty of Pharmacy",
};

function mapFacultyHeadingName(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (FACULTY_NAME_FALLBACK[raw]) return FACULTY_NAME_FALLBACK[raw];
  if (/^Faculty\s+\d+$/i.test(raw)) {
    const id = raw.replace(/^Faculty\s+/i, "").trim();
    return FACULTY_NAME_FALLBACK[id] ?? raw;
  }
  return raw;
}

export function Header({ user, screenHeading, totalStudents }: HeaderProps) {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hideUserInfo = pathname === "/auth/sign-in";
  const [emulatedHeading, setEmulatedHeading] = useState<string | null>(null);
  const [emulatedTotalStudents, setEmulatedTotalStudents] = useState<
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
        };
      })
      .then((data) => {
        setEmulatedHeading(
          mapFacultyHeadingName(data.screenHeading) ??
            mapFacultyHeadingName(emulatedFacultyId) ??
            emulatedFacultyId
        );
        setEmulatedTotalStudents(
          typeof data.totalStudents === "number"
            ? data.totalStudents
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
        setEmulatedHeading(mapFacultyHeadingName(emulatedFacultyId) ?? emulatedFacultyId);
        setEmulatedTotalStudents(undefined);
      });

    return () => controller.abort();
  }, [isSuperadminDeanMode, emulatedFacultyId]);

  const resolvedHeading = useMemo(() => {
    if (isSuperadminDeanMode) {
      return (
        mapFacultyHeadingName(emulatedHeading) ??
        mapFacultyHeadingName(emulatedFacultyId) ??
        emulatedFacultyId
      );
    }
    return mapFacultyHeadingName(screenHeading) ?? screenHeading;
  }, [isSuperadminDeanMode, emulatedHeading, emulatedFacultyId, screenHeading]);
  const resolvedTotalStudents = isSuperadminDeanMode
    ? emulatedTotalStudents
    : totalStudents;
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
        {resolvedHeading && (
          <div className="space-y-0.5">
            <p className="text-lg font-medium text-green-600 dark:text-dark-5">
              {resolvedHeading} {shouldShowTotalStudents && (
                <span className="font-semibold  dark:text-white">
                  {resolvedTotalStudents.toLocaleString()}
                </span>
            
            )}
            </p>
            
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
