import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  unauthorized,
  apiError,
} from "@/lib/security/api-response";

export async function GET() {
  try {
    // Use Prisma client to check DB connection (no raw SQL)
    await db.user.count();
    const session = await getServerSession(authOptions);
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "connected",
      auth: session ? "authenticated" : "anonymous",
      version: "1.0.0",
    });
  } catch (err) {
    console.error("[API health]:", err);
    return Response.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        db: "disconnected",
      },
      { status: 503 }
    );
  }
}

// Helper for auth checks
export { getServerSession, authOptions, db, unauthorized, apiError };
