import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  apiError,
  internalError,
} from "@/lib/security/api-response";
import { FileStorageService } from "@/lib/services/file-storage.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "File wajib diupload", 400);
    }

    if (file.size > 2 * 1024 * 1024) {
      return apiError("FILE_TOO_LARGE", "Ukuran logo maksimal 2MB", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const logoPath = await FileStorageService.saveLogo(
      buffer,
      file.name,
      file.type
    );

    await SystemSettingService.set("system.logoPath", logoPath, session.user.id);

    await AuditTrailService.log({
      userId: session.user.id,
      action: "UPDATE_SYSTEM_LOGO",
      entityType: "SystemSetting",
      entityId: "logo",
      metadata: { path: logoPath, size: file.size },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({ path: logoPath });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("tidak diizinkan") || msg.includes("tidak valid")) {
      return apiError("INVALID_FILE", msg, 400);
    }
    if (msg.includes("melebihi") || msg.includes("maksimal")) {
      return apiError("FILE_TOO_LARGE", msg, 413);
    }
    console.error("[API admin/settings/logo]:", err);
    return internalError();
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  try {
    await FileStorageService.clearLogos();
    await SystemSettingService.set("system.logoPath", "", session.user.id);
    await AuditTrailService.log({
      userId: session.user.id,
      action: "UPDATE_SYSTEM_LOGO",
      entityType: "SystemSetting",
      entityId: "logo",
      metadata: { action: "reset" },
    });
    return apiSuccess({ reset: true });
  } catch (err) {
    console.error("[API admin/settings/logo DELETE]:", err);
    return internalError();
  }
}
