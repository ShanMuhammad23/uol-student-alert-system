import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getStaffById, updateStaffImg } from "@/lib/db";

const MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function imagesDir(...segments: string[]) {
  return path.join(process.cwd(), "public", "images", ...segments);
}

async function removePreviousLocalFile(prevRelative: string | null) {
  if (!prevRelative || prevRelative.startsWith("http")) return;
  if (!prevRelative.startsWith("user/")) return;
  const base = path.basename(prevRelative);
  if (!base.startsWith("avatar-")) return;
  const full = imagesDir(...prevRelative.split("/"));
  try {
    await unlink(full);
  } catch {
    // ignore missing file
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const type = file.type || "application/octet-stream";
  const ext = MIME_TO_EXT[type];
  if (!ext) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 400 });
  }

  const staff = await getStaffById(session.user.id);
  if (!staff) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const safeId = session.user.id.replace(/[^a-f0-9-]/gi, "");
  const relativePath = `user/avatar-${safeId}${ext}`;
  const outPath = imagesDir("user", `avatar-${safeId}${ext}`);

  await mkdir(imagesDir("user"), { recursive: true });
  await removePreviousLocalFile(staff.img);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(outPath, buf);

  const updated = await updateStaffImg(session.user.id, relativePath);
  if (!updated) {
    return NextResponse.json({ error: "Could not save profile image." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, img: relativePath });
}
