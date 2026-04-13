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
import { getCurrentUser, getLatestAlertCountsSnapshot } from "./(home)/dashboard/fetch";
import { pool } from "@/lib/db";

const FACULTY_ID_TO_ENROLLMENT_FAC_ID: Record<string, string> = {
  FAC_ENG: "50000172",
  FAC_MGT: "50000172",
};

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
  let lastUpdated: string | null = null;

  const latestSnapshot = await getLatestAlertCountsSnapshot();
  const latestSnapshotDate = latestSnapshot.snapshotDate;
  lastUpdated = latestSnapshotDate;

  if (user && pool) {
    try {
      if (user.role === "dean" && user.faculty_id) {
        const mappedFacultyId =
          FACULTY_ID_TO_ENROLLMENT_FAC_ID[user.faculty_id] ?? user.faculty_id;
        const faculty = await pool.query<{ name: string }>(
          "SELECT name FROM faculties WHERE id = $1 LIMIT 1",
          [mappedFacultyId]
        );
        screenHeading = faculty.rows[0]?.name ?? mappedFacultyId;

        const total = await pool.query<{ total_students: number | string | null }>(
          `SELECT COALESCE(SUM(total_students), 0) AS total_students
           FROM alert_counts_by_dimension
           WHERE snapshot_date = $1
             AND dimension_type = 'faculty'
             AND dimension_id = $2`,
          [latestSnapshotDate, mappedFacultyId]
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
           WHERE snapshot_date = $1
             AND dimension_type = 'department'
             AND dimension_id = ANY($2::varchar[])`,
          [latestSnapshotDate, user.department_ids]
        );
        totalStudents = Number(total.rows[0]?.total_students ?? 0);
      } else if (user.role === "teacher" || user.role === "instructor") {
        screenHeading = user.name;
        const total = await pool.query<{ total_students: number | string | null }>(
          `SELECT COALESCE(SUM(total_students), 0) AS total_students
           FROM alert_counts_by_dimension
           WHERE snapshot_date = $1
             AND dimension_type = 'instructor'
             AND dimension_id = $2`,
          [latestSnapshotDate, user.sap_id]
        );
        totalStudents = Number(total.rows[0]?.total_students ?? 0);
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
                lastUpdated={lastUpdated}
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
