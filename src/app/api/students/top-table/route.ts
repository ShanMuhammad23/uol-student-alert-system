import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  getStudentListing,
  type ListingRequest,
  type SessionScope,
} from "@/lib/db/student-listing";

function toSessionScope(session: any): SessionScope | null {
  const role = session?.user?.role;
  if (
    role !== "superadmin" &&
    role !== "dean" &&
    role !== "hod" &&
    role !== "instructor"
  ) {
    return null;
  }
  return {
    role,
    faculty_id: session?.user?.faculty_id ?? null,
    department_ids: Array.isArray(session?.user?.department_ids)
      ? session.user.department_ids
      : null,
    pernr: session?.user?.pernr ?? null,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = toSessionScope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ListingRequest;
  try {
    body = (await req.json()) as ListingRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await getStudentListing(scope, body ?? {});
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Top table API error:", error);
    return NextResponse.json(
      { error: "Failed to load student listing" },
      { status: 500 }
    );
  }
}
