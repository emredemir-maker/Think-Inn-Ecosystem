import { Router } from "express";
import { db } from "@workspace/db";
import { departmentsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireRole } from "../../middlewares/requireRole";
import { z } from "zod";

const router = Router();

const deptSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().default(""),
  isActive: z.boolean().optional().default(true),
});

router.get("/", async (_req, res) => {
  const rows = await db.select().from(departmentsTable).orderBy(asc(departmentsTable.name));
  res.json({ success: true, data: rows });
});

router.post("/", requireRole("super_admin"), async (req, res) => {
  const parsed = deptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  const [dept] = await db.insert(departmentsTable).values(parsed.data).returning();
  res.status(201).json({ success: true, data: dept });
});

router.put("/:id", requireRole("super_admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: "Geçersiz ID" });
  const parsed = deptSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  const [dept] = await db.update(departmentsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(departmentsTable.id, id)).returning();
  if (!dept) return res.status(404).json({ success: false, error: "Departman bulunamadı" });
  res.json({ success: true, data: dept });
});

router.delete("/:id", requireRole("super_admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: "Geçersiz ID" });
  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.json({ success: true });
});

export default router;
