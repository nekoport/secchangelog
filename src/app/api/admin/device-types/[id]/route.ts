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
import { updateDeviceTypeSchema } from "@/lib/validations/settings";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET() {
  // Get all (including inactive)
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const items = await db.deviceType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { changeLogs: true } } },
  });
  return apiSuccess(items);
}

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

  const parsed = updateDeviceTypeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.deviceType.findUnique({ where: { id } });
  if (!existing) return notFound();

  if (parsed.data.name) {
    const nameExists = await db.deviceType.findUnique({
      where: { name: parsed.data.name },
    });
    if (nameExists && nameExists.id !== id) {
      return conflict("Nama sudah dipakai", "NAME_EXISTS");
    }
  }

  const updated = await db.deviceType.update({
    where: { id },
    data: {
      name: parsed.data.name ?? undefined,
      description: parsed.data.description ?? undefined,
    },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "UPDATE_DEVICE_TYPE",
    entityType: "DeviceType",
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

  const existing = await db.deviceType.findUnique({
    where: { id },
    include: { _count: { select: { changeLogs: true } } },
  });
  if (!existing) return notFound();

  if (existing._count.changeLogs > 0) {
    // Soft delete: just deactivate
    await db.deviceType.update({
      where: { id },
      data: { isActive: false },
    });
    await AuditTrailService.log({
      userId: session.user.id,
      action: "DEACTIVATE_DEVICE_TYPE",
      entityType: "DeviceType",
      entityId: id,
      metadata: { reason: "in_use", count: existing._count.changeLogs },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return apiSuccess({ id, isActive: false, deactivated: true });
  }

  await db.deviceType.delete({ where: { id } });
  await AuditTrailService.log({
    userId: session.user.id,
    action: "DEACTIVATE_DEVICE_TYPE",
    entityType: "DeviceType",
    entityId: id,
    metadata: { reason: "hard_delete" },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  return apiSuccess({ id, deleted: true });
}
