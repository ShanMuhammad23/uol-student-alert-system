import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  buildEffectivenessRows,
  getEffectivenessScores,
  getLatestEffectivenessSnapshotDate,
  withResolvedEffectivenessNames,
  type EffectivenessDimensionType,
} from "@/lib/effectiveness";
import { mapSessionToAppUser } from "@/app/(home)/dashboard/fetch";
import { queryFaculties } from "@/lib/staff-directory-queries";

export const dynamic = "force-dynamic";

type RequestBody = {
  dimensionType?: EffectivenessDimensionType;
  facultyIds?: string[];
  departmentIds?: string[];
  live?: boolean;
  snapshotDate?: string;
};

function resolveScope(
  user: NonNullable<Awaited<ReturnType<typeof mapSessionToAppUser>>>,
  body: RequestBody
): {
  facultyIds?: string[];
  departmentIds?: string[];
  dimensionType?: EffectivenessDimensionType;
} {
  if (user.role === "superadmin") {
    return {
      facultyIds: body.facultyIds,
      departmentIds: body.departmentIds,
      dimensionType: body.dimensionType,
    };
  }

  if (user.role === "dean" && user.faculty_id) {
    return {
      facultyIds: [user.faculty_id],
      dimensionType: body.dimensionType ?? "department",
    };
  }

  if (user.role === "hod" && user.department_ids?.length) {
    return {
      facultyIds: user.faculty_id ? [user.faculty_id] : body.facultyIds,
      departmentIds: user.department_ids,
      dimensionType: body.dimensionType ?? "department",
    };
  }

  return {};
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = mapSessionToAppUser(
      session as Parameters<typeof mapSessionToAppUser>[0]
    );

    if (
      user.role !== "superadmin" &&
      user.role !== "dean" &&
      user.role !== "hod"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as RequestBody;
    const scope = resolveScope(user, body);
    const live = Boolean(body.live);

    let liveFacultyIds = scope.facultyIds;
    if (live && !liveFacultyIds?.length && user.role === "superadmin") {
      const faculties = await queryFaculties();
      liveFacultyIds = faculties.map((f) => f.id);
    }

    let rows;
    if (live && liveFacultyIds?.length) {
      rows = await buildEffectivenessRows(body.snapshotDate, {
        facultyIds: liveFacultyIds,
      });
      if (scope.departmentIds?.length) {
        const allowed = new Set(scope.departmentIds);
        rows = rows.filter(
          (r) => r.dimension_type !== "department" || allowed.has(r.dimension_id)
        );
      }
      if (scope.dimensionType) {
        rows = rows.filter((r) => r.dimension_type === scope.dimensionType);
      }
    } else {
      rows = await getEffectivenessScores({
        snapshotDate: body.snapshotDate,
        dimensionType: scope.dimensionType,
        facultyIds: scope.facultyIds,
        departmentIds: scope.departmentIds,
        live: false,
      });

      if (!rows.length && scope.facultyIds?.length) {
        rows = await buildEffectivenessRows(body.snapshotDate, {
          facultyIds: scope.facultyIds,
        });
        if (scope.departmentIds?.length) {
          const allowed = new Set(scope.departmentIds);
          rows = rows.filter(
            (r) => r.dimension_type !== "department" || allowed.has(r.dimension_id)
          );
        }
        if (scope.dimensionType) {
          rows = rows.filter((r) => r.dimension_type === scope.dimensionType);
        }
      }
    }

    const snapshotDate =
      body.snapshotDate ??
      rows[0]?.snapshot_date ??
      (await getLatestEffectivenessSnapshotDate()) ??
      new Date().toISOString().slice(0, 10);

    return NextResponse.json({
      snapshotDate,
      live,
      rows: withResolvedEffectivenessNames(rows),
    });
  } catch (error) {
    console.error("Error in /api/dashboard/effectiveness:", error);
    return NextResponse.json(
      { error: "Failed to load effectiveness scores" },
      { status: 500 }
    );
  }
}
