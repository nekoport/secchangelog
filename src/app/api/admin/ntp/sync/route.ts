import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  unauthorized,
  forbidden,
  internalError,
  apiSuccess,
} from "@/lib/security/api-response";
import { NtpService } from "@/lib/services/ntp.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

// Runs an NTP query and applies the synchronized time to the system clock.
// Admin-only (changes the server clock).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  let requestedServer: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.server === "string" && body.server.trim()) {
      requestedServer = body.server.trim().slice(0, 255);
    }
  } catch {
    // optional body
  }

  try {
    const result = await NtpService.sync(requestedServer);

    if (!result.success) {
      return apiSuccess({ result, synced: false });
    }

    await AuditTrailService.log({
      userId: session.user.id,
      action: "NTP_SYNC",
      entityType: "System",
      entityId: "ntp",
      metadata: {
        server: result.server,
        offsetMs: result.offsetMs,
        roundTripMs: result.roundTripMs,
        applied: result.applied,
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({ result, synced: true });
  } catch (err) {
    console.error("[API admin/ntp/sync POST]:", err);
    return internalError();
  }
}