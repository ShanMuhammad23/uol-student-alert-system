import { NextRequest, NextResponse } from "next/server";
import { fetchMonitoringEntries, mapMonitoringToStudents } from "@/lib/sap-monitoring";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const Campus = searchParams.get("Campus") ?? process.env.SAP_CAMPUS ?? "11";
    const PYear = searchParams.get("PYear") ?? process.env.SAP_PYEAR ?? "2026";
    const PSess = searchParams.get("PSess") ?? process.env.SAP_PSESS ?? "002";
    const Begda = searchParams.get("Begda") ?? process.env.SAP_BEGDA ?? "20260601";
    const Endda = searchParams.get("Endda") ?? process.env.SAP_ENDDA ?? "20260920";

    const entries = await fetchMonitoringEntries({
      Campus,
      PYear,
      PSess,
      Begda,
      Endda,
    });

    const students = mapMonitoringToStudents(entries);

    type ClassKey = string;
    const byClass = new Map<
      ClassKey,
      {
        CrCode: string;
        SecCode: string;
        ClassType: string;
        TeacherName: string;
        EObjid: string;
        Att: number;
        ToDate: number;
        Held: number;
      }
    >();

    for (const e of entries) {
      const code = String(e.CrCode ?? "");
      const sec = String(e.SecCode ?? "");
      if (!code || !sec) continue;
      const classType = String(e.ClassType ?? "").trim();
      const teacherName = String(e.TeacherName ?? "").trim();
      const eObjid = String(e.EObjid ?? "").trim();
      const key: ClassKey = `${code}__${sec}__${classType}__${teacherName}__${eObjid}`;
      const rawToDate = e.ToDate;
      const toDate =
        typeof rawToDate === "number"
          ? rawToDate
          : rawToDate != null
          ? Number(rawToDate) || 0
          : 0;
      const rawHeld = e.Held ?? e.ToDate;
      const held =
        typeof rawHeld === "number"
          ? rawHeld
          : rawHeld != null
          ? Number(rawHeld) || 0
          : 0;
      const rawAtt = e.Att;
      const att =
        typeof rawAtt === "number"
          ? rawAtt
          : rawAtt != null
          ? Number(rawAtt) || 0
          : 0;
      byClass.set(key, {
        CrCode: code,
        SecCode: sec,
        ClassType: classType,
        TeacherName: teacherName,
        EObjid: eObjid,
        Att: att,
        ToDate: toDate,
        Held: held,
      });
    }

    const classes = Array.from(byClass.values());

    return NextResponse.json(
      {
        params: { Campus, PYear, PSess, Begda, Endda },
        count: students.length,
        students,
        classes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/monitoring:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitoring data" },
      { status: 500 }
    );
  }
}

