import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  internalError,
} from "@/lib/security/api-response";
import { BackupService } from "@/lib/services/backup.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { MAX_BACKUP_UPLOAD_SIZE } from "@/lib/constants";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa akses");
  }

  try {
    const backups = await BackupService.listBackups();
    return apiSuccess(backups);
  } catch (err) {
    console.error("[API admin/backups GET]:", err);
    return internalError();
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa akses");
  }

  try {
    if ((req.headers.get("content-type") || "").toLowerCase().includes("multipart/form-data")) {
      const declared = Number(req.headers.get("content-length"));
      // Multipart Content-Length includes boundary overhead; cap it with a small allowance.
      if (!Number.isSafeInteger(declared) || declared <= 0 || declared > MAX_BACKUP_UPLOAD_SIZE + 64 * 1024) {
        return new Response(JSON.stringify({ error: { message: "Ukuran arsip tidak valid atau melebihi 100 MiB." } }), { status: 413, headers: { "Content-Type": "application/json" } });
      }
      const form = await req.formData();
      const entry = form.get("file");
      if (!(entry instanceof File)) return new Response(JSON.stringify({ error: { message: "Pilih arsip backup .tar.gz." } }), { status: 400, headers: { "Content-Type": "application/json" } });
      const backup = await BackupService.uploadBackup(entry);
      await AuditTrailService.log({ userId: session.user.id, action: "UPLOAD_DATABASE_BACKUP", entityType: "DatabaseBackup", entityId: backup.filename, metadata: { filename: backup.filename, size: backup.size }, ipAddress: getClientIp(req), userAgent: req.headers.get("user-agent") });
      return apiSuccess({ ...backup, message: "Arsip backup berhasil ditambahkan ke pustaka. Restore belum dijalankan." }, 201);
    }
    const backup = await BackupService.createBackup(session.user.id, {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return apiSuccess(backup, 201);
  } catch (err) {
    console.error("[API admin/backups POST]:", err);
    if (err instanceof Error && err.message === "ARCHIVE_TOO_LARGE") {
      return new Response(JSON.stringify({ error: { message: "Arsip melebihi batas ukuran isi 512 MiB." } }), { status: 413, headers: { "Content-Type": "application/json" } });
    }
    if (err instanceof Error && ["INVALID_SIZE", "INVALID_ARCHIVE", "UNSAFE_ARCHIVE", "MISSING_DATABASE", "INVALID_DATABASE"].includes(err.message)) {
      return new Response(JSON.stringify({ error: { message: "Arsip tidak valid. Pastikan ini backup SecChangeLog yang utuh dan tidak melebihi 100 MiB." } }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    return internalError(
      "Gagal membuat backup. Pastikan mesin server masih memiliki ruang disk."
    );
  }
}
