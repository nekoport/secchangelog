import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  apiSuccess,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
} from "@/lib/security/api-response";
import { approveDeleteRequestSchema } from "@/lib/validations/settings";
import { DeleteRequestService } from "@/lib/services/delete-request.service";
import { getClientIp } from "@/lib/security/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { id } = await params;

  if (!["SUPERVISOR", "ADMIN"].includes(session.user.role)) {
    return forbidden("Hanya Supervisor atau Admin yang bisa reject");
  }

  let body: { note?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Allow empty body
  }

  const parsed = approveDeleteRequestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await DeleteRequestService.reject(
      id,
      parsed.data.note,
      session.user.id,
      session.user.role,
      {
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent"),
      }
    );
    return apiSuccess(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "NOT_FOUND") return notFound();
    if (msg === "FORBIDDEN") return forbidden();
    if (msg === "ALREADY_PROCESSED") {
      return conflict("Request ini sudah diproses");
    }
    console.error("[API reject]:", err);
    return internalError();
  }
}
