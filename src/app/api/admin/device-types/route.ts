import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  conflict,
  internalError,
} from "@/lib/security/api-response";
import {
  createDeviceTypeSchema,
  updateDeviceTypeSchema,
} from "@/lib/validations/settings";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const items = await db.deviceType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return apiSuccess(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Body tidak valid" } },
      { status: 400 }
    );
  }

  const parsed = createDeviceTypeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.deviceType.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing) return conflict("Nama device type sudah ada", "NAME_EXISTS");

  try {
    const item = await db.deviceType.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    await AuditTrailService.log({
      userId: session.user.id,
      action: "CREATE_DEVICE_TYPE",
      entityType: "DeviceType",
      entityId: item.id,
      metadata: { name: item.name },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess(item, 201);
  } catch (err) {
    console.error("[API admin/device-types POST]:", err);
    return internalError();
  }
}
