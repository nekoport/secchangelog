import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import type { Role } from "./constants";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, authorized: false };
  }
  if (!roles.includes(session.user.role)) {
    return { session, authorized: false };
  }
  return { session, authorized: true };
}
