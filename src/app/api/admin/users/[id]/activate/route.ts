import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  internalError,
} from "@/lib/security/api-response";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return notFound();
  if (existing.isSystemAdmin) return forbidden("Status System Administrator hanya dapat diubah melalui backend.");

  await db.user.update({
    where: { id },
    data: {
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "ACTIVATE_USER",
    entityType: "User",
    entityId: id,
    metadata: { email: existing.email },
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({ id, isActive: true });
}
