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
import { getCurrentUser } from "./(home)/dashboard/fetch";
import { pool } from "@/lib/db";

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
  let screenHeading: string | null = null;
  let totalStudents: number | undefined;

  if (user && pool) {
    try {
      if (user.role === "dean" && user.faculty_id) {
        const faculty = await pool.query<{ name: string }>(
          "SELECT name FROM faculties WHERE id = $1 LIMIT 1",
          [user.faculty_id]
        );
        screenHeading = faculty.rows[0]?.name ?? user.faculty_id;

        const total = await pool.query<{ total_students: number | string | null }>(
          `SELECT COALESCE(SUM(total_students), 0) AS total_students
           FROM alert_counts_by_dimension
           WHERE snapshot_date = CURRENT_DATE
             AND dimension_type = 'faculty'
             AND dimension_id = $1`,
          [user.faculty_id]
        );
        totalStudents = Number(total.rows[0]?.total_students ?? 0);
      } else if (user.role === "hod" && user.department_ids?.length) {
        const names = await pool.query<{ name: string }>(
          "SELECT name FROM departments WHERE id = ANY($1::varchar[]) ORDER BY name ASC",
          [user.department_ids]
        );
        screenHeading = names.rows.map((r) => r.name).join(", ");
        const total = await pool.query<{ total_students: number | string | null }>(
          `SELECT COALESCE(SUM(total_students), 0) AS total_students
           FROM alert_counts_by_dimension
           WHERE snapshot_date = CURRENT_DATE
             AND dimension_type = 'department'
             AND dimension_id = ANY($1::varchar[])`,
          [user.department_ids]
        );
        totalStudents = Number(total.rows[0]?.total_students ?? 0);
      } else if (user.role === "teacher") {
        screenHeading = user.name;
      }
    } catch {
      screenHeading = null;
      totalStudents = undefined;
    }
  }

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
                totalStudents={totalStudents}
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
