import { Router } from "express";
import { db } from "@workspace/db";
import { researchTable, ideasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

// Auto-link new research to semantically related ideas using AI
async function autoLinkResearchToIdeas(researchId: number, researchTitle: string, researchSummary: string) {
  try {
    const ideas = await db.select().from(ideasTable);
    if (ideas.length === 0) return;

    const ideaList = ideas.map(i => `ID:${i.id} | Başlık: ${i.title} | Açıklama: ${i.description?.slice(0, 200)}`).join('\n');

    const prompt = `Sen bir inovasyon ekosistemi analiz ajanısın.

Yeni eklenen araştırma:
Başlık: ${researchTitle}
Özet: ${researchSummary}

Mevcut fikirler:
${ideaList}

Görevin: Hangi fikirler bu araştırmayla semantik olarak ilgilidir? 
Sadece gerçekten ilgili olanları seç (konuya göre, teknolojiye göre veya uygulama alanına göre).

YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"linkedIdeaIds": [1, 2, 3]}

Eğer hiçbir fikir ilgili değilse: {"linkedIdeaIds": []}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 256 },
    });

    const text = result.text?.trim() || '';
    // Extract JSON from the response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { linkedIdeaIds: number[] };
    const linkedIds = parsed.linkedIdeaIds || [];

    // Update each linked idea's researchIds
    for (const ideaId of linkedIds) {
      const idea = ideas.find(i => i.id === ideaId);
      if (!idea) continue;
      const existing = idea.researchIds || [];
      if (existing.includes(researchId)) continue;
      const newIds = [...existing, researchId];
      await db.update(ideasTable).set({ researchIds: newIds, updatedAt: new Date() }).where(eq(ideasTable.id, ideaId));
    }

    if (linkedIds.length > 0) {
      console.log(`[AutoLink] Research #${researchId} linked to ideas: ${linkedIds.join(', ')}`);
    }
  } catch (err) {
    // Non-blocking — just log
    console.error('[AutoLink] Failed:', err);
  }
}

router.get("/", async (req, res) => {
  try {
    const research = await db.select().from(researchTable).orderBy(researchTable.createdAt);
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

    // Trigger auto-linking asynchronously (non-blocking)
    setImmediate(() => {
      autoLinkResearchToIdeas(item.id, item.title, item.summary || '');
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create research");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manual trigger for auto-linking a specific research
router.post("/:id/auto-link", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(researchTable).where(eq(researchTable.id, id));
    if (!item) return res.status(404).json({ error: "Research not found" });

    await autoLinkResearchToIdeas(item.id, item.title, item.summary || '');
    res.json({ message: "Otomatik ilişkilendirme tamamlandı" });
  } catch (err) {
    req.log.error({ err }, "Failed to auto-link research");
    res.status(500).json({ error: "Internal server error" });
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
