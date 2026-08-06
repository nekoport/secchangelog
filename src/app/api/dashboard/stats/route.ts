import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  internalError,
} from "@/lib/security/api-response";
import { ChangeLogService } from "@/lib/services/change-log.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  try {
    const [stats, recentActivity] = await Promise.all([
      ChangeLogService.getStats(),
      AuditTrailService.list({
        page: 1,
        pageSize: 10,
        currentUserRole: session.user.role,
        currentUserId: session.user.id,
      }),
    ]);

    return apiSuccess({
      ...stats,
      recentActivity: recentActivity.items,
    });
  } catch (err) {
    console.error("[API dashboard/stats]:", err);
    return internalError();
  }
}
