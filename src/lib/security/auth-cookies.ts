export function getAuthCookieName(suffix: string, isProduction = process.env.NODE_ENV === "production"): string {
  return `${isProduction ? "__Host-" : ""}next-auth.${suffix}`;
}

export function isSecureAuthCookie(isProduction = process.env.NODE_ENV === "production"): boolean {
  return isProduction;
}
