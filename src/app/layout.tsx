import "@/css/satoshi.css";
import "@/css/style.css";

import { AppShell } from "@/components/Layouts/app-shell";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import { getCurrentUser, getLatestAlertCountsSnapshot } from "./(home)/dashboard/fetch";
import { pool } from "@/lib/db";
import { normalizeFacultyName } from "@/lib/faculty-name";
import {
  getInstructorFacultyRollup,
  type InstructorFacultyRollupItem,
} from "@/lib/instructor-faculty-rollup";

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
  let instructorFacultyRollup: InstructorFacultyRollupItem[] | undefined;

  const latestSnapshot = await getLatestAlertCountsSnapshot();
  const latestSnapshotDate = latestSnapshot.snapshotDate;
  lastUpdated = latestSnapshot.createdAt;

  if (user && pool) {
    try {
      if (user.role === "dean" && user.faculty_id) {
        const mappedFacultyId =
          FACULTY_ID_TO_ENROLLMENT_FAC_ID[user.faculty_id] ?? user.faculty_id;
        const faculty = await pool.query<{ name: string }>(
          "SELECT name FROM faculties WHERE id = $1 LIMIT 1",
          [mappedFacultyId]
        );
        screenHeading =
          normalizeFacultyName(faculty.rows[0]?.name ?? null) ??
          normalizeFacultyName(mappedFacultyId) ??
          mappedFacultyId;

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
          `SELECT COUNT(DISTINCT sap_id)::int AS total_students
           FROM student_enrollment_current
           WHERE is_active = TRUE
             AND TRIM(COALESCE(instructor_pernr, '')) <> ''
             AND TRIM(instructor_pernr) = TRIM($1)`,
          [user.sap_id]
        );
        totalStudents = Number(total.rows[0]?.total_students ?? 0);
        try {
          instructorFacultyRollup = await getInstructorFacultyRollup(user.sap_id);
        } catch {
          instructorFacultyRollup = [];
        }
      } else if (
        user.role === "wellbeing" ||
        user.role === "wellbeing-head" ||
        user.role === "wellbeing-counseller"
      ) {
        screenHeading = "UOL Wellbeing Center";
        const total = await pool.query<{ total_students: number | string | null }>(
          `WITH latest AS (
             SELECT DISTINCT ON (student_sap_id)
               student_sap_id,
               status
             FROM interventions
             ORDER BY student_sap_id, performed_at DESC
           )
           SELECT COUNT(*)::int AS total_students
           FROM latest
           WHERE status = 'referred'`
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


            <AppShell
              header={{
                user,
                screenHeading,
                totalStudents,
                lastUpdated,
                instructorFacultyRollup,
              }}
            >
              {children}
            </AppShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
