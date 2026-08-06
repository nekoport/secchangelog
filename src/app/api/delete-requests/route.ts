import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  apiError,
  internalError,
} from "@/lib/security/api-response";
import { createDeleteRequestSchema } from "@/lib/validations/settings";
import { DeleteRequestService } from "@/lib/services/delete-request.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
  const status = url.searchParams.get("status") || undefined;
  const requestedById = url.searchParams.get("requestedById") || undefined;

  try {
    const result = await DeleteRequestService.list({
      page,
      pageSize,
      status,
      requestedById,
      currentUserRole: session.user.role,
      currentUserId: session.user.id,
    });
    return apiSuccess(result.items, 200, result.meta);
  } catch (err) {
    console.error("[API delete-requests GET]:", err);
    return internalError();
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  if (!["ENGINEER", "SUPERVISOR", "ADMIN"].includes(session.user.role)) {
    return forbidden("Auditor tidak bisa mengajukan penghapusan");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body tidak valid", 400);
  }

  const parsed = createDeleteRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const dr = await DeleteRequestService.create(
      parsed.data.changeLogId,
      parsed.data.reason,
      session.user.id,
      session.user.role,
      {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      }
    );
    return apiSuccess(dr, 201);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "CHANGE_LOG_NOT_FOUND") return notFound("Change log tidak ditemukan");
    if (msg === "ALREADY_DELETED") return conflict("Change log sudah dihapus");
    if (msg === "PENDING_REQUEST_EXISTS") {
      return conflict(
        "Sudah ada request penghapusan pending untuk change log ini",
        "PENDING_REQUEST_EXISTS"
      );
    }
    if (msg === "FORBIDDEN") return forbidden();
    console.error("[API delete-requests POST]:", err);
    return internalError();
  }
}
