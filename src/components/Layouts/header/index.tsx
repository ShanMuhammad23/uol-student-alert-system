"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import type { AppUser } from "@/app/(home)/dashboard/fetch";

type HeaderProps = {
  user?: AppUser | null;
  screenHeading?: string | null;
  totalStudents?: number;
};

export function Header({ user, screenHeading, totalStudents }: HeaderProps) {
  const { toggleSidebar, isMobile } = useSidebarContext();

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
        {screenHeading && (
          <div className="space-y-0.5">
            <p className="text-lg font-medium text-green-600 dark:text-dark-5">
              {screenHeading} {user?.role === "dean" && typeof totalStudents === "number" && (
                <span className="font-semibold  dark:text-white">
                  {totalStudents.toLocaleString()}
                </span>
            
            )}
            </p>
            
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
       

        <ThemeToggleSwitch />


        <div className="shrink-0">
          <UserInfo user={user} />
        </div>
      </div>
    </header>
  );
}
