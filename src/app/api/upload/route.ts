import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  apiError,
  unauthorized,
  forbidden,
  internalError,
  tooManyRequests,
  setRateLimitHeaders,
} from "@/lib/security/api-response";
import { FileStorageService } from "@/lib/services/file-storage.service";
import {
  getClientIp,
  rateLimit,
  getRateLimitKey,
} from "@/lib/security/rate-limit";
import { RATE_LIMITS, SCREENSHOT_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import type { ScreenshotType } from "@/lib/constants";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // RBAC: Engineer, Supervisor, Admin can upload screenshots
  if (!["ENGINEER", "SUPERVISOR", "ADMIN"].includes(session.user.role)) {
    return forbidden("Anda tidak punya izin mengunggah screenshot");
  }

  const ip = getClientIp(req);

  // Rate limit: 20 uploads / menit per user
  const rl = rateLimit(
    getRateLimitKey(ip, "upload", session.user.id),
    RATE_LIMITS.UPLOAD
  );
  if (!rl.allowed) {
    return setRateLimitHeaders(
      tooManyRequests("Terlalu banyak upload. Coba lagi nanti."),
      rl
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Form tidak valid", 400);
  }

  const file = formData.get("file");
  const type = formData.get("type");

  if (!file || !(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "File wajib diupload", 400);
  }

  if (
    typeof type !== "string" ||
    !Object.keys(SCREENSHOT_TYPES).includes(type)
  ) {
    return apiError(
      "VALIDATION_ERROR",
      "Tipe screenshot tidak valid. Gunakan BEFORE, AFTER, atau OTHER.",
      400
    );
  }

  // Early size check (sebelum buffer penuh dibaca)
  if (file.size > MAX_FILE_SIZE) {
    return apiError("FILE_TOO_LARGE", "Ukuran file melebihi 10MB", 413);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const screenshot = await FileStorageService.saveScreenshot(
      buffer,
      file.name,
      file.type,
      type as ScreenshotType,
      session.user.id,
      { ipAddress: ip, userAgent: req.headers.get("user-agent") }
    );

    return apiSuccess(
      {
        id: screenshot.id,
        filename: screenshot.filename,
        originalName: screenshot.originalName,
        mimeType: screenshot.mimeType,
        size: screenshot.size,
        type: screenshot.type,
        url: `/api/files/screenshots/${screenshot.id}`,
      },
      201
    );
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("melebihi") || msg.includes("Ukuran")) {
      return apiError("FILE_TOO_LARGE", msg, 413);
    }
    if (
      msg.includes("diizinkan") ||
      msg.includes("tidak valid") ||
      msg.includes("tidak dikenali") ||
      msg.includes("signature")
    ) {
      return apiError("INVALID_FILE", msg, 400);
    }
    console.error("[API upload POST]:", err);
    return internalError();
  }
}
