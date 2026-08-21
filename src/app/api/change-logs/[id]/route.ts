import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  apiError,
  internalError,
} from "@/lib/security/api-response";
import { updateChangeLogSchema } from "@/lib/validations/change-log";
import { ChangeLogService } from "@/lib/services/change-log.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  try {
    const log = await ChangeLogService.getById(id, { includeScreenshots: true });
    if (!log) return notFound("Change log tidak ditemukan");
    if (log.isDeleted && session.user.role !== "ADMIN" && session.user.role !== "AUDITOR") {
      return notFound("Change log tidak ditemukan");
    }
    return apiSuccess(log);
  } catch (err) {
    console.error("[API change-logs/[id] GET]:", err);
    return internalError();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body tidak valid", 400);
  }

  const parsed = updateChangeLogSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const updated = await ChangeLogService.update(
      id,
      parsed.data,
      session.user.id,
      session.user.role,
      {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      }
    );
    return apiSuccess(updated);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return notFound();
    if (msg === "FORBIDDEN") return forbidden();
    console.error("[API change-logs/[id] PATCH]:", err);
    return internalError();
  }
}

export async function DELETE() {
  // Direct delete not allowed - must go through delete-request workflow
  return apiError(
    "METHOD_NOT_ALLOWED",
    "Penghapusan change log harus melalui delete request. Lihat /api/delete-requests",
    405
  );
}
