import { Router } from "express";
import { db } from "@workspace/db";
import { ideasTable, researchTable, communityThreadsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { setImmediate } from "timers";
import { backgroundEvaluateIdea } from "../utils/evaluate-idea";
import { ai, GEMINI_MODELS } from "@workspace/integrations-gemini-ai";
import { autoCreateIdeaThread, autoCreateProjectThread } from "../utils/community-auto";
import { generateLinkedInContent, type LinkedInAngle } from "../utils/linkedin-content";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const ideas = await db
      .select()
      .from(ideasTable)
      .where(
        category && typeof category === "string"
          ? eq(ideasTable.category, category)
          : undefined,
      )
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
        category: body.category || null,
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

    // "needed" konu eşleştirildiyse zorunlu listeden çıkar → araştırma eklendikçe liste kısalır (yakınsar)
    const existingNeeded: string[] = Array.isArray(idea.neededResearchTopics) ? (idea.neededResearchTopics as string[]) : [];
    const newNeeded = topicType === "needed"
      ? existingNeeded.filter((t) => String(t).trim().toLowerCase() !== topic.trim().toLowerCase())
      : existingNeeded;

    const [updated] = await db
      .update(ideasTable)
      .set({ researchTopicMappings: newMappings as any, researchIds: newResearchIds, neededResearchTopics: newNeeded as any, updatedAt: new Date() })
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
              model: GEMINI_MODELS.analysis,
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
            model: GEMINI_MODELS.analysis,
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

// POST /api/ideas/:id/generate-financial — otonom finansal senaryo analizi üretir.
// Sonuç architecturalAnalysis.financial içinde saklanır (yeni kolon yok). Yalnızca PROJE (analizli) için.
router.post("/:id/generate-financial", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });
    if (!idea.architecturalAnalysis) {
      return res.status(400).json({ error: "Önce proje (mimari) analizini üretin." });
    }

    res.json({ success: true, message: "Financial generation started." });

    setImmediate(async () => {
      try {
        const ev = idea.evaluationScores as any;
        const aa = idea.architecturalAnalysis as any;
        const ctx =
          `Proje: ${idea.title}\nAçıklama: ${idea.description}\nKategori: ${idea.category ?? "-"}\n` +
          (ev ? `AI skorları → Ticari Fizibilite: ${ev.commercialFeasibility}/10, Pazar İhtiyacı: ${ev.marketNeed}/10, Risk: ${ev.riskGovernance}/10\n` : "") +
          (aa?.technicalAnalysis ? `Teknik özet: ${String(aa.technicalAnalysis).slice(0, 700)}\n` : "");

        const prompt = `Sen kurumsal bir FİNANSAL ANALİZ ajanısın. Aşağıdaki proje için DETAYLI, gerçekçi ve projeye ÖZGÜ finansal senaryo analizi üret. SADECE JSON döndür.

${ctx}

Kurallar:
- 3 senaryo: "İyimser", "Baz", "Kötümser". Her biri projeye özgü, tutarlı tahminler içersin.
- Para birimi ₺ (TRY). Gelirleri kısa biçimde yaz (ör. "₺4.2M", "₺850K").
- roiPct: 24 ay sonu tahmini ROI yüzdesi (yalnızca sayı).
- breakEvenMonths: başabaş ayı (yalnızca sayı).
- assumptions: 3-5 temel varsayım (kısa). keyRisks: 2-4 finansal risk (kısa).
- revenueModel: gelir modeli (1 cümle). capex: kuruluş/yatırım maliyeti (1 cümle). opex: aylık/yıllık işletme maliyeti (1 cümle).
- summary: 2-3 cümlelik yönetici özeti.

JSON formatı (SADECE JSON):
{
  "summary": "...",
  "revenueModel": "...",
  "capex": "...",
  "opex": "...",
  "assumptions": ["...", "..."],
  "keyRisks": ["...", "..."],
  "scenarios": [
    { "name": "İyimser", "year1Revenue": "₺X", "year3Revenue": "₺Y", "roiPct": 180, "breakEvenMonths": 12, "note": "..." },
    { "name": "Baz", "year1Revenue": "₺X", "year3Revenue": "₺Y", "roiPct": 90, "breakEvenMonths": 18, "note": "..." },
    { "name": "Kötümser", "year1Revenue": "₺X", "year3Revenue": "₺Y", "roiPct": 20, "breakEvenMonths": 30, "note": "..." }
  ]
}`;

        const r = await ai.models.generateContent({
          model: GEMINI_MODELS.analysis,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 4096, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } as any,
        });
        const raw = r.text?.trim() || "";
        let parsed: any = null;
        try { parsed = JSON.parse(raw); } catch {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (!parsed || !Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
          console.warn(`[Financial] invalid result for #${id}`);
          return;
        }
        const financial = { ...parsed, generatedAt: new Date().toISOString() };
        await db.update(ideasTable)
          .set({ architecturalAnalysis: { ...aa, financial } as any, updatedAt: new Date() })
          .where(eq(ideasTable.id, id));
        console.log(`[Financial] generated for #${id}: ${idea.title}`);
      } catch (e) {
        console.error(`[Financial] generation failed for #${id}:`, (e as Error).message);
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start financial generation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/ideas/:id/generate-linkedin — fikir/proje için LinkedIn gönderisi üretir (senkron).
// Çoklu açı (angle) + ton (tone). Gerçek veriye dayanır; admin düzenleyip paylaşır (auto-publish YOK).
router.post("/:id/generate-linkedin", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    const angle = (["founder", "problem", "research"].includes(req.body?.angle) ? req.body.angle : "problem") as LinkedInAngle;
    const tone = typeof req.body?.tone === "number" ? Math.max(0, Math.min(100, req.body.tone)) : 50;
    const kind = idea.architecturalAnalysis ? "project" : "idea";

    // Somut gerçekleri topla (gönderiyi gerçek veriye demirler)
    const facts: string[] = [];
    const ev = idea.evaluationScores as any;
    if (ev) {
      if (ev.commercialFeasibility != null) facts.push(`Ticari fizibilite skoru ${ev.commercialFeasibility}/10`);
      if (ev.marketNeed != null) facts.push(`Pazar ihtiyacı skoru ${ev.marketNeed}/10`);
      if (ev.trendAlignment != null) facts.push(`Trend uyumu ${ev.trendAlignment}/10`);
      if (ev.summary) facts.push(`AI değerlendirme özeti: ${String(ev.summary).slice(0, 220)}`);
    }
    const flow = (idea.roadmap as string[]) ?? [];
    if (flow.length) facts.push(`Kullanım akışı: ${flow.slice(0, 6).join(" → ")}`);
    const aa = idea.architecturalAnalysis as any;
    if (aa?.functionalAnalysis) facts.push(`Fonksiyonel öz: ${String(aa.functionalAnalysis).replace(/[#*`>_]/g, "").slice(0, 220)}`);

    const result = await generateLinkedInContent({
      kind,
      title: idea.title,
      summary: idea.description,
      category: idea.category,
      tags: (idea.tags as string[]) ?? [],
      facts,
      angle,
      tone,
    });
    if (!result) return res.status(502).json({ error: "İçerik üretilemedi. Lütfen tekrar deneyin." });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to generate LinkedIn content (idea)");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/ideas/:id/revise-analysis — fonksiyonel/teknik/mimari analizi kullanıcı yönlendirmesiyle yeniden üretir (senkron).
router.post("/:id/revise-analysis", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });
    const aa = idea.architecturalAnalysis as any;
    if (!aa) return res.status(400).json({ error: "Önce mimari analizi üretin." });

    const keyMap: Record<string, string> = { functional: "functionalAnalysis", technical: "technicalAnalysis", architecturalPlan: "architecturalPlan" };
    const labelMap: Record<string, string> = { functional: "fonksiyonel analiz", technical: "teknik analiz", architecturalPlan: "mimari plan" };
    const section = String(req.body?.section || "");
    const key = keyMap[section];
    const guidance = String(req.body?.guidance || "").trim();
    if (!key) return res.status(400).json({ error: "Geçersiz bölüm." });
    if (!guidance) return res.status(400).json({ error: "Yönlendirme metni gerekli." });

    const current = String(aa[key] || "");
    const prompt = `Sen kurumsal bir ürün/teknik analiz revizyon ajanısın. Aşağıdaki ${labelMap[section]} metnini, KULLANICININ YÖNLENDİRMESİNE göre revize et.

PROJE: ${idea.title}
Açıklama: ${idea.description}
${idea.category ? `Kategori: ${idea.category}\n` : ""}
MEVCUT ${labelMap[section].toUpperCase()}:
${current.slice(0, 6000)}

KULLANICI YÖNLENDİRMESİ: ${guidance}

Kurallar:
- Yönlendirmeyi uygula; ilgili bölümleri güncelle, gerisini tutarlı koru.
- Markdown yapısını ve kalitesini koru (başlıklar ##, alt-maddeler, kalın etiketler).
- Türkçe yaz. SADECE revize edilmiş markdown metni döndür (açıklama/önsöz YOK).`;

    let revised = "";
    try {
      const r = await ai.models.generateContent({
        model: GEMINI_MODELS.analysis,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } } as any,
      });
      revised = (r.text || "").trim();
    } catch (e) {
      req.log.error({ err: e }, "revise-analysis gemini failed");
    }
    if (!revised) return res.status(502).json({ error: "Revizyon üretilemedi. Tekrar deneyin." });

    aa[key] = revised;
    aa.revisedAt = new Date().toISOString();
    await db.update(ideasTable).set({ architecturalAnalysis: aa as any, updatedAt: new Date() }).where(eq(ideasTable.id, id));
    res.json({ section, content: revised });
  } catch (err) {
    req.log.error({ err }, "Failed to revise analysis");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/ideas/:id/mitigate-risk — bir risk maddesini kullanıcının girdiği araştırma/yöntemle AI değerlendirir (senkron).
router.post("/:id/mitigate-risk", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, id));
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    const risk = String(req.body?.risk || "").trim();
    const mitigation = String(req.body?.mitigation || "").trim();
    const scope = String(req.body?.scope || "financial");
    if (!risk) return res.status(400).json({ error: "Risk metni gerekli." });
    if (!mitigation) return res.status(400).json({ error: "Araştırma/yöntem girişi gerekli." });

    const prompt = `Sen kurumsal bir RİSK YÖNETİM ajanısın. Aşağıdaki riski, kullanıcının önerdiği araştırma/yöntem/önlem ışığında değerlendir.

PROJE: ${idea.title} — ${idea.description?.slice(0, 300)}
RİSK (${scope}): ${risk}
KULLANICININ ÖNERDİĞİ ARAŞTIRMA/YÖNTEM/ÖNLEM: ${mitigation}

Bu önlem riski ne ölçüde gideriyor? SADECE şu JSON'u döndür:
{
  "verdict": "resolved | reduced | open",
  "residualRisk": "önlemden sonra kalan risk (1 cümle; tamamen gideriliyorsa boş)",
  "rationale": "2-3 cümle gerekçe (Türkçe, somut)"
}`;

    let raw = "";
    try {
      const r = await ai.models.generateContent({
        model: GEMINI_MODELS.analysis,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 1024, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } as any,
      });
      raw = (r.text || "").trim();
    } catch (e) {
      req.log.error({ err: e }, "mitigate-risk gemini failed");
    }
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    if (!parsed || !["resolved", "reduced", "open"].includes(parsed.verdict)) {
      return res.status(502).json({ error: "Risk değerlendirmesi üretilemedi. Tekrar deneyin." });
    }

    const entry = {
      risk, mitigation, scope,
      verdict: parsed.verdict,
      residualRisk: typeof parsed.residualRisk === "string" ? parsed.residualRisk : "",
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
      at: new Date().toISOString(),
    };
    const aa = (idea.architecturalAnalysis as any) || {};
    aa.riskLog = Array.isArray(aa.riskLog) ? [...aa.riskLog, entry] : [entry];
    await db.update(ideasTable).set({ architecturalAnalysis: aa as any, updatedAt: new Date() }).where(eq(ideasTable.id, id));
    res.json(entry);
  } catch (err) {
    req.log.error({ err }, "Failed to mitigate risk");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/ideas/:id/project — update project management fields
router.patch("/:id/project", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { projectStatus, projectTeam, projectDocs } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (projectStatus !== undefined) updates.projectStatus = projectStatus;
    if (projectTeam !== undefined) updates.projectTeam = projectTeam;
    if (projectDocs !== undefined) updates.projectDocs = projectDocs;

    const [idea] = await db.update(ideasTable).set(updates).where(eq(ideasTable.id, id)).returning();
    if (!idea) return res.status(404).json({ error: "Idea not found" });

    // If status promoted to prototype, auto-create a project thread
    if (projectStatus === "prototype" || idea.status === "prototype") {
      setImmediate(() => autoCreateProjectThread({ id: idea.id, title: idea.title, description: idea.description }));
    }

    res.json(idea);
  } catch (err) {
    req.log.error({ err }, "Failed to update project fields");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/ideas/:id/thread — get linked community thread
router.get("/:id/thread", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [thread] = await db
      .select()
      .from(communityThreadsTable)
      .where(eq(communityThreadsTable.linkedIdeaId, id))
      .limit(1);
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    res.json({ success: true, data: thread });
  } catch (err) {
    req.log.error({ err }, "Failed to get idea thread");
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
