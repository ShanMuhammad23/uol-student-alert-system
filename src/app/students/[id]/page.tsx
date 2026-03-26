import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { InterventionHistorySection } from "./_components/InterventionHistorySection";
import { getInterventionsByStudentSapId } from "@/data/intervention-store";
import { readFile } from "fs/promises";
import path from "path";
import type { EnrollmentRecord } from "@/lib/enrollment";
import { StudentMetricsClient } from "./_components/StudentMetricsClient";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getCgpaBySapId } from "@/lib/db/gpa";

type PropsType = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; course?: string; section?: string; class_avg?: string }>;
};

async function getEnrollmentForStudentSapId(
  sapId: string
): Promise<EnrollmentRecord[]> {
  const dataPath = path.join(process.cwd(), "public", "enrollment_data.json");
  const raw = await readFile(dataPath, "utf-8");
  const data = JSON.parse(raw) as EnrollmentRecord[];
  if (!Array.isArray(data)) return [];
  return data.filter((r) => r.SapNo === sapId);
}

export async function generateMetadata({ params }: PropsType): Promise<Metadata> {
  const { id } = await params;
  const enrollment = await getEnrollmentForStudentSapId(id);
  const studentName = enrollment[0]?.Name?.trim();
  return {
    title: studentName ? `${studentName} | Student Profile` : `Student ${id} | Profile`,
  };
}

export default async function StudentPage({ params, searchParams }: PropsType) {
  const session = await getServerSession(authOptions);
  const canDeleteIntervention = session?.user?.role === "superadmin";
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnToUrl =
    resolvedSearchParams.from && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/";
  const selectedCourseCode = resolvedSearchParams.course;
  const selectedSection = resolvedSearchParams.section;
  const classAverageParam = Number(resolvedSearchParams.class_avg);
  const selectedClassAverage =
    Number.isFinite(classAverageParam) && classAverageParam > 0
      ? classAverageParam
      : null;
  const sapIdFromUrl = id;
  const interventionHistory = await getInterventionsByStudentSapId(sapIdFromUrl);
  const currentCgpa = await getCgpaBySapId(sapIdFromUrl);

  const enrollmentRecords = await getEnrollmentForStudentSapId(sapIdFromUrl);
  if (!enrollmentRecords.length) notFound();
  const primaryEnrollment = enrollmentRecords[0] ?? null;

  let facultyName: string | null = null;
  const facultyId = primaryEnrollment?.FacId;
  if (facultyId && pool) {
    try {
      const res = await pool.query<{ name: string }>(
        "SELECT name FROM faculties WHERE id = $1",
        [facultyId]
      );
      facultyName = res.rows[0]?.name?.trim() ?? null;
    } catch {
      facultyName = null;
    }
  }
  if (facultyId && !facultyName) facultyName = `Faculty ${facultyId}`;

  return (
    <div className="w-full space-y-6 mt-4">
      {/* Back to list / Dashboard */}
      <div className="flex items-center gap-2">
        <Link
          href={returnToUrl}
          className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </Link>
      </div>

      {/* Profile Hero Card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#1f4a3d] via-[#255a4a] to-[#1f4a3d] shadow-lg dark:bg-gray-dark">
        <div className="relative px-6 py-8 sm:px-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white blur-3xl" />
          </div>
          
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            
            <div className="flex-1 text-white">
              <h1 className="text-2xl font-bold sm:text-3xl">
                {primaryEnrollment?.Name ?? sapIdFromUrl}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-white">
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">SAP ID:</span>
                  <span className="text-base font-medium">
                    {primaryEnrollment?.SapNo ?? sapIdFromUrl}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="text-base">Program:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DegreeTitle ??
                      primaryEnrollment?.DegreeCode ??
                      "—"}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 border-r border-white/20 pr-4">
                  <span className="font-medium">
                    {facultyName ?? "—"}
                  </span>
                </span>
                <span className="flex  flex-col gap-1.5 ">
                  <span className="text-base">Department:</span>
                  <span className="font-medium">
                    {primaryEnrollment?.DeptName ?? "—"}
                  </span>
                </span>
              </div>
            </div>
      <StudentMetricsClient sapId={sapIdFromUrl} section="badges" currentCgpa={currentCgpa} />
          </div>
        </div>

    
      </div>

      <StudentMetricsClient
        sapId={sapIdFromUrl}
        section="analytics"
        enrollmentRecords={enrollmentRecords}
        selectedCourseCode={selectedCourseCode}
        selectedSection={selectedSection}
        currentCgpa={currentCgpa}
        selectedClassAverage={selectedClassAverage}
      />

      {/* Intervention History (table + Add Intervention dialog) */}
      <InterventionHistorySection
        interventions={interventionHistory}
        studentSapId={sapIdFromUrl}
        canDelete={canDeleteIntervention}
      />

     
    </div>
  );
}