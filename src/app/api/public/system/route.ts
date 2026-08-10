import { apiSuccess } from "@/lib/security/api-response";
import { SystemSettingService } from "@/lib/services/system-setting.service";

// Public (no-auth) endpoint for identity/branding info:
// system name, logo, favicon, default theme.
export async function GET() {
  const all = await SystemSettingService.getAll();
  return apiSuccess({
    name: all["system.name"] || "SecChangeLog",
    logoPath: all["system.logoPath"],
    faviconPath: all["system.faviconPath"],
    defaultTheme: all["system.defaultTheme"],
  });
}