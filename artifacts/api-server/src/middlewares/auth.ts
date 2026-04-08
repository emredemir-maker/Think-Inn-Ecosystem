import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is not set. Cannot run in production without it.");
    }
    // Development fallback — not secure, only for local use
    return new TextEncoder().encode("dev-secret-local-only");
  }
  return new TextEncoder().encode(secret);
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userId = parseInt(payload.sub as string);

    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user && user.isActive) {
      req.user = user;
      // Update last active (non-blocking)
      db.update(usersTable)
        .set({ lastActiveAt: new Date() })
        .where(eq(usersTable.id, userId))
        .catch(() => {});
    }
  } catch {
    // Invalid or expired token — continue as unauthenticated
  }
  next();
}
