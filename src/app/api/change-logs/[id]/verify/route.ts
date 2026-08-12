import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  unauthorized,
  forbidden,
  notFound,
  internalError,
} from "@/lib/security/api-response";
import { ChangeLogService } from "@/lib/services/change-log.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  // Only Supervisor, Admin (and Auditor) can verify a change log
  if (!["SUPERVISOR", "ADMIN", "AUDITOR"].includes(session.user.role)) {
    return forbidden("Hanya Supervisor/Admin yang bisa verifikasi");
  }

  try {
    const updated = await ChangeLogService.verify(id, session.user.id, {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return apiSuccess(updated);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return notFound();
    console.error("[API verify]:", err);
    return internalError();
  }
}