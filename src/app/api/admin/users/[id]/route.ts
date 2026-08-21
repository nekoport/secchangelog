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
import { canModifySystemAdmin } from "@/lib/security/authorization";

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
  const requestedFields = Object.keys(parsed.data).filter((field) => parsed.data[field as keyof typeof parsed.data] !== undefined);
  if (!canModifySystemAdmin({ isSystemAdmin: existing.isSystemAdmin, fields: requestedFields })) {
    return conflict("Akun System Administrator hanya dapat diubah namanya.", "SYSTEM_ADMIN_LOCKED");
  }

  // An administrator cannot remove their own access. Other ADMIN accounts are
  // managed like regular accounts; only isSystemAdmin is permanently locked.
  if (id === session.user.id && parsed.data.role && parsed.data.role !== "ADMIN") {
    return conflict("Tidak bisa mengubah role akun sendiri", "SELF_ROLE_CHANGE");
  }
  if (parsed.data.role === "ADMIN" && !existing.role) {
    // no-op, role always present; guard for clarity
  }
  if (id === session.user.id && parsed.data.isActive === false) {
    return conflict("Tidak bisa menonaktifkan akun sendiri", "SELF_DEACTIVATE");
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.username !== undefined) {
    const newUsername = parsed.data.username.trim();
    if (newUsername) {
      const clash = await db.user.findFirst({
        where: { username: newUsername, NOT: { id } },
      });
      if (clash) return conflict("Username sudah terdaftar", "USERNAME_EXISTS");
      updateData.username = newUsername;
    }
  }
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.ldapDn !== undefined) updateData.ldapDn = parsed.data.ldapDn || null;
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }
  if (
    parsed.data.password ||
    parsed.data.role !== undefined ||
    parsed.data.isActive !== undefined
  ) {
    updateData.sessionVersion = { increment: 1 };
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      ldapDn: true,
      isActive: true,
      isSystemAdmin: true,
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

  if (existing.isSystemAdmin) return conflict("Akun System Administrator tidak dapat dihapus.", "SYSTEM_ADMIN_LOCKED");

  // Prefer hard-delete, but only when the user has no history that still
  // references them (ChangeLog pic/creator, DeleteRequest, SystemSetting).
  // Otherwise fall back to deactivating so audit history stays intact.
  const [picCount, creatorCount, reqCount, approvedCount, settingCount] =
    await Promise.all([
      db.changeLog.count({ where: { picId: id } }),
      db.changeLog.count({ where: { createdById: id } }),
      db.deleteRequest.count({ where: { requestedById: id } }),
      db.deleteRequest.count({ where: { approvedById: id } }),
      db.systemSetting.count({ where: { updatedById: id } }),
    ]);

  const historyCount =
    picCount + creatorCount + reqCount + approvedCount + settingCount;

  if (historyCount > 0) {
    await db.user.update({
      where: { id },
      data: {
        isActive: false,
        sessionVersion: { increment: 1 },
      },
    });

    await AuditTrailService.log({
      userId: session.user.id,
      action: "DEACTIVATE_USER",
      entityType: "User",
      entityId: id,
      metadata: {
        email: existing.email,
        reason: "HAS_HISTORY",
        history: {
          changeLogsPic: picCount,
          changeLogsCreator: creatorCount,
          deleteRequestsRequested: reqCount,
          deleteRequestsApproved: approvedCount,
          systemSettingsUpdated: settingCount,
        },
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({
      id,
      isActive: false,
      deleted: false,
      message: `User memiliki riwayat aktivitas (${historyCount} data) sehingga hanya dinonaktifkan.`,
    });
  }

  // No history: safe to remove the account entirely.
  await db.user.delete({ where: { id } });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "DELETE_USER",
    entityType: "User",
    entityId: id,
    metadata: { email: existing.email },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({ id, isActive: false, deleted: true });
}
