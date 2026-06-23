import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { mapSessionToAppUser } from "@/app/(home)/dashboard/fetch";
import {
  getIntervenedStudentsOpenOutOfAlertData,
  type InterventionReminderScope,
} from "@/lib/db/intervention-open-out-of-alert";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = mapSessionToAppUser(
    session as Parameters<typeof mapSessionToAppUser>[0]
  );

  const { searchParams } = new URL(req.url);
  const emulatedFacultyId = String(searchParams.get("faculty") ?? "").trim();

  let scope: InterventionReminderScope | null = null;

  if (user.role === "superadmin" && emulatedFacultyId) {
    scope = { role: "dean", facultyId: emulatedFacultyId };
  } else if (user.role === "dean" && user.faculty_id) {
    scope = { role: "dean", facultyId: user.faculty_id };
  } else if (user.role === "hod" && user.department_ids?.length) {
    scope = { role: "hod", departmentIds: user.department_ids };
  } else if (
    (user.role === "instructor" || user.role === "teacher") &&
    user.sap_id
  ) {
    scope = { role: "instructor", pernr: user.sap_id };
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getIntervenedStudentsOpenOutOfAlertData(scope);
    return NextResponse.json(data);
  } catch (error) {
    console.error("header-intervention-reminder:", error);
    return NextResponse.json(
      { error: "Failed to load intervention reminder counts" },
      { status: 500 }
    );
  }
}
