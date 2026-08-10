import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  apiError,
  internalError,
} from "@/lib/security/api-response";
import {
  createChangeLogSchema,
  listChangeLogsQuerySchema,
} from "@/lib/validations/change-log";
import { ChangeLogService } from "@/lib/services/change-log.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const parsed = listChangeLogsQuerySchema.safeParse(query);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await ChangeLogService.list({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      search: parsed.data.search,
      deviceTypeId: parsed.data.deviceTypeId,
      riskLevel: parsed.data.riskLevel,
      picId: parsed.data.picId,
      changeType: parsed.data.changeType,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      includeDeleted:
        parsed.data.includeDeleted &&
        (session.user.role === "ADMIN" || session.user.role === "AUDITOR"),
      sort: parsed.data.sort,
      currentUserRole: session.user.role,
      currentUserId: session.user.id,
    });
    return apiSuccess(result.items, 200, result.meta);
  } catch (err) {
    console.error("[API change-logs GET]:", err);
    return internalError();
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // RBAC: Engineer, Supervisor, Admin can create
  if (
    !["ENGINEER", "SUPERVISOR", "ADMIN"].includes(session.user.role)
  ) {
    return forbidden("Anda tidak punya izin membuat change log");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body tidak valid", 400);
  }

  const parsed = createChangeLogSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const changeLog = await ChangeLogService.create(
      parsed.data,
      session.user.id,
      {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      }
    );
    return apiSuccess(changeLog, 201);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "DEVICE_TYPE_NOT_FOUND") {
      return apiError("NOT_FOUND", "Jenis perangkat tidak ditemukan", 404);
    }
    console.error("[API change-logs POST]:", err);
    return internalError();
  }
}
