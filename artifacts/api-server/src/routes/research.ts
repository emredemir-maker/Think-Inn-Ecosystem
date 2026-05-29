import { Router } from "express";
import { db } from "@workspace/db";
import { researchTable, ideasTable } from "@workspace/db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { buildResearchCoverPrompt } from "../utils/cover-image";
import { setImmediate } from "timers";
import { autoCreateResearchThread } from "../utils/community-auto";
// Otomatik fikir eşleştirme artık ortak util'de — chat akışı da aynı fonksiyonu kullanır.
import { autoLinkResearchToIdeas } from "../utils/auto-link-research";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const conditions = [];
    if (category && typeof category === "string") {
      conditions.push(eq(researchTable.category, category));
    }
    const research = await db
      .select({
        id: researchTable.id,
        title: researchTable.title,
        summary: researchTable.summary,
        technicalAnalysis: researchTable.technicalAnalysis,
        findings: researchTable.findings,
        rawContent: researchTable.rawContent,
        authorName: researchTable.authorName,
        category: researchTable.category,
        tags: researchTable.tags,
        relatedTo: researchTable.relatedTo,
        status: researchTable.status,
        voteCount: researchTable.voteCount,
        hasCoverImage: sql<boolean>`(cover_image_b64 IS NOT NULL)`,
        createdAt: researchTable.createdAt,
        updatedAt: researchTable.updatedAt,
      })
      .from(researchTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(researchTable.createdAt));
    res.json(research);
  } catch (err) {
    req.log.error({ err }, "Failed to list research");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [item] = await db
      .insert(researchTable)
      .values({
        title: body.title,
        summary: body.summary || "",
        technicalAnalysis: body.technicalAnalysis || "",
        findings: body.findings || "",
        rawContent: body.rawContent || "",
        authorName: body.authorName,
        coverImageB64: body.coverImageB64 || null,
        coverImageMimeType: body.coverImageMimeType || null,
        category: body.category || null,
        tags: body.tags || [],
        relatedTo: body.relatedTo || [],
        status: body.status || "published",
      })
      .returning();

    res.status(201).json(item);

    setImmediate(() => {
      autoLinkResearchToIdeas(
        item.id,
        item.title,
        item.summary || '',
        item.findings || '',
        item.technicalAnalysis || '',
      );
      autoCreateResearchThread({ id: item.id, title: item.title, summary: item.summary || '' });
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create research");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/auto-link", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(researchTable).where(eq(researchTable.id, id));
    if (!item) return res.status(404).json({ error: "Research not found" });

    await autoLinkResearchToIdeas(item.id, item.title, item.summary || '', item.findings || '', item.technicalAnalysis || '');
    res.json({ message: "Otomatik ilişkilendirme tamamlandı" });
  } catch (err) {
    req.log.error({ err }, "Failed to auto-link research");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve cover image as binary (avoids sending base64 in list responses)
router.get("/:id/cover", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select({ coverImageB64: researchTable.coverImageB64, coverImageMimeType: researchTable.coverImageMimeType })
      .from(researchTable)
      .where(eq(researchTable.id, id));

    if (!item?.coverImageB64) {
      return res.status(404).end();
    }

    const buffer = Buffer.from(item.coverImageB64, "base64");
    res.set("Content-Type", item.coverImageMimeType || "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to get cover image");
    res.status(500).end();
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(researchTable).where(eq(researchTable.id, id));
    if (!item) return res.status(404).json({ error: "Research not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get research");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [item] = await db
      .update(researchTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(researchTable.id, id))
      .returning();
    if (!item) return res.status(404).json({ error: "Research not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update research");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate cover image for a single research item
router.post("/:id/regenerate-image", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(researchTable).where(eq(researchTable.id, id));
    if (!item) return res.status(404).json({ error: "Research not found" });

    res.json({ success: true, message: "Image generation started in background." });

    setImmediate(async () => {
      try {
        const imgPrompt = await buildResearchCoverPrompt(
          item.title,
          item.summary || "",
          (item.tags as string[]) || [],
          item.findings || "",
        );
        const imgResult = await generateImage(imgPrompt);
        await db.update(researchTable)
          .set({ coverImageB64: imgResult.b64_json, coverImageMimeType: imgResult.mimeType, updatedAt: new Date() })
          .where(eq(researchTable.id, id));
        console.log(`[CoverImage] Regenerated for research #${id}`);
      } catch (err) {
        console.error(`[CoverImage] Regeneration failed for #${id}:`, err);
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start image regeneration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate cover images for ALL research without images
router.post("/regenerate-all-images", async (req, res) => {
  try {
    const items = await db.select().from(researchTable);
    const missing = items.filter(r => !r.coverImageB64);
    res.json({ success: true, queued: missing.length });

    for (const item of missing) {
      setImmediate(async () => {
        try {
          const imgPrompt = await buildResearchCoverPrompt(
            item.title,
            item.summary || "",
            (item.tags as string[]) || [],
            item.findings || "",
          );
          const imgResult = await generateImage(imgPrompt);
          await db.update(researchTable)
            .set({ coverImageB64: imgResult.b64_json, coverImageMimeType: imgResult.mimeType, updatedAt: new Date() })
            .where(eq(researchTable.id, item.id));
          console.log(`[CoverImage] Generated for research #${item.id}: ${item.title}`);
        } catch (err) {
          console.error(`[CoverImage] Failed for research #${item.id}:`, (err as Error).message);
        }
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to queue image regeneration");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(researchTable).where(eq(researchTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Research not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete research");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
