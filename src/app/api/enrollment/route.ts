import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ENROLLMENT_FILE = "enrollment_data.json";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), "public", ENROLLMENT_FILE);
    const raw = await readFile(dataPath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid enrollment data" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Enrollment API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load enrollment data" },
      { status: 500 }
    );
  }
}
