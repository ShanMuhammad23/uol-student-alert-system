"use client";

import { ChevronUpIcon } from "@/assets/icons";
import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogOutIcon, UserIcon } from "./icons";
import { signOut } from "@/app/auth/actions";
import type { AppUser } from "@/app/(home)/dashboard/fetch";

type UserInfoProps = {
  user?: AppUser | null;
};

export function UserInfo({ user }: UserInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayName = user?.name ?? "Guest";
  const displayEmail = user?.email ?? "";
  const img = `/images/${user?.img ?? "user/user-placeholder.jpg"}`;
  const isSignedIn = !!user;

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="rounded align-middle outline-none ring-primary ring-offset-2 focus-visible:ring-1 dark:ring-offset-gray-dark">
        <span className="sr-only">My Account</span>

        <figure className="flex items-center gap-3">
          <Image
            src={img}
            className="size-12 rounded-full"
            alt={`Avatar of ${displayName}`}
            role="presentation"
            width={200}
            height={200}
          />
          <figcaption className="flex items-center gap-1 font-medium text-dark dark:text-dark-6 max-[1024px]:sr-only">
            <span>{displayName}</span>

            <ChevronUpIcon
              aria-hidden
              className={cn(
                "rotate-180 transition-transform",
                isOpen && "rotate-0",
              )}
              strokeWidth={1.5}
            />
          </figcaption>
        </figure>
      </DropdownTrigger>

      <DropdownContent
        className="border border-stroke bg-white shadow-md dark:border-dark-3 dark:bg-gray-dark min-[230px]:min-w-[17.5rem]"
        align="end"
      >
        <h2 className="sr-only">User information</h2>

        <figure className="flex items-center gap-2.5 px-5 py-3.5">
          <Image
            src={img}
            className="size-12 rounded-full"
            alt={`Avatar for ${displayName}`}
            role="presentation"
            width={200}
            height={200}
          />

          <figcaption className="space-y-1 text-base font-medium flex flex-col items-start">
            <div className="mb-2 leading-none text-dark dark:text-white">
              {displayName}
            </div>

            <div className="leading-none text-gray-6 flex-1">
              {isSignedIn ? displayEmail : "Not signed in"}
            </div>
            {user?.role && (
              <div className="text-body-sm text-dark-6 dark:text-dark-5">
                {user.role.toUpperCase()}
              </div>
            )}
          </figcaption>
        </figure>

        <hr className="border-[#E8E8E8] dark:border-dark-3" />

        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6 [&>*]:cursor-pointer">
          {!isSignedIn && (
            <Link
              href="/auth/sign-in"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] hover:bg-gray-2 hover:text-dark dark:hover:bg-dark-3 dark:hover:text-white"
            >
              <UserIcon />
              <span className="mr-auto text-base font-medium">Sign in</span>
            </Link>
          )}
        </div>


        {isSignedIn && (
        <div className="p-2 text-base text-[#4B5563] dark:text-dark-6">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-red hover:bg-red/10 dark:hover:bg-red/10"
       
            >
              <LogOutIcon />
              <span className="text-base font-medium">Sign out</span>
            </button>
          </form>
        </div>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
