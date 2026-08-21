import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { hashPassword } from "@/lib/security/password";
import { passwordSchema } from "@/lib/validations/user";
import { db } from "@/lib/db";
import {
  apiSuccess,
  validationError,
  unauthorized,
  apiError,
} from "@/lib/security/api-response";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import {
  getClientIp,
  rateLimit,
  getRateLimitKey,
} from "@/lib/security/rate-limit";
import { tooManyRequests, setRateLimitHeaders } from "@/lib/security/api-response";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // Rate limit per user (10 / min)
  const ip = getClientIp(req);
  const rlKey = getRateLimitKey(ip, "change-password", session.user.id);
  const rl = rateLimit(rlKey, { requests: 10, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return setRateLimitHeaders(tooManyRequests(), rl);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body tidak valid", 400);
  }

  const parsed = (
    await import("@/lib/validations/user")
  ).changePasswordSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return unauthorized();
  if (user.isSystemAdmin) return apiError("FORBIDDEN", "Password System Administrator hanya dapat diubah melalui backend.", 403);
  if (!user.passwordHash) {
    return apiError("FORBIDDEN", "User ini menggunakan LDAP, tidak bisa ganti password lokal", 403);
  }

  const { verifyPassword } = await import("@/lib/security/password");
  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return apiError("INVALID_CREDENTIALS", "Password saat ini salah", 401);
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      sessionVersion: { increment: 1 },
    },
  });

  await AuditTrailService.log({
    userId: session.user.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: user.id,
    metadata: { action: "change_password" },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({ success: true });
}
