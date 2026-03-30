/**
 * One-time backfill endpoint: creates community threads for existing ideas & research.
 * POST /api/admin/backfill-community
 * Idempotent — safe to call multiple times.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  ideasTable,
  researchTable,
} from "@workspace/db";
import { autoCreateIdeaThread, autoCreateResearchThread } from "../../utils/community-auto";

const router = Router();

router.post("/backfill-community", async (_req, res) => {
  try {
    const ideas = await db.select({ id: ideasTable.id, title: ideasTable.title, description: ideasTable.description }).from(ideasTable);
    const research = await db.select({ id: researchTable.id, title: researchTable.title, summary: researchTable.summary }).from(researchTable);

    let ideaDone = 0;
    let resDone = 0;

    for (const idea of ideas) {
      await autoCreateIdeaThread({ id: idea.id, title: idea.title ?? "", description: idea.description ?? "" });
      ideaDone++;
    }

    for (const r of research) {
      await autoCreateResearchThread({ id: r.id, title: r.title ?? "", summary: r.summary ?? "" });
      resDone++;
    }

    res.json({ ok: true, ideas: ideaDone, research: resDone });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
