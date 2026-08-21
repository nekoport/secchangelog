import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { apiSuccess, unauthorized, validationError } from "@/lib/security/api-response";
import { z } from "zod";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const updated = await db.user.update({ where: { id: session.user.id }, data: { name: parsed.data.name }, select: { id: true, name: true } });
  await AuditTrailService.log({ userId: session.user.id, action: "UPDATE_USER", entityType: "User", entityId: session.user.id, metadata: { fields: ["name"] }, ipAddress: getClientIp(req), userAgent: req.headers.get("user-agent") });
  return apiSuccess(updated);
}
