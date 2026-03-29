import { Router } from "express";
import { db } from "@workspace/db";
import { ideasTable, researchTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { setImmediate } from "timers";
import { backgroundEvaluateIdea } from "../utils/evaluate-idea";
import { ai } from "@workspace/integrations-gemini-ai";
import { autoCreateIdeaThread } from "../utils/community-auto";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const ideas = await db
      .select()
      .from(ideasTable)
      .orderBy(desc(ideasTable.createdAt));
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

    // Auto-create community thread (non-blocking)
    setImmediate(() => autoCreateIdeaThread({ id: item.id, title: item.title, description: item.description }));
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

router.put("/:id/research-topic-mapping", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { researchId, topic, topicType } = req.body as { researchId: number; topic: string; topicType: "needed" | "optional" };

    if (!researchId || !topic || !topicType) {
      return res.status(400).json({ error: "researchId, topic ve topicType zorunludur" });
    }

    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    const existingIds: number[] = Array.isArray(idea.researchIds) ? (idea.researchIds as number[]) : [];
    const existingMappings: Array<{ researchId: number; topic: string; topicType: string; autoLinked: boolean; confidence?: number }> =
      Array.isArray(idea.researchTopicMappings) ? (idea.researchTopicMappings as any[]) : [];

    // Remove any previous mapping for this researchId+topic combination, then add new one
    const filteredMappings = existingMappings.filter(
      m => !(m.researchId === researchId && m.topic === topic)
    );
    const newMappings = [
      ...filteredMappings,
      { researchId, topic, topicType, autoLinked: false },
    ];

    // Ensure researchId is in researchIds
    const newResearchIds = existingIds.includes(researchId) ? existingIds : [...existingIds, researchId];

    const [updated] = await db
      .update(ideasTable)
      .set({ researchTopicMappings: newMappings as any, researchIds: newResearchIds, updatedAt: new Date() })
      .where(eq(ideasTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update research topic mapping");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Re-generate full architectural analysis (including flowDiagram) for an idea
router.post("/:id/regenerate-analysis", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    res.json({ success: true, message: "Analysis regeneration started." });

    setImmediate(async () => {
      try {
        // Fetch linked research
        let linkedResearch: any[] = [];
        if (idea.researchIds && idea.researchIds.length > 0) {
          const all = await db.select().from(researchTable);
          linkedResearch = all.filter(r => (idea.researchIds || []).includes(r.id));
        }

        const ideaCtx = `Fikir: ${idea.title}\nAçıklama: ${idea.description}\nEtiketler: ${(idea.tags || []).join(", ")}`;
        const researchCtx = linkedResearch.length > 0
          ? linkedResearch.map(r => `Araştırma: ${r.title}\nÖzet: ${(r.summary || "").slice(0, 400)}\nBulgular: ${(r.findings || "").slice(0, 400)}`).join("\n---\n")
          : "Henüz bağlı araştırma yok.";
        const baseCtx = `## FİKİR\n${ideaCtx}\n\n## İLGİLİ ARAŞTIRMALAR\n${researchCtx}\n\n`;

        // Sequential calls to avoid Gemini rate limits — each awaited one at a time
        const geminiCall = async (prompt: string, tokens = 6000): Promise<string> => {
          try {
            const r = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              config: { maxOutputTokens: tokens },
            });
            const text = r.text?.trim() || "";
            console.log(`[Analysis] Gemini returned ${text.length} chars`);
            return text;
          } catch (e) {
            console.error("[Analysis] Gemini call failed:", (e as Error).message);
            return "";
          }
        };

        const functionalAnalysis  = await geminiCall(`${baseCtx}Bu fikrin FONKSİYONEL ANALİZİNİ yap. Sistemin ne yapacağını, temel özellikleri, kullanıcı senaryolarını, iş akışlarını, fonksiyonel gereksinimleri ve kabul kriterlerini Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık (##) ve alt başlıklar kullan. Madde listeleri ile destekle. Sadece analiz içeriğini döndür, giriş cümlesi ekleme.`);
        const technicalAnalysis   = await geminiCall(`${baseCtx}Bu fikrin TEKNİK ANALİZİNİ yap. Önerilen teknoloji yığını ve gerekçeleri, mimari pattern'ler, performans ve ölçeklenebilirlik stratejileri, güvenlik mimarisi, API tasarımı, veri modeli ve teknik riskler konularını Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık (##) kullan. Sadece analiz içeriğini döndür.`);
        const architecturalPlan   = await geminiCall(`${baseCtx}Bu fikrin MİMARİ PLANINI hazırla. Sistem bileşenlerini katmanlara (Kullanıcı Katmanı, Sunum Katmanı, İş Mantığı Katmanı, Veri Katmanı, Harici Servisler) göre detaylı açıkla. Her bileşenin sorumluluğunu, birbirleriyle nasıl iletişim kurduklarını, veri akışını ve deployment stratejisini Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık kullan. Sadece plan içeriğini döndür.`);

        // Generate structured flow diagram — sequential, after text sections
        let flowDiagram: any = undefined;
        try {
          const flowPrompt = `Aşağıdaki proje için sistem mimarisi akış şemasını JSON olarak tanımla.

Proje: ${idea.title}
Açıklama: ${idea.description}
Mimari özet: ${architecturalPlan.slice(0, 800)}

Katman türleri: "user", "frontend", "backend", "database", "external", "process"

JSON formatı (başka hiçbir şey yazma, sadece bu JSON):
{"nodes":[{"id":"n1","label":"Kullanıcı","type":"user","description":"Son kullanıcı","layer":"user"},{"id":"n2","label":"Web Arayüzü","type":"frontend","description":"React SPA","layer":"frontend"},{"id":"n3","label":"API Sunucusu","type":"backend","description":"Node.js REST API","layer":"backend"},{"id":"n4","label":"Veritabanı","type":"database","description":"PostgreSQL","layer":"database"}],"edges":[{"from":"n1","to":"n2","label":"HTTPS","animated":true},{"from":"n2","to":"n3","label":"REST"},{"from":"n3","to":"n4","label":"SQL"}]}

Kurallar:
- 6-12 node, proje-spesifik gerçekçi isimler
- Tüm katmanları kapsayan tam veri akışı
- Her edge'de protokol/teknoloji yaz
- animated:true yalnızca kritik akış için
- SADECE JSON döndür, başka hiçbir şey yazma`;

          const flowRes = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: flowPrompt }] }],
            config: { maxOutputTokens: 4096, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } as any,
          });
          const rawText = flowRes.text?.trim() || "";
          console.log(`[FlowDiagram] Raw response (${rawText.length} chars)`);

          let parsed: any = null;
          try { parsed = JSON.parse(rawText); } catch {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
          }

          if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0 && Array.isArray(parsed.edges)) {
            flowDiagram = parsed;
            console.log(`[FlowDiagram] ✓ ${parsed.nodes.length} nodes, ${parsed.edges.length} edges for idea #${id}`);
          } else {
            console.warn(`[FlowDiagram] Parsed but invalid structure:`, JSON.stringify(parsed)?.slice(0, 200));
          }
        } catch (e) {
          console.error("[FlowDiagram] Failed:", (e as Error).message);
        }

        const architecturalAnalysis = {
          functionalAnalysis,
          technicalAnalysis,
          architecturalPlan,
          generatedAt: new Date().toISOString(),
          ...(flowDiagram ? { flowDiagram } : {}),
        };

        await db.update(ideasTable)
          .set({ architecturalAnalysis: architecturalAnalysis as any, updatedAt: new Date() })
          .where(eq(ideasTable.id, id));
        console.log(`[Analysis] Regenerated for idea #${id}: ${idea.title}`);
      } catch (err) {
        console.error(`[Analysis] Regeneration failed for idea #${id}:`, (err as Error).message);
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start analysis regeneration");
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
