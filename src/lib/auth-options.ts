import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/security/password";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { SystemSettingService } from "@/lib/services/system-setting.service";
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  RATE_LIMITS,
} from "@/lib/constants";
import { rateLimit, getRateLimitKey } from "@/lib/security/rate-limit";
import type { Role } from "@/lib/constants";
import { authenticateLdap } from "@/lib/ldap";

function getClientIpFromHeaders(headers?: Record<string, string | undefined>): string | null {
  if (!headers) return null;
  const xff = headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return headers["x-real-ip"] || null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const ip = getClientIpFromHeaders(
          req?.headers as Record<string, string | undefined>
        );
        const userAgent = req?.headers?.["user-agent"] || null;

        // Rate limit by IP
        const rlKey = getRateLimitKey(ip || "unknown", "login");
        const rl = rateLimit(rlKey, RATE_LIMITS.LOGIN);
        if (!rl.allowed) {
          throw new Error(
            "Terlalu banyak percobaan login. Coba lagi dalam 15 menit."
          );
        }

        const email = credentials.email.toLowerCase().trim();

        // Find user
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          await AuditTrailService.log({
            userId: "unknown",
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: email,
            metadata: { reason: "USER_NOT_FOUND", email },
            ipAddress: ip,
            userAgent,
          });
          return null;
        }

        // Check active
        if (!user.isActive) {
          await AuditTrailService.log({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "ACCOUNT_DEACTIVATED" },
            ipAddress: ip,
            userAgent,
          });
          throw new Error("Akun Anda dinonaktifkan. Hubungi administrator.");
        }

        // Check lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const remainingMs = user.lockedUntil.getTime() - Date.now();
          const remainingMin = Math.ceil(remainingMs / 60000);
          await AuditTrailService.log({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            metadata: { reason: "ACCOUNT_LOCKED" },
            ipAddress: ip,
            userAgent,
          });
          throw new Error(
            `Akun terkunci. Coba lagi dalam ${remainingMin} menit.`
          );
        }

        let passwordValid = false;

        // Try local auth if passwordHash exists
        if (user.passwordHash) {
          passwordValid = await verifyPassword(
            credentials.password,
            user.passwordHash
          );
        }

        // Try LDAP if enabled and user has ldapDn (or no local password)
        if (!passwordValid) {
          const ldapEnabled = await SystemSettingService.isLdapEnabled();
          if (ldapEnabled) {
            try {
              const ldapResult = await authenticateLdap(
                user.ldapDn || email,
                credentials.password
              );
              if (ldapResult.success) {
                passwordValid = true;
                // If user had no ldapDn set, persist it
                if (!user.ldapDn && ldapResult.dn) {
                  await db.user.update({
                    where: { id: user.id },
                    data: { ldapDn: ldapResult.dn },
                  });
                }
              }
            } catch (err) {
              console.error("[LDAP] Auth failed:", err);
            }
          }
        }

        if (!passwordValid) {
          // Increment failed attempts
          const newAttempts = user.failedAttempts + 1;
          const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: shouldLock ? 0 : newAttempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCKOUT_DURATION_MS)
                : null,
            },
          });

          await AuditTrailService.log({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            metadata: {
              reason: "INVALID_PASSWORD",
              attempts: newAttempts,
              locked: shouldLock,
            },
            ipAddress: ip,
            userAgent,
          });

          if (shouldLock) {
            await AuditTrailService.log({
              userId: user.id,
              action: "ACCOUNT_LOCKED",
              entityType: "User",
              entityId: user.id,
              metadata: { reason: "MAX_FAILED_ATTEMPTS" },
              ipAddress: ip,
              userAgent,
            });
            throw new Error(
              "Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit."
            );
          }

          return null;
        }

        // Success: reset failed attempts, update last login
        await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ip,
          },
        });

        await AuditTrailService.log({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "User",
          entityId: user.id,
          metadata: { ip },
          ipAddress: ip,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
