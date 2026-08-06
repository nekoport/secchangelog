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
import { updateUserSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/security/password";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa update user");
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError({ issues: [], flatten: () => ({ formErrors: [], fieldErrors: {} }) } as never);
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return notFound("User tidak ditemukan");

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.ldapDn !== undefined) updateData.ldapDn = parsed.data.ldapDn || null;
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      ldapDn: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: id,
    metadata: { fields: Object.keys(updateData) },
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
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa hapus user");
  }

  const { id } = await params;

  if (id === session.user.id) {
    return conflict("Tidak bisa menghapus akun sendiri", "SELF_DELETE");
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return notFound();

  // Soft delete: just deactivate
  const updated = await db.user.update({
    where: { id },
    data: { isActive: false },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "DEACTIVATE_USER",
    entityType: "User",
    entityId: id,
    metadata: { email: existing.email },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({ id, isActive: false });
}
