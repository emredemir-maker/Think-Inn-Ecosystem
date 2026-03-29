import { Router } from "express";
import { db } from "@workspace/db";
import {
  communityPostsTable,
  communityThreadsTable,
  communityReactionsTable,
  moderationActionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireRole, requireAuth, ROLE_HIERARCHY } from "../../middlewares/requireRole";
import { z } from "zod";

const router = Router();

// GET /api/community/threads/:threadId/posts
router.get("/threads/:threadId/posts", async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const { page = "1", limit = "50" } = req.query as Record<string, string>;
  const limitNum = Math.min(parseInt(limit), 100);
  const offset = (Math.max(1, parseInt(page)) - 1) * limitNum;

  const posts = await db
    .select({
      id: communityPostsTable.id,
      content: communityPostsTable.content,
      parentPostId: communityPostsTable.parentPostId,
      isHidden: communityPostsTable.isHidden,
      isSolution: communityPostsTable.isSolution,
      reactionCount: communityPostsTable.reactionCount,
      createdAt: communityPostsTable.createdAt,
      updatedAt: communityPostsTable.updatedAt,
      authorId: communityPostsTable.authorId,
      authorDisplayName: usersTable.displayName,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
    })
    .from(communityPostsTable)
    .leftJoin(usersTable, eq(communityPostsTable.authorId, usersTable.id))
    .where(
      and(
        eq(communityPostsTable.threadId, threadId),
        eq(communityPostsTable.isHidden, false),
      )
    )
    .orderBy(communityPostsTable.createdAt)
    .limit(limitNum)
    .offset(offset);

  res.json({ success: true, data: posts });
});

// POST /api/community/threads/:threadId/posts
router.post("/threads/:threadId/posts", requireAuth, async (req, res) => {
  const threadId = parseInt(req.params.threadId);
  const { content, parentPostId } = z
    .object({ content: z.string().min(1).max(5000), parentPostId: z.number().optional() })
    .parse(req.body);

  const [thread] = await db
    .select({ isLocked: communityThreadsTable.isLocked })
    .from(communityThreadsTable)
    .where(eq(communityThreadsTable.id, threadId))
    .limit(1);
  if (!thread) return res.status(404).json({ success: false, error: "Tartışma bulunamadı" });
  if (thread.isLocked) return res.status(403).json({ success: false, error: "Bu tartışma kilitlenmiş" });

  const [post] = await db
    .insert(communityPostsTable)
    .values({ threadId, authorId: req.user!.id, content, parentPostId })
    .returning();

  db.update(communityThreadsTable)
    .set({ replyCount: sql`${communityThreadsTable.replyCount} + 1`, lastActivityAt: new Date() })
    .where(eq(communityThreadsTable.id, threadId))
    .catch(() => {});

  res.status(201).json({ success: true, data: post });
});

// POST /api/community/reactions
router.post("/reactions", requireAuth, async (req, res) => {
  const { targetType, targetId, emoji } = z
    .object({
      targetType: z.enum(["thread", "post"]),
      targetId: z.number(),
      emoji: z.enum(["upvote", "heart", "lightbulb", "fire"]),
    })
    .parse(req.body);

  const userId = req.user!.id;

  const [existing] = await db
    .select({ id: communityReactionsTable.id })
    .from(communityReactionsTable)
    .where(
      and(
        eq(communityReactionsTable.targetType, targetType),
        eq(communityReactionsTable.targetId, targetId),
        eq(communityReactionsTable.userId, userId),
        eq(communityReactionsTable.emoji, emoji),
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(communityReactionsTable).where(eq(communityReactionsTable.id, existing.id));
    if (targetType === "post") {
      db.update(communityPostsTable)
        .set({ reactionCount: sql`${communityPostsTable.reactionCount} - 1` })
        .where(eq(communityPostsTable.id, targetId))
        .catch(() => {});
    }
    return res.json({ success: true, data: { action: "removed" } });
  }

  await db.insert(communityReactionsTable).values({ targetType, targetId, userId, emoji });
  if (targetType === "post") {
    db.update(communityPostsTable)
      .set({ reactionCount: sql`${communityPostsTable.reactionCount} + 1` })
      .where(eq(communityPostsTable.id, targetId))
      .catch(() => {});
  }
  res.json({ success: true, data: { action: "added" } });
});

// POST /api/community/posts/:id/hide
router.post("/posts/:id/hide", requireRole("moderator"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(communityPostsTable).set({ isHidden: true }).where(eq(communityPostsTable.id, id));
  await db.insert(moderationActionsTable).values({
    actorId: req.user!.id,
    targetType: "post",
    targetId: id,
    action: "hide",
    reason: req.body?.reason,
  });
  res.json({ success: true });
});

// POST /api/community/posts/:id/solution
router.post("/posts/:id/solution", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [post] = await db
    .select({ threadId: communityPostsTable.threadId })
    .from(communityPostsTable)
    .where(eq(communityPostsTable.id, id))
    .limit(1);
  if (!post) return res.status(404).json({ success: false, error: "Gönderi bulunamadı" });

  const [thread] = await db
    .select({ authorId: communityThreadsTable.authorId })
    .from(communityThreadsTable)
    .where(eq(communityThreadsTable.id, post.threadId))
    .limit(1);

  const actorLevel = ROLE_HIERARCHY[req.user!.role] ?? 0;
  if (thread.authorId !== req.user!.id && actorLevel < ROLE_HIERARCHY["moderator"]) {
    return res.status(403).json({ success: false, error: "Yalnızca konu sahibi veya moderatör işaretleyebilir" });
  }

  await db.update(communityPostsTable).set({ isSolution: true }).where(eq(communityPostsTable.id, id));
  res.json({ success: true });
});

// GET /api/community/moderation/log
router.get("/moderation/log", requireRole("moderator"), async (req, res) => {
  const { limit = "50", offset = "0" } = req.query as Record<string, string>;

  const logs = await db
    .select({
      id: moderationActionsTable.id,
      targetType: moderationActionsTable.targetType,
      targetId: moderationActionsTable.targetId,
      action: moderationActionsTable.action,
      reason: moderationActionsTable.reason,
      createdAt: moderationActionsTable.createdAt,
      actorId: usersTable.id,
      actorDisplayName: usersTable.displayName,
      actorUsername: usersTable.username,
    })
    .from(moderationActionsTable)
    .leftJoin(usersTable, eq(moderationActionsTable.actorId, usersTable.id))
    .orderBy(desc(moderationActionsTable.createdAt))
    .limit(Math.min(parseInt(limit), 200))
    .offset(parseInt(offset));

  res.json({ success: true, data: logs });
});

export default router;
