import { Router } from "express";
import { db } from "@workspace/db";
import {
  communityThreadsTable,
  communitySpacesTable,
  usersTable,
  moderationActionsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireRole, requireAuth } from "../../middlewares/requireRole";
import { z } from "zod";

const router = Router();

const threadSchema = z.object({
  title: z.string().min(5, "Başlık en az 5 karakter olmalı").max(200),
  body: z.string().max(10000).default(""),
  linkedIdeaId: z.number().optional(),
  linkedResearchId: z.number().optional(),
});

// GET /api/community/spaces/:spaceId/threads
router.get("/spaces/:spaceId/threads", async (req, res) => {
  const spaceId = parseInt(req.params.spaceId);
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit), 50);
  const offset = (Math.max(1, parseInt(page)) - 1) * limitNum;

  const threads = await db
    .select({
      id: communityThreadsTable.id,
      title: communityThreadsTable.title,
      body: communityThreadsTable.body,
      isPinned: communityThreadsTable.isPinned,
      isLocked: communityThreadsTable.isLocked,
      isFeatured: communityThreadsTable.isFeatured,
      replyCount: communityThreadsTable.replyCount,
      viewCount: communityThreadsTable.viewCount,
      lastActivityAt: communityThreadsTable.lastActivityAt,
      createdAt: communityThreadsTable.createdAt,
      linkedIdeaId: communityThreadsTable.linkedIdeaId,
      linkedResearchId: communityThreadsTable.linkedResearchId,
      authorId: communityThreadsTable.authorId,
      authorDisplayName: usersTable.displayName,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
    })
    .from(communityThreadsTable)
    .leftJoin(usersTable, eq(communityThreadsTable.authorId, usersTable.id))
    .where(
      and(
        eq(communityThreadsTable.spaceId, spaceId),
        eq(communityThreadsTable.isHidden, false),
      )
    )
    .orderBy(desc(communityThreadsTable.isPinned), desc(communityThreadsTable.lastActivityAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ success: true, data: threads });
});

// GET /api/community/threads/:id
router.get("/threads/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [thread] = await db
    .select({
      id: communityThreadsTable.id,
      spaceId: communityThreadsTable.spaceId,
      title: communityThreadsTable.title,
      body: communityThreadsTable.body,
      isPinned: communityThreadsTable.isPinned,
      isLocked: communityThreadsTable.isLocked,
      isFeatured: communityThreadsTable.isFeatured,
      replyCount: communityThreadsTable.replyCount,
      viewCount: communityThreadsTable.viewCount,
      linkedIdeaId: communityThreadsTable.linkedIdeaId,
      linkedResearchId: communityThreadsTable.linkedResearchId,
      lastActivityAt: communityThreadsTable.lastActivityAt,
      createdAt: communityThreadsTable.createdAt,
      authorId: communityThreadsTable.authorId,
      authorDisplayName: usersTable.displayName,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
    })
    .from(communityThreadsTable)
    .leftJoin(usersTable, eq(communityThreadsTable.authorId, usersTable.id))
    .where(eq(communityThreadsTable.id, id))
    .limit(1);

  if (!thread) return res.status(404).json({ success: false, error: "Tartışma bulunamadı" });

  // Increment view count (non-blocking)
  db.update(communityThreadsTable)
    .set({ viewCount: sql`${communityThreadsTable.viewCount} + 1` })
    .where(eq(communityThreadsTable.id, id))
    .catch(() => {});

  res.json({ success: true, data: thread });
});

// POST /api/community/spaces/:spaceId/threads
router.post("/spaces/:spaceId/threads", requireAuth, async (req, res) => {
  const spaceId = parseInt(req.params.spaceId);
  const parsed = threadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const [thread] = await db
    .insert(communityThreadsTable)
    .values({ ...parsed.data, spaceId, authorId: req.user!.id })
    .returning();

  // Update space thread count (non-blocking)
  db.update(communitySpacesTable)
    .set({ threadCount: sql`${communitySpacesTable.threadCount} + 1`, updatedAt: new Date() })
    .where(eq(communitySpacesTable.id, spaceId))
    .catch(() => {});

  res.status(201).json({ success: true, data: thread });
});

// DELETE /api/community/threads/:id
router.delete("/threads/:id", requireRole("moderator"), async (req, res) => {
  await db
    .delete(communityThreadsTable)
    .where(eq(communityThreadsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

// --- Moderation helpers ---
async function applyModerationAction(
  req: any,
  res: any,
  action: string,
  field: keyof typeof communityThreadsTable.$inferInsert,
  value: boolean,
) {
  const id = parseInt(req.params.id);
  await db
    .update(communityThreadsTable)
    .set({ [field]: value, updatedAt: new Date() } as any)
    .where(eq(communityThreadsTable.id, id));
  await db.insert(moderationActionsTable).values({
    actorId: req.user!.id,
    targetType: "thread",
    targetId: id,
    action: action as any,
    reason: req.body?.reason,
  });
  res.json({ success: true });
}

router.post("/threads/:id/pin",       requireRole("moderator"), (req, res) => applyModerationAction(req, res, "pin",       "isPinned",   true));
router.post("/threads/:id/unpin",     requireRole("moderator"), (req, res) => applyModerationAction(req, res, "unpin",     "isPinned",   false));
router.post("/threads/:id/lock",      requireRole("moderator"), (req, res) => applyModerationAction(req, res, "lock",      "isLocked",   true));
router.post("/threads/:id/unlock",    requireRole("moderator"), (req, res) => applyModerationAction(req, res, "unlock",    "isLocked",   false));
router.post("/threads/:id/hide",      requireRole("moderator"), (req, res) => applyModerationAction(req, res, "hide",      "isHidden",   true));
router.post("/threads/:id/unhide",    requireRole("moderator"), (req, res) => applyModerationAction(req, res, "unhide",    "isHidden",   false));
router.post("/threads/:id/feature",   requireRole("master"),    (req, res) => applyModerationAction(req, res, "feature",   "isFeatured", true));
router.post("/threads/:id/unfeature", requireRole("master"),    (req, res) => applyModerationAction(req, res, "unfeature", "isFeatured", false));

// GET /api/community/thread-by-idea/:ideaId
router.get("/thread-by-idea/:ideaId", async (req, res) => {
  const ideaId = parseInt(req.params.ideaId);
  if (isNaN(ideaId)) return res.status(400).json({ success: false, error: "Geçersiz ID" });

  const [thread] = await db
    .select({
      id: communityThreadsTable.id,
      title: communityThreadsTable.title,
      body: communityThreadsTable.body,
      replyCount: communityThreadsTable.replyCount,
      viewCount: communityThreadsTable.viewCount,
      isLocked: communityThreadsTable.isLocked,
      createdAt: communityThreadsTable.createdAt,
      lastActivityAt: communityThreadsTable.lastActivityAt,
    })
    .from(communityThreadsTable)
    .where(eq(communityThreadsTable.linkedIdeaId, ideaId))
    .limit(1);

  if (!thread) return res.status(404).json({ success: false, error: "Thread bulunamadı" });
  res.json({ success: true, data: thread });
});

// GET /api/community/thread-by-research/:researchId
router.get("/thread-by-research/:researchId", async (req, res) => {
  const researchId = parseInt(req.params.researchId);
  if (isNaN(researchId)) return res.status(400).json({ success: false, error: "Geçersiz ID" });

  const [thread] = await db
    .select({
      id: communityThreadsTable.id,
      title: communityThreadsTable.title,
      body: communityThreadsTable.body,
      replyCount: communityThreadsTable.replyCount,
      viewCount: communityThreadsTable.viewCount,
      isLocked: communityThreadsTable.isLocked,
      createdAt: communityThreadsTable.createdAt,
      lastActivityAt: communityThreadsTable.lastActivityAt,
    })
    .from(communityThreadsTable)
    .where(eq(communityThreadsTable.linkedResearchId, researchId))
    .limit(1);

  if (!thread) return res.status(404).json({ success: false, error: "Thread bulunamadı" });
  res.json({ success: true, data: thread });
});

export default router;
