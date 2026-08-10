import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { pool } from "@/lib/db";
import {
  getLatestAlertCountsSnapshot,
  getOverviewData,
  getInstructorTrainingCounts,
} from "@/app/(home)/dashboard/fetch";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only superadmin is expected to emulate dean from the superadmin screen.
  if (session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const facultyId = String(searchParams.get("faculty") ?? "").trim();
  if (!facultyId) {
    return NextResponse.json(
      { error: "Missing faculty parameter" },
      { status: 400 }
    );
  }

  let heading = facultyId;
  if (pool) {
    try {
      const res = await pool.query<{ name: string }>(
        "SELECT name FROM faculties WHERE id = $1 LIMIT 1",
        [facultyId]
      );
      heading = res.rows[0]?.name ?? facultyId;
    } catch {
      heading = facultyId;
    }
  }

  const emulatedDeanUser = {
    id: session.user.id,
    img: session.user.img ?? null,
    sap_id: session.user.pernr ?? "",
    name: session.user.name ?? "Superadmin",
    email: session.user.email ?? "",
    role: "dean" as const,
    faculty_id: facultyId,
    department_id: null,
    department_ids: null,
    course_ids: null,
  };

  const overview = await getOverviewData(emulatedDeanUser);
  const latestSnapshot = await getLatestAlertCountsSnapshot();
  const training = await getInstructorTrainingCounts({
    facultyIds: [facultyId],
  });

  return NextResponse.json({
    screenHeading: heading,
    totalStudents: overview.totalStudents ?? 0,
    lastUpdated: latestSnapshot.createdAt ?? null,
    trainedStaffCount: training.trained,
    needTrainingCount: training.needTraining,
  });
}
