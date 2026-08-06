import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  internalError,
  validationError,
} from "@/lib/security/api-response";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // Engineer and Auditor can only see their own audit trail
  // Supervisor and Admin can see all
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await AuditTrailService.list({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      userId: parsed.data.userId,
      action: parsed.data.action,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      currentUserRole: session.user.role,
      currentUserId: session.user.id,
    });
    return apiSuccess(result.items, 200, result.meta);
  } catch (err) {
    console.error("[API audit-trail]:", err);
    return internalError();
  }
}
