import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  forbidden,
  notFound,
  internalError,
  apiSuccess,
} from "@/lib/security/api-response";
import { BackupService } from "@/lib/services/backup.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa akses");
  }

  const { filename } = await params;
  const file = await BackupService.getBackupStream(filename);
  if (!file) return notFound("Backup tidak ditemukan");

  try {
    await AuditTrailService.log({
      userId: session.user.id,
      action: "DOWNLOAD_DATABASE_BACKUP",
      entityType: "DatabaseBackup",
      entityId: filename,
      metadata: { filename, size: file.size },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  } catch {
    // Download should still work if audit logging fails
  }

  return new NextResponse(file.stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa akses");
  }

  const { filename } = await params;
  try {
    const ok = await BackupService.deleteBackup(filename, session.user.id, {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    if (!ok) return notFound("Backup tidak ditemukan");
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[API admin/backups DELETE]:", err);
    return internalError();
  }
}