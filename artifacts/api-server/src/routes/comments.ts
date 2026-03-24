import { Router } from "express";
import { db } from "@workspace/db";
import { commentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { targetType, targetId, authorName, content } = req.body;
    if (!targetType || !targetId || !authorName || !content) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        targetType,
        targetId: parseInt(targetId),
        authorName,
        content,
      })
      .returning();
    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to create comment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:targetType/:targetId", async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const comments = await db
      .select()
      .from(commentsTable)
      .where(
        and(
          eq(commentsTable.targetType, targetType as "research" | "idea"),
          eq(commentsTable.targetId, parseInt(targetId))
        )
      )
      .orderBy(commentsTable.createdAt);
    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Failed to list comments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
