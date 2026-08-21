import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  conflict,
  apiError,
  internalError,
} from "@/lib/security/api-response";
import { createUserSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/security/password";
import { AuditTrailService } from "@/lib/services/audit-trail.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa akses");
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
  const search = url.searchParams.get("search") || undefined;
  const role = url.searchParams.get("role") || undefined;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { username: { contains: search } },
      { name: { contains: search } },
    ];
  }
  if (role) where.role = role;

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isSystemAdmin: true,
        ldapDn: true,
        isActive: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);

  return apiSuccess(items, 200, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();
  if (session.user.role !== "ADMIN") {
    return forbidden("Hanya Admin yang bisa create user");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body tidak valid", 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // Check email unique
  const existing = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing) {
    return conflict("Email sudah terdaftar", "EMAIL_EXISTS");
  }

  // Determine username: explicit value or derive from email
  let username = parsed.data.username?.trim();
  if (!username) {
    username = parsed.data.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase()
      .slice(0, 50);
  }
  const usernameClash = await db.user.findFirst({
    where: { username },
  });
  if (usernameClash) {
    return conflict("Username sudah terdaftar", "USERNAME_EXISTS");
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await db.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        username,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
        ldapDn: parsed.data.ldapDn || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isSystemAdmin: true,
        ldapDn: true,
        isActive: true,
        createdAt: true,
      },
    });

    await AuditTrailService.log({
      userId: session.user.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, username: user.username, name: user.name, role: user.role },
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return apiSuccess(user, 201);
  } catch (err) {
    console.error("[API admin/users POST]:", err);
    return internalError();
  }
}
