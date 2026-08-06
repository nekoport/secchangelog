import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { FileStorageService } from "@/lib/services/file-storage.service";
import { unauthorized, notFound, internalError } from "@/lib/security/api-response";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  try {
    const file = await FileStorageService.getScreenshotFile(id);
    if (!file) return notFound("File tidak ditemukan");

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[API files/screenshots/[id]]:", err);
    return internalError();
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  try {
    await FileStorageService.deleteScreenshot(
      id,
      session.user.id,
      session.user.role,
      {
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      }
    );
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return notFound();
    if (msg === "FORBIDDEN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Tidak punya izin hapus file ini" } },
        { status: 403 }
      );
    }
    if (msg === "DELETE_NOT_ALLOWED") {
      return Response.json(
        { error: { code: "DELETE_NOT_ALLOWED", message: "Hanya bisa hapus screenshot jika change log masih DRAFT" } },
        { status: 403 }
      );
    }
    console.error("[API files/screenshots/[id] DELETE]:", err);
    return internalError();
  }
}

import { NextResponse } from "next/server";
