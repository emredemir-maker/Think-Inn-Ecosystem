import { Request, Response, NextFunction } from "express";

export const ROLE_HIERARCHY: Record<string, number> = {
  user: 1,
  master: 2,
  moderator: 3,
  super_admin: 4,
};

export function requireRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor" });
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ success: false, error: "Bu işlem için yetkiniz yok" });
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Giriş yapmanız gerekiyor" });
  }
  next();
}
