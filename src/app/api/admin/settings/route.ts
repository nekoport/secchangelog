import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  internalError,
} from "@/lib/security/api-response";
import { updateSettingsSchema } from "@/lib/validations/settings";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";
import { encryptSecret, isLdapEncryptionConfigured } from "@/lib/security/ldap-crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  // All authenticated users can read public settings
  const all = await SystemSettingService.getAll();

  // Mask sensitive fields for non-admin
  if (session.user.role !== "ADMIN") {
    return apiSuccess({
      "system.name": all["system.name"],
      "system.logoPath": all["system.logoPath"],
      "system.faviconPath": all["system.faviconPath"],
      "system.defaultTheme": all["system.defaultTheme"],
      "ldap.enabled": all["ldap.enabled"],
      "password.minLength": all["password.minLength"],
      "password.requireUppercase": all["password.requireUppercase"],
      "password.requireLowercase": all["password.requireLowercase"],
      "password.requireNumber": all["password.requireNumber"],
      "password.requireSymbol": all["password.requireSymbol"],
      "upload.maxFileSizeMb": all["upload.maxFileSizeMb"],
      "session.timeoutHours": all["session.timeoutHours"],
    });
  }

  // For admin, mask LDAP bindPassword in response (security)
  const safeAll = { ...all };
  if (safeAll["ldap.bindPassword"]) {
    safeAll["ldap.bindPassword"] = "********";
  }

  return apiSuccess(safeAll);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Body tidak valid" } },
      { status: 400 }
    );
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  // Non-admin users may only change the system default theme
  if (session.user.role !== "ADMIN") {
    const keys = Object.keys(data);
    const onlyTheme =
      keys.length === 1 && keys[0] === "system.defaultTheme";
    if (!onlyTheme) return forbidden();
  }

  // Skip bindPassword if it's the mask value
  if (data["ldap.bindPassword"] === "********") {
    delete data["ldap.bindPassword"];
  }

  // Only update non-empty password
  if (data["ldap.bindPassword"] === "") {
    delete data["ldap.bindPassword"];
  }

  // Encrypt LDAP bind password before storing
  if (data["ldap.bindPassword"]) {
    if (!isLdapEncryptionConfigured()) {
      return Response.json(
        {
          error: {
            code: "CONFIG_ERROR",
            message:
              "LDAP_ENCRYPTION_KEY belum dikonfigurasi di server. Bind password LDAP tidak dapat disimpan.",
          },
        },
        { status: 500 }
      );
    }
    data["ldap.bindPassword"] = encryptSecret(data["ldap.bindPassword"]);
  }

  if (Object.keys(data).length === 0) {
    return apiSuccess({ updated: false });
  }

  try {
    await SystemSettingService.setMany(
      data as Record<string, string>,
      session.user.id
    );

    await AuditTrailService.log({
      userId: session.user.id,
      action: "UPDATE_SYSTEM_SETTING",
      entityType: "SystemSetting",
      entityId: "settings",
      metadata: { keys: Object.keys(data) },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess({ updated: true, keys: Object.keys(data) });
  } catch (err) {
    console.error("[API admin/settings PATCH]:", err);
    return internalError();
  }
}
