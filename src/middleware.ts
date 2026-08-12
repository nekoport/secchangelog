import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// This function runs on every request that matches the matcher config
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "__Host-next-auth.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });

  const { pathname } = req.nextUrl;

  // Allow public routes (already excluded by matcher, but double-check)
  const publicPaths = ["/login"];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isPublic) {
    return NextResponse.next();
  }

  // If no token, redirect to login
  if (!token) {
    // API routes should return 401 JSON instead of a redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except: login, API auth/health/public, static, uploads
    "/((?!login|api/auth|api/health|api/public|api/files/logo|api/files/favicon|_next/static|_next/image|favicon.ico|uploads|api/dashboard|api/device-types).*)",
  ],
};
