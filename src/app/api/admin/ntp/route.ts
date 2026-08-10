import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  internalError,
} from "@/lib/security/api-response";
import { NtpService } from "@/lib/services/ntp.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const configSchema = z.object({
  server: z.string().trim().min(1).max(255),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  try {
    const server = await NtpService.getServer();
    const check = await NtpService.check();
    const capability = NtpService.getCapability();

    return apiSuccess({
      server,
      capability: {
        canSetTime: capability,
        hint: capability
          ? undefined
          : "Kontainer tidak memiliki CAP_SYS_TIME. Tambahkan cap_add: [SYS_TIME] di docker-compose agar sync waktu bisa diterapkan.",
      },
      check,
    });
  } catch (err) {
    console.error("[API admin/ntp GET]:", err);
    return internalError();
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Body tidak valid" } },
      { status: 400 }
    );
  }

  const parsed = configSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await SystemSettingService.set(
      "ntp.server",
      parsed.data.server,
      session.user.id
    );

    await AuditTrailService.log({
      userId: session.user.id,
      action: "UPDATE_NTP_SETTING",
      entityType: "SystemSetting",
      entityId: "ntp",
      metadata: { key: "ntp.server", value: parsed.data.server },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({ updated: true, server: parsed.data.server });
  } catch (err) {
    console.error("[API admin/ntp PATCH]:", err);
    return internalError();
  }
}