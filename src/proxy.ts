import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthCookieName, isSecureAuthCookie } from "@/lib/security/auth-cookies";

function applyContentSecurityPolicy(
  response: NextResponse,
  contentSecurityPolicy: string
) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

// This function runs on every request that matches the matcher config
export async function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDevelopment = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = [
    "default-src 'self'",
    isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    isDevelopment
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${nonce}' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=' 'sha256-skqujXORqzxt1aE0NNXxujEanPTX6raoqSscTV/Ww/Y='`,
    // Recharts, Radix positioning, and responsive UI primitives generate
    // element-level style attributes. This does not relax script execution.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: getAuthCookieName("session-token"),
    secureCookie: isSecureAuthCookie(),
  });

  const { pathname } = req.nextUrl;

  const publicPaths = [
    "/login",
    "/api/auth",
    "/api/health",
    "/api/public",
    "/api/files/logo",
    "/api/files/favicon",
    "/favicon.ico",
  ];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (pathname === "/favicon.ico") {
    return applyContentSecurityPolicy(
      NextResponse.rewrite(new URL("/logo.svg", req.url)),
      contentSecurityPolicy
    );
  }

  if (isPublic) {
    return applyContentSecurityPolicy(
      NextResponse.next({ request: { headers: requestHeaders } }),
      contentSecurityPolicy
    );
  }

  // If no token, redirect to login
  if (!token) {
    // API routes should return 401 JSON instead of a redirect
    if (pathname.startsWith("/api/")) {
      return applyContentSecurityPolicy(NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      ), contentSecurityPolicy);
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return applyContentSecurityPolicy(
      NextResponse.redirect(loginUrl),
      contentSecurityPolicy
    );
  }

  return applyContentSecurityPolicy(
    NextResponse.next({ request: { headers: requestHeaders } }),
    contentSecurityPolicy
  );
}

export const config = {
  matcher: [
    "/((?!_next/|uploads).*)",
  ],
};
