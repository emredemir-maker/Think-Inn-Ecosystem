import { Router } from "express";
import { db } from "@workspace/db";
import { ideasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { setImmediate } from "timers";
import { backgroundEvaluateIdea } from "../utils/evaluate-idea";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const ideas = await db
      .select()
      .from(ideasTable)
      .orderBy(ideasTable.createdAt);
    res.json(ideas);
  } catch (err) {
    req.log.error({ err }, "Failed to list ideas");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/check-similarity", async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const allIdeas = await db.select().from(ideasTable);

    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();

    const titleWords = titleLower.split(/\s+/).filter((w: string) => w.length > 3);

    const similarIdeas = allIdeas.filter((idea) => {
      const idTitleLower = idea.title.toLowerCase();
      const idDescLower = idea.description.toLowerCase();

      const titleMatch = titleWords.some((word: string) => idTitleLower.includes(word));
      const descWords = descLower.split(/\s+/).filter((w: string) => w.length > 4);
      const descMatch = descWords.filter((word: string) => idDescLower.includes(word)).length > 2;

      return titleMatch || descMatch;
    });

    res.json({
      hasSimilar: similarIdeas.length > 0,
      similarIdeas,
      message:
        similarIdeas.length > 0
          ? `${similarIdeas.length} benzer fikir bulundu. Mevcut fikirlerle iş birliği yapmayı değerlendirin.`
          : "Benzer fikir bulunamadı. Devam edebilirsiniz.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to check similarity");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [item] = await db
      .insert(ideasTable)
      .values({
        title: body.title,
        description: body.description,
        authorName: body.authorName,
        collaborators: body.collaborators || [],
        researchIds: body.researchIds || [],
        relatedTo: body.relatedTo || [],
        tags: body.tags || [],
        status: body.status || "active",
        masterIdeaId: body.masterIdeaId || null,
        roadmap: body.roadmap || [],
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create idea");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(ideasTable)
      .where(eq(ideasTable.id, id));

    if (!item) {
      return res.status(404).json({ error: "Idea not found" });
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get idea");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [item] = await db
      .update(ideasTable)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(ideasTable.id, id))
      .returning();

    if (!item) {
      return res.status(404).json({ error: "Idea not found" });
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update idea");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/re-evaluate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    // Reset evaluation so polling spinner activates
    await db
      .update(ideasTable)
      .set({ evaluatedAt: null, evaluationScores: null, updatedAt: new Date() })
      .where(eq(ideasTable.id, id));

    const researchIds: number[] = Array.isArray(idea.researchIds) ? (idea.researchIds as number[]) : [];

    res.json({ ok: true, message: "Değerlendirme yeniden başlatıldı" });

    // Run evaluation AFTER responding so it doesn't block the client
    try {
      await backgroundEvaluateIdea(id, idea.title, idea.description || "", researchIds);
    } catch (bgErr) {
      req.log.error({ bgErr }, "backgroundEvaluateIdea failed");
    }
  } catch (err) {
    req.log.error({ err }, "Failed to re-evaluate idea");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(ideasTable)
      .where(eq(ideasTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Idea not found" });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete idea");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
