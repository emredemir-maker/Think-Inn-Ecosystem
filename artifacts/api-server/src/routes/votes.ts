import { Router } from "express";
import { db } from "@workspace/db";
import { votesTable, researchTable, ideasTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { targetType, targetId, voterName, value } = req.body;
    if (!targetType || !targetId || !voterName || value === undefined) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const numTargetId = parseInt(targetId);
    const numValue = parseInt(value);

    const existingVotes = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.targetType, targetType),
          eq(votesTable.targetId, numTargetId),
          eq(votesTable.voterName, voterName)
        )
      );

    let userVote: number | null = null;

    if (existingVotes.length > 0) {
      if (existingVotes[0].value === numValue) {
        await db
          .delete(votesTable)
          .where(eq(votesTable.id, existingVotes[0].id));
        userVote = null;
      } else {
        await db
          .update(votesTable)
          .set({ value: numValue })
          .where(eq(votesTable.id, existingVotes[0].id));
        userVote = numValue;
      }
    } else {
      await db.insert(votesTable).values({
        targetType,
        targetId: numTargetId,
        voterName,
        value: numValue,
      });
      userVote = numValue;
    }

    const allVotes = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.targetType, targetType),
          eq(votesTable.targetId, numTargetId)
        )
      );

    const rawTotal = allVotes.reduce((sum, v) => sum + v.value, 0);
    const totalVotes = Math.max(0, rawTotal);

    if (targetType === "research") {
      await db
        .update(researchTable)
        .set({ voteCount: totalVotes })
        .where(eq(researchTable.id, numTargetId));
    } else if (targetType === "idea") {
      await db
        .update(ideasTable)
        .set({ voteCount: totalVotes })
        .where(eq(ideasTable.id, numTargetId));
    }

    res.json({ voteCount: totalVotes, userVote });
  } catch (err) {
    req.log.error({ err }, "Failed to vote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
