import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  internalError,
} from "@/lib/security/api-response";
import { BackupService } from "@/lib/services/backup.service";
import { getClientIp } from "@/lib/security/rate-limit";

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
    const backup = await BackupService.createBackup(session.user.id, {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return apiSuccess(backup, 201);
  } catch (err) {
    console.error("[API admin/backups POST]:", err);
    return internalError(
      "Gagal membuat backup. Pastikan mesin server masih memiliki ruang disk."
    );
  }
}