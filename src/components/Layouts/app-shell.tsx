"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps, PropsWithChildren } from "react";
import { Header } from "./header";

type AppShellProps = PropsWithChildren<{
  header: ComponentProps<typeof Header>;
}>;

function isAuthPath(pathname: string | null): boolean {
  return pathname?.startsWith("/auth") ?? false;
}

export function AppShell({ children, header }: AppShellProps) {
  const pathname = usePathname();
  const showHeader = !isAuthPath(pathname);

  return (
    <div
      className={
        showHeader
          ? "w-full bg-gray-2 dark:bg-[#020d1a]"
          : "min-h-[100dvh] w-full"
      }
    >
      {showHeader ? <Header {...header} /> : null}
      <main
        className={
          showHeader
            ? "mx-auto w-full overflow-hidden sm:px-8 px-1"
            : "mx-auto min-h-[100dvh] w-full p-0"
        }
      >
        {children}
      </main>
    </div>
  );
}
