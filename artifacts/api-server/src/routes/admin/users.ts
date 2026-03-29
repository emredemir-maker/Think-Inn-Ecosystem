import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, permissionAuditLogTable } from "@workspace/db";
import { eq, ilike, and, or, desc } from "drizzle-orm";
import { requireRole } from "../../middlewares/requireRole";
import { ROLE_HIERARCHY } from "../../middlewares/requireRole";
import { z } from "zod";

const router = Router();

// GET /api/admin/users
router.get("/", requireRole("moderator"), async (req, res) => {
  const { search, role, isActive, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(Math.max(1, parseInt(limit)), 100);
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(usersTable.displayName, `%${search}%`),
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
      ) as any
    );
  }
  if (role) conditions.push(eq(usersTable.role, role as any));
  if (isActive !== undefined) conditions.push(eq(usersTable.isActive, isActive === "true"));

  const base = db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    email: usersTable.email,
    role: usersTable.role,
    isActive: usersTable.isActive,
    avatarUrl: usersTable.avatarUrl,
    lastActiveAt: usersTable.lastActiveAt,
    createdAt: usersTable.createdAt,
  }).from(usersTable);

  const query = conditions.length > 0
    ? base.where(and(...conditions))
    : base;

  const users = await query
    .orderBy(desc(usersTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ success: true, data: users });
});

// GET /api/admin/users/:id
router.get("/:id", requireRole("moderator"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: "Geçersiz ID" });

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio,
      pageAccess: usersTable.pageAccess,
      lastActiveAt: usersTable.lastActiveAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) return res.status(404).json({ success: false, error: "Kullanıcı bulunamadı" });
  res.json({ success: true, data: user });
});

// PATCH /api/admin/users/:id/role
router.patch("/:id/role", requireRole("super_admin"), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ success: false, error: "Geçersiz ID" });
  if (targetId === req.user!.id) {
    return res.status(400).json({ success: false, error: "Kendi rolünüzü değiştiremezsiniz" });
  }

  const { role, reason } = z
    .object({ role: z.enum(["super_admin", "moderator", "master", "user"]), reason: z.string().optional() })
    .parse(req.body);

  const [target] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!target) return res.status(404).json({ success: false, error: "Kullanıcı bulunamadı" });

  await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
  await db.insert(permissionAuditLogTable).values({
    actorId: req.user!.id,
    targetUserId: targetId,
    fieldChanged: "role",
    oldValue: target.role,
    newValue: role,
    reason,
  });

  res.json({ success: true });
});

// PATCH /api/admin/users/:id/active
router.patch("/:id/active", requireRole("moderator"), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ success: false, error: "Geçersiz ID" });
  if (targetId === req.user!.id) {
    return res.status(400).json({ success: false, error: "Kendi hesabınızı devre dışı bırakamazsınız" });
  }

  const { isActive, reason } = z
    .object({ isActive: z.boolean(), reason: z.string().optional() })
    .parse(req.body);

  const [target] = await db
    .select({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!target) return res.status(404).json({ success: false, error: "Kullanıcı bulunamadı" });

  const actorLevel = ROLE_HIERARCHY[req.user!.role] ?? 0;
  const targetLevel = ROLE_HIERARCHY[target.role] ?? 0;
  if (targetLevel >= ROLE_HIERARCHY["moderator"] && actorLevel < ROLE_HIERARCHY["super_admin"]) {
    return res.status(403).json({ success: false, error: "Moderatör veya üzeri bir hesabı yalnızca süper admin devre dışı bırakabilir" });
  }

  await db.update(usersTable).set({ isActive, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
  await db.insert(permissionAuditLogTable).values({
    actorId: req.user!.id,
    targetUserId: targetId,
    fieldChanged: "is_active",
    oldValue: String(target.isActive),
    newValue: String(isActive),
    reason,
  });

  res.json({ success: true });
});

// PATCH /api/admin/users/:id/page-access
router.patch("/:id/page-access", requireRole("super_admin"), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ success: false, error: "Geçersiz ID" });

  const { pageAccess } = z
    .object({ pageAccess: z.array(z.object({ page: z.string(), granted: z.boolean() })) })
    .parse(req.body);

  await db.update(usersTable).set({ pageAccess, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
  res.json({ success: true });
});

// GET /api/admin/audit-log
router.get("/audit-log/list", requireRole("super_admin"), async (req, res) => {
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;

  const logs = await db
    .select()
    .from(permissionAuditLogTable)
    .orderBy(desc(permissionAuditLogTable.createdAt))
    .limit(Math.min(parseInt(limit), 200))
    .offset(parseInt(offset));

  res.json({ success: true, data: logs });
});

export default router;
