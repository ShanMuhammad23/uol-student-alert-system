import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { mapSessionToAppUser } from "@/app/(home)/dashboard/fetch";
import {
  buildEffectivenessRows,
  getEffectivenessScores,
  getLatestEffectivenessSnapshotDate,
} from "@/lib/effectiveness";
import { resolveFacultyNameFromIdOrName } from "@/lib/faculty-name";
import type { EffectivenessScoreRow } from "@/lib/effectiveness-scoring";
import { computeEiRating } from "@/lib/effectiveness-scoring";

export const dynamic = "force-dynamic";

function summarizeRows(rows: EffectivenessScoreRow[]): {
  eiScore: number;
  eiRating: EffectivenessScoreRow["ei_rating"];
  label: string;
} {
  if (rows.length === 1) {
    return {
      eiScore: rows[0].ei_score,
      eiRating: rows[0].ei_rating,
      label: rows[0].dimension_name,
    };
  }
  const avg = rows.reduce((s, r) => s + r.ei_score, 0) / rows.length;
  return {
    eiScore: Math.round(avg * 100) / 100,
    eiRating: computeEiRating(avg),
    label: `${rows.length} departments`,
  };
}

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

  let rows: EffectivenessScoreRow[] = [];
  let snapshotDate =
    (await getLatestEffectivenessSnapshotDate()) ??
    new Date().toISOString().slice(0, 10);

  try {
    if (
      user.role === "superadmin" &&
      emulatedFacultyId
    ) {
      rows = await getEffectivenessScores({
        dimensionType: "faculty",
        facultyIds: [emulatedFacultyId],
      });
      if (!rows.length) {
        rows = (
          await buildEffectivenessRows(undefined, {
            facultyIds: [emulatedFacultyId],
          })
        ).filter((r) => r.dimension_type === "faculty" && r.dimension_id === emulatedFacultyId);
      }
      if (rows[0]) {
        rows[0] = {
          ...rows[0],
          dimension_name:
            resolveFacultyNameFromIdOrName(emulatedFacultyId, rows[0].dimension_name) ??
            rows[0].dimension_name,
        };
      }
    } else if (user.role === "dean" && user.faculty_id) {
      rows = await getEffectivenessScores({
        dimensionType: "faculty",
        facultyIds: [user.faculty_id],
      });
      if (!rows.length) {
        rows = (
          await buildEffectivenessRows(undefined, { facultyIds: [user.faculty_id] })
        ).filter((r) => r.dimension_type === "faculty");
      }
    } else if (user.role === "hod" && user.department_ids?.length) {
      const facultyIds = user.faculty_id ? [user.faculty_id] : undefined;
      rows = await getEffectivenessScores({
        dimensionType: "department",
        facultyIds,
        departmentIds: user.department_ids,
      });
      if (!rows.length && facultyIds?.length) {
        rows = (
          await buildEffectivenessRows(undefined, { facultyIds })
        ).filter(
          (r) =>
            r.dimension_type === "department" &&
            user.department_ids!.includes(r.dimension_id)
        );
      }
    } else if (
      (user.role === "instructor" || user.role === "teacher") &&
      user.sap_id
    ) {
      const facultyIds = user.faculty_id ? [user.faculty_id] : [];
      if (facultyIds.length) {
        rows = await getEffectivenessScores({
          dimensionType: "instructor",
          facultyIds,
          instructorPernrs: [user.sap_id],
        });
        if (!rows.length) {
          rows = (
            await buildEffectivenessRows(undefined, { facultyIds })
          ).filter(
            (r) => r.dimension_type === "instructor" && r.dimension_id === user.sap_id
          );
        }
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("header-effectiveness:", error);
    return NextResponse.json(
      { error: "Failed to load effectiveness" },
      { status: 500 }
    );
  }

  if (rows[0]?.snapshot_date) {
    snapshotDate = rows[0].snapshot_date;
  }

  if (!rows.length) {
    return NextResponse.json({
      snapshotDate,
      rows: [],
      summary: null,
    });
  }

  return NextResponse.json({
    snapshotDate,
    rows,
    summary: summarizeRows(rows),
  });
}
