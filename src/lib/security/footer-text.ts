export function resolveFooterText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback.trim() || "SecChangeLog";
}
