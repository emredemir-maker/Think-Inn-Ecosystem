import { Router } from "express";
import { db } from "@workspace/db";
import { researchTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const research = await db
      .select()
      .from(researchTable)
      .orderBy(researchTable.createdAt);
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
        tags: body.tags || [],
        relatedTo: body.relatedTo || [],
        status: body.status || "published",
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create research");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(researchTable)
      .where(eq(researchTable.id, id));

    if (!item) {
      return res.status(404).json({ error: "Research not found" });
    }
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
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(researchTable.id, id))
      .returning();

    if (!item) {
      return res.status(404).json({ error: "Research not found" });
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update research");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(researchTable)
      .where(eq(researchTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Research not found" });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete research");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
