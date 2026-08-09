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
  createDeviceSchema,
} from "@/lib/validations/settings";
import { getClientIp } from "@/lib/security/rate-limit";
import { AuditTrailService } from "@/lib/services/audit-trail.service";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { searchParams } = new URL(req.url);
  const deviceTypeId = searchParams.get("deviceTypeId");

  const where: Record<string, unknown> = {};
  if (deviceTypeId) where.deviceTypeId = deviceTypeId;

  const items = await db.device.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      deviceType: { select: { id: true, name: true } },
      _count: { select: { changeLogs: true } },
    },
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

  const parsed = createDeviceSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const deviceType = await db.deviceType.findUnique({
    where: { id: parsed.data.deviceTypeId },
  });
  if (!deviceType) {
    return Response.json(
      { error: { code: "DEVICE_TYPE_NOT_FOUND", message: "Jenis perangkat tidak ditemukan" } },
      { status: 404 }
    );
  }

  // Unique within device type
  const existing = await db.device.findUnique({
    where: {
      deviceTypeId_name: {
        deviceTypeId: parsed.data.deviceTypeId,
        name: parsed.data.name,
      },
    },
  });
  if (existing) {
    return Response.json(
      { error: { code: "NAME_EXISTS", message: "Hostname sudah ada untuk jenis perangkat ini" } },
      { status: 409 }
    );
  }

  try {
    const item = await db.device.create({
      data: {
        deviceTypeId: parsed.data.deviceTypeId,
        name: parsed.data.name,
        ipAddress: parsed.data.ipAddress || null,
      },
    });

    await AuditTrailService.log({
      userId: session.user.id,
      action: "CREATE_DEVICE",
      entityType: "Device",
      entityId: item.id,
      metadata: { name: item.name, deviceTypeId: item.deviceTypeId },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess(item, 201);
  } catch (err) {
    console.error("[API admin/devices POST]:", err);
    return internalError();
  }
}