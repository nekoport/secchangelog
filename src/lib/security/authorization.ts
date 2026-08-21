export type AppRole = "ENGINEER" | "SUPERVISOR" | "ADMIN" | "AUDITOR";

interface ChangeLogAuthorizationInput {
  role: AppRole;
  userId: string;
  createdById: string;
  isDeleted: boolean;
}

interface ScreenshotDeleteAuthorizationInput {
  role: AppRole;
  userId: string;
  uploadedById: string | null;
  changeLogCreatedById: string | null;
}

interface ScreenshotLinkAuthorizationInput {
  role: AppRole;
  userId: string;
  uploadedById: string | null;
  currentChangeLogId: string | null;
  targetChangeLogId: string;
}

interface SessionStateInput {
  isActive: boolean;
  tokenSessionVersion: number | undefined;
  userSessionVersion: number;
}

export function canUpdateChangeLog({
  role,
  userId,
  createdById,
  isDeleted,
}: ChangeLogAuthorizationInput): boolean {
  if (isDeleted || role === "AUDITOR") return false;
  if (role === "ADMIN") return true;
  return createdById === userId;
}

export function canDeleteScreenshot({
  role,
  userId,
  uploadedById,
  changeLogCreatedById,
}: ScreenshotDeleteAuthorizationInput): boolean {
  if (role === "AUDITOR") return false;
  if (role === "ADMIN") return true;
  return uploadedById === userId || changeLogCreatedById === userId;
}

export function canLinkScreenshot({
  role,
  userId,
  uploadedById,
  currentChangeLogId,
  targetChangeLogId,
}: ScreenshotLinkAuthorizationInput): boolean {
  if (role === "AUDITOR") return false;
  if (currentChangeLogId === targetChangeLogId) return true;
  if (currentChangeLogId !== null) return false;
  return role === "ADMIN" || uploadedById === userId;
}

export function canManageSystemSettings(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canModifySystemAdmin(input: { isSystemAdmin: boolean; fields: string[] }): boolean {
  if (!input.isSystemAdmin) return true;
  return input.fields.every((field) => field === "name" || field === "username" || field === "ldapDn");
}

export function shouldInvalidateSession({
  isActive,
  tokenSessionVersion,
  userSessionVersion,
}: SessionStateInput): boolean {
  return !isActive || tokenSessionVersion !== userSessionVersion;
}
