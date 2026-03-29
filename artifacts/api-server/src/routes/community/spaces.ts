import { Router } from "express";
import { db } from "@workspace/db";
import { communitySpacesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../../middlewares/requireRole";
import { z } from "zod";

const router = Router();

const spaceSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug küçük harf, rakam ve - içerebilir"),
  description: z.string().max(500).default(""),
  icon: z.string().optional(),
  color: z.string().optional(),
});

// GET /api/community/spaces
router.get("/", async (_req, res) => {
  const spaces = await db
    .select()
    .from(communitySpacesTable)
    .where(eq(communitySpacesTable.isArchived, false));
  res.json({ success: true, data: spaces });
});

// POST /api/community/spaces
router.post("/", requireRole("master"), async (req, res) => {
  const parsed = spaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }
  const [space] = await db
    .insert(communitySpacesTable)
    .values({ ...parsed.data, createdBy: req.user!.id })
    .returning();
  res.status(201).json({ success: true, data: space });
});

// GET /api/community/spaces/:slug
router.get("/:slug", async (req, res) => {
  const [space] = await db
    .select()
    .from(communitySpacesTable)
    .where(
      and(
        eq(communitySpacesTable.slug, req.params.slug),
        eq(communitySpacesTable.isArchived, false),
      )
    )
    .limit(1);
  if (!space) return res.status(404).json({ success: false, error: "Alan bulunamadı" });
  res.json({ success: true, data: space });
});

// PUT /api/community/spaces/:id
router.put("/:id", requireRole("moderator"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ success: false, error: "Geçersiz ID" });
  const parsed = spaceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }
  await db
    .update(communitySpacesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(communitySpacesTable.id, id));
  res.json({ success: true });
});

// DELETE /api/community/spaces/:id  (soft-archive)
router.delete("/:id", requireRole("super_admin"), async (req, res) => {
  await db
    .update(communitySpacesTable)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(communitySpacesTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

export default router;
