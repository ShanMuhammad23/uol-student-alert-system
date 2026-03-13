import "@/css/satoshi.css";
import "@/css/style.css";

import { Sidebar } from "@/components/Layouts/sidebar";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { Header } from "@/components/Layouts/header";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import {
  getCurrentUser,
  getFullData,
  getScreenHeading,
  getOverviewData,
} from "./(home)/dashboard/fetch";

export const metadata: Metadata = {
  title: {
    template: "UOL | Student Early Alert System",
    default: "UOL | Student Early Alert System",
  },
  description:
    "UOL | Student Early Alert System",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const user = await getCurrentUser();
  const data = await getFullData();
  const screenHeading = getScreenHeading(user, data);
  const overview = await getOverviewData(user ?? undefined);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">


            <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
              <Header
                user={user}
                screenHeading={screenHeading}
                totalStudents={overview.totalStudents}
              />

              <main className=" mx-auto w-full  overflow-hidden px-8 ">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
