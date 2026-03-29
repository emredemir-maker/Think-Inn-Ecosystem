import { Router } from "express";
import { db } from "@workspace/db";
import { researchTable, ideasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { buildResearchCoverPrompt } from "../utils/cover-image";
import { setImmediate } from "timers";
import { autoCreateResearchThread } from "../utils/community-auto";

const router = Router();

interface TopicMatch {
  topic: string;
  topicType: "needed" | "optional";
  confidence: number;
}

interface LinkResult {
  ideaId: number;
  topicMatch?: TopicMatch;
}

async function autoLinkResearchToIdeas(
  researchId: number,
  researchTitle: string,
  researchSummary: string,
  researchFindings: string,
  researchTechnicalAnalysis: string,
) {
  try {
    const ideas = await db.select().from(ideasTable);
    if (ideas.length === 0) return;

    const ideaList = ideas.map(i => {
      const needed = (i.neededResearchTopics as string[] || []).join(", ") || "—";
      const optional = (i.optionalResearchTopics as string[] || []).join(", ") || "—";
      return `ID:${i.id} | Başlık: ${i.title} | Açıklama: ${(i.description || "").slice(0, 200)} | Zorunlu Araştırma Konuları: [${needed}] | Opsiyonel Araştırma Konuları: [${optional}]`;
    }).join('\n');

    const researchContent = [
      `Başlık: ${researchTitle}`,
      researchSummary ? `Özet: ${researchSummary.slice(0, 400)}` : '',
      researchFindings ? `Bulgular: ${researchFindings.slice(0, 400)}` : '',
      researchTechnicalAnalysis ? `Teknik Analiz: ${researchTechnicalAnalysis.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `Sen bir inovasyon ekosistemi analiz ajanısın.

Yeni eklenen araştırma:
${researchContent}

Mevcut fikirler (her birinin zorunlu ve opsiyonel araştırma konuları ile birlikte):
${ideaList}

Görevin:
1. Bu araştırmanın hangi fikirlerle semantik olarak ilgili olduğunu belirle (konu, teknoloji veya uygulama alanı bazında)
2. Her ilgili fikir için, araştırmanın o fikrin "Zorunlu Araştırma Konuları" veya "Opsiyonel Araştırma Konuları" listesindeki hangi maddeyi karşıladığını belirle
3. Konu eşleşmesini SADECE içerik uygunsa yap — kelime benzerliği değil, içerik uygunluğunu dikkate al

YALNIZCA aşağıdaki JSON formatında yanıt ver:
{
  "links": [
    {
      "ideaId": 1,
      "topicMatch": {
        "topic": "Eşleşen konu adı (tam metin)",
        "topicType": "needed",
        "confidence": 85
      }
    },
    {
      "ideaId": 2
    }
  ]
}

"topicMatch" alanı yalnızca gerçekten eşleşen bir konu varsa ekle. confidence 0-100 arasında.
Hiçbir fikir ilgili değilse: {"links": []}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = result.text?.trim() || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { links: LinkResult[] };
    const links = parsed.links || [];

    for (const link of links) {
      const idea = ideas.find(i => i.id === link.ideaId);
      if (!idea) continue;

      const existingIds: number[] = Array.isArray(idea.researchIds) ? (idea.researchIds as number[]) : [];
      const existingMappings: Array<{ researchId: number; topic: string; topicType: string; autoLinked: boolean; confidence?: number }> =
        Array.isArray(idea.researchTopicMappings) ? (idea.researchTopicMappings as any[]) : [];

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      // Add to researchIds if not already there
      if (!existingIds.includes(researchId)) {
        updates.researchIds = [...existingIds, researchId];
      }

      // Add topic mapping if provided and not already mapped
      if (link.topicMatch) {
        const alreadyMapped = existingMappings.some(m => m.researchId === researchId && m.topic === link.topicMatch!.topic);
        if (!alreadyMapped) {
          updates.researchTopicMappings = [
            ...existingMappings,
            {
              researchId,
              topic: link.topicMatch.topic,
              topicType: link.topicMatch.topicType,
              autoLinked: true,
              confidence: link.topicMatch.confidence,
            },
          ];
        }
      }

      await db.update(ideasTable).set(updates).where(eq(ideasTable.id, link.ideaId));
    }

    if (links.length > 0) {
      const linked = links.map(l => l.topicMatch ? `#${l.ideaId}(→"${l.topicMatch.topic}")` : `#${l.ideaId}`).join(', ');
      console.log(`[AutoLink] Research #${researchId} linked to ideas: ${linked}`);
    }
  } catch (err) {
    console.error('[AutoLink] Failed:', err);
  }
}

router.get("/", async (req, res) => {
  try {
    const research = await db.select().from(researchTable).orderBy(desc(researchTable.createdAt));
    const stripped = research.map(({ coverImageB64, coverImageMimeType, ...rest }) => ({
      ...rest,
      hasCoverImage: !!coverImageB64,
    }));
    res.json(stripped);
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
