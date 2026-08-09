import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import {
  apiSuccess,
  unauthorized,
  internalError,
} from "@/lib/security/api-response";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const deviceTypeId = searchParams.get("deviceTypeId");

  const where: Record<string, unknown> = { isActive: true };
  if (deviceTypeId) where.deviceTypeId = deviceTypeId;

  try {
    const items = await db.device.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        deviceTypeId: true,
      },
    });
    return apiSuccess(items);
  } catch (err) {
    console.error("[API devices GET]:", err);
    return internalError();
  }
}
