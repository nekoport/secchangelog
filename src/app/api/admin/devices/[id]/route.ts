import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
} from "@/lib/security/api-response";
import { updateDeviceSchema } from "@/lib/validations/settings";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Body tidak valid" } },
      { status: 400 }
    );
  }

  const parsed = updateDeviceSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.device.findUnique({ where: { id } });
  if (!existing) return notFound();

  if (parsed.data.deviceTypeId) {
    const deviceType = await db.deviceType.findUnique({
      where: { id: parsed.data.deviceTypeId },
    });
    if (!deviceType) {
      return Response.json(
        { error: { code: "DEVICE_TYPE_NOT_FOUND", message: "Jenis perangkat tidak ditemukan" } },
        { status: 404 }
      );
    }
  }

  if (parsed.data.name) {
    const newTypeId = parsed.data.deviceTypeId ?? existing.deviceTypeId;
    const nameExists = await db.device.findUnique({
      where: {
        deviceTypeId_name: { deviceTypeId: newTypeId, name: parsed.data.name },
      },
    });
    if (nameExists && nameExists.id !== id) {
      return conflict("Hostname sudah ada untuk jenis perangkat ini", "NAME_EXISTS");
    }
  }

  const updated = await db.device.update({
    where: { id },
    data: {
      deviceTypeId: parsed.data.deviceTypeId ?? undefined,
      name: parsed.data.name ?? undefined,
      ipAddress: parsed.data.ipAddress ?? undefined,
    },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "UPDATE_DEVICE",
    entityType: "Device",
    entityId: id,
    metadata: { fields: Object.keys(parsed.data) },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const existing = await db.device.findUnique({
    where: { id },
    include: { _count: { select: { changeLogs: true } } },
  });
  if (!existing) return notFound();

  if (existing._count.changeLogs > 0) {
    // Soft delete: just deactivate
    await db.device.update({
      where: { id },
      data: { isActive: false },
    });
    await AuditTrailService.log({
      userId: session.user.id,
      action: "DEACTIVATE_DEVICE",
      entityType: "Device",
      entityId: id,
      metadata: { reason: "in_use", count: existing._count.changeLogs },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return apiSuccess({ id, isActive: false, deactivated: true });
  }

  await db.device.delete({ where: { id } });
  await AuditTrailService.log({
    userId: session.user.id,
    action: "DEACTIVATE_DEVICE",
    entityType: "Device",
    entityId: id,
    metadata: { reason: "hard_delete" },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  return apiSuccess({ id, deleted: true });
}