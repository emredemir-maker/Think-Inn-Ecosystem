import { Router } from "express";
import { db } from "@workspace/db";
import { diagramsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const diagrams = await db
      .select()
      .from(diagramsTable)
      .orderBy(diagramsTable.createdAt);
    res.json(diagrams);
  } catch (err) {
    req.log.error({ err }, "Failed to list diagrams");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const [item] = await db
      .insert(diagramsTable)
      .values({
        title: body.title,
        description: body.description || "",
        type: body.type || "flowchart",
        svgData: body.svgData || "",
        nodes: body.nodes || [],
        edges: body.edges || [],
        relatedIdeaId: body.relatedIdeaId || null,
        relatedResearchId: body.relatedResearchId || null,
      })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create diagram");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(diagramsTable)
      .where(eq(diagramsTable.id, id));

    if (!item) {
      return res.status(404).json({ error: "Diagram not found" });
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get diagram");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;
    const [item] = await db
      .update(diagramsTable)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(diagramsTable.id, id))
      .returning();

    if (!item) {
      return res.status(404).json({ error: "Diagram not found" });
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update diagram");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(diagramsTable)
      .where(eq(diagramsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Diagram not found" });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete diagram");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
