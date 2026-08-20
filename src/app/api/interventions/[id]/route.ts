import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import {
  deleteInterventionById,
  getInterventionById,
  updateInterventionById,
} from "@/data/intervention-store";
import { DuplicateSgpaInterventionError } from "@/lib/db/interventions";

const EDIT_WINDOW_MS = 30 * 60 * 1000;

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid intervention id" }, { status: 400 });
  }

  const deleted = await deleteInterventionById(id);
  if (!deleted.studentSapId) {
    return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, studentSapId: deleted.studentSapId }, { status: 200 });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid intervention id" }, { status: 400 });
  }

  const existing = await getInterventionById(id);
  if (!existing) {
    return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        date?: string;
        intervention_type?: "attendance" | "gpa" | "both";
        outreach_mode?: string;
        remarks?: string;
        status?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const date = String(body.date ?? "").trim();
  const interventionType =
    body.intervention_type === "gpa"
      ? "gpa"
      : body.intervention_type === "both"
        ? "both"
        : "attendance";
  const outreachMode = String(body.outreach_mode ?? "").trim();
  const remarks = String(body.remarks ?? "");
  const status = String(body.status ?? "").trim();
  if (!date || !outreachMode || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) {
    const uploadedBySamePernr =
      String(existing.uploader_pernr ?? "").trim() ===
      String(session.user.pernr ?? "").trim();
    const createdAtMs = new Date(existing.performed_at).getTime();
    const withinEditWindow =
      Number.isFinite(createdAtMs) && Date.now() - createdAtMs <= EDIT_WINDOW_MS;
    if (!uploadedBySamePernr || !withinEditWindow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (remarks !== String(existing.remarks ?? "")) {
      return NextResponse.json(
        { error: "Remarks cannot be edited by your role." },
        { status: 403 }
      );
    }
  }

  try {
    const updated = await updateInterventionById(id, {
      date,
      intervention_type: interventionType,
      outreach_mode: outreachMode,
      remarks,
      status,
    });
    if (!updated.studentSapId) {
      return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, studentSapId: updated.studentSapId }, { status: 200 });
  } catch (error) {
    if (error instanceof DuplicateSgpaInterventionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

