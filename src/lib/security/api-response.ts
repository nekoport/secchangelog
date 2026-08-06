import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function apiSuccess<T>(
  data: T,
  status: number = 200,
  meta?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number = 400,
  details?: Array<{ field: string; message: string }>,
  requestId?: string
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
        requestId: requestId || crypto.randomUUID(),
      },
    },
    { status }
  );
}

export function validationError(zodError: ZodError) {
  const details = zodError.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  return apiError("VALIDATION_ERROR", "Input tidak valid", 400, details);
}

export function unauthorized(message: string = "Tidak terautentikasi") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function forbidden(message: string = "Akses ditolak") {
  return apiError("FORBIDDEN", message, 403);
}

export function notFound(message: string = "Resource tidak ditemukan") {
  return apiError("NOT_FOUND", message, 404);
}

export function conflict(message: string, code: string = "CONFLICT") {
  return apiError(code, message, 409);
}

export function tooManyRequests(
  message: string = "Terlalu banyak request. Coba lagi nanti."
) {
  return apiError("RATE_LIMIT_EXCEEDED", message, 429);
}

export function internalError(
  message: string = "Terjadi kesalahan internal. Silakan coba lagi."
) {
  return apiError("INTERNAL_ERROR", message, 500);
}

export function setRateLimitHeaders(
  response: NextResponse,
  result: { remaining: number; resetAt: number; total: number }
) {
  response.headers.set("X-RateLimit-Limit", String(result.total));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.floor(result.resetAt / 1000))
  );
  return response;
}
