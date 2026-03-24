import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversations as conversationsTable,
  messages as messagesTable,
  researchTable,
  ideasTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { setImmediate } from "timers";

const router = Router();

// ─── Tool Declarations ───────────────────────────────────────────────────────

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "save_research",
        description:
          "Kullanıcının paylaştığı araştırma/makale içeriğini sisteme kaydeder. " +
          "Kullanıcı bir araştırma metni, makale özeti veya bulgu paylaştığında çağır.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Araştırmanın başlığı" },
            summary: {
              type: "STRING",
              description: "Araştırmanın kısa özeti (2-4 cümle)",
            },
            findings: {
              type: "STRING",
              description: "Ana bulgular, sonuçlar ve önemli çıktılar",
            },
            technicalAnalysis: {
              type: "STRING",
              description:
                "Teknik analiz, metodoloji veya yöntemler (varsa)",
            },
            authorName: {
              type: "STRING",
              description:
                "Araştırmanın yazarı. Bilinmiyorsa 'Anonim' kullan.",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Araştırmayla ilgili anahtar kelimeler / etiketler (maks 6, Türkçe veya teknik terim)",
            },
          },
          required: ["title", "summary", "findings", "authorName"],
        },
      },
      {
        name: "save_idea",
        description:
          "Kullanıcının önerdiği fikri sisteme kaydeder. " +
          "Kullanıcı bir yenilik fikri, proje önerisi veya girişim fikri paylaştığında çağır. " +
          "ZORUNLU: list_existing_research çıktısını kullanarak ilgili araştırmaları bağla ve eksik konuları belirt.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Fikrin kısa başlığı" },
            description: {
              type: "STRING",
              description: "Fikrin detaylı açıklaması: ne, neden, nasıl sorularını yanıtla",
            },
            authorName: {
              type: "STRING",
              description: "Fikri öneren kişi. Bilinmiyorsa 'Anonim' kullan.",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Fikirle ilgili etiketler (maks 5)",
            },
            linkedResearchIds: {
              type: "ARRAY",
              items: { type: "NUMBER" },
              description:
                "list_existing_research sonucundan bu fikirle DOĞRUDAN ilgili araştırmaların ID'leri. " +
                "Konu, etiket ve özet benzerliğine göre seç. İlgisi yoksa boş dizi [].",
            },
            neededResearchTopics: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Bu fikrin hayata geçirilmesi için ZORUNLU olan ama henüz sistemde bulunmayan araştırma konuları. " +
                "Fikrin temel bileşenlerini kapsayan, spesifik başlıklar yaz. " +
                "Zaten linkedResearchIds ile bağlanan konuları tekrar yazma.",
            },
            optionalResearchTopics: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Fikri güçlendirecek ama zorunlu olmayan ek araştırma konuları. " +
                "Nice-to-have araştırmalar. Zaten sistemde olanlara veya neededResearchTopics'e yazılanlara tekrar yazma.",
            },
          },
          required: ["title", "description", "authorName"],
        },
      },
      {
        name: "list_existing_research",
        description:
          "Sistemde kayıtlı araştırmaların listesini getirir. " +
          "Benzerlik kontrolü veya referans vermek için kullan.",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
      {
        name: "list_existing_ideas",
        description:
          "Sistemde kayıtlı fikirlerin listesini getirir. " +
          "Benzerlik kontrolü veya mevcut fikirlerle karşılaştırma için kullan.",
        parameters: {
          type: "OBJECT",
          properties: {},
        },
      },
    ],
  },
];

// ─── Background Autonomous Evaluation Agent ───────────────────────────────────

async function backgroundEvaluateIdea(ideaId: number, title: string, description: string) {
  try {
    const allResearch = await db.select().from(researchTable);
    const researchContext = allResearch.length > 0
      ? allResearch.map(r => `- ${r.title}: ${r.summary?.slice(0, 200)}`).join("\n")
      : "(Sistemde henüz araştırma bulunmuyor)";

    const evalPrompt = `Sen kurumsal inovasyon ekosistemi için bir değerlendirme ajanısın. Aşağıdaki fikri analiz et ve JSON döndür.

FİKİR:
Başlık: ${title}
Açıklama: ${description}

SİSTEMDEKİ MEVCUT ARAŞTIRMALAR:
${researchContext}

Şu kurallara göre değerlendir:
1. Ticari Fizibilite (0-10): Gelir modeli, ölçeklenebilirlik, pazar büyüklüğü
2. Pazar İhtiyacı (0-10): Gerçek bir acı noktası mı çözüyor, pazar talebi var mı?
3. Teknik Zorluk (0-10): 10=çok kolay, 0=imkansız. Mevcut teknoloji ile yapılabilirlik
4. Trend Uyumu (0-10): 2025-2027 pazar ve teknoloji trendleriyle örtüşme
5. Risk & AI Yönetişimi (0-10): KVKK, veri gizliliği, etik AI kullanımı açısından risk düzeyi (10=risksiz)

Her eksen için kısa gerekçe yaz.

Ayrıca:
- neededResearchTopics: Bu fikrin hayata geçmesi için ZORUNLU araştırma konuları (mevcut araştırmalar arasında EKSİK olanlar, max 5 konu)
- optionalResearchTopics: Fikri güçlendirecek ama zorunlu olmayan opsiyonel konular (max 3 konu)
- pivotSuggestion: Herhangi bir eksen <6 ise fikri kurtaracak SOMUT bir pivot önerisi (yoksa null)
- summary: 2-3 cümlelik özet değerlendirme

JSON formatı (SADECE JSON döndür, başka metin yok):
{
  "commercialFeasibility": 7,
  "marketNeed": 8,
  "technicalDifficulty": 6,
  "trendAlignment": 9,
  "riskGovernance": 7,
  "neededResearchTopics": ["konu1", "konu2"],
  "optionalResearchTopics": ["konu1"],
  "pivotSuggestion": null,
  "summary": "Değerlendirme özeti..."
}`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: evalPrompt }] }],
      config: { maxOutputTokens: 1024, temperature: 0.3 },
    });

    const match = res.text?.match(/\{[\s\S]*\}/);
    if (!match) return;

    const eval_ = JSON.parse(match[0]) as {
      commercialFeasibility: number;
      marketNeed: number;
      technicalDifficulty: number;
      trendAlignment: number;
      riskGovernance: number;
      neededResearchTopics: string[];
      optionalResearchTopics: string[];
      pivotSuggestion: string | null;
      summary: string;
    };

    await db
      .update(ideasTable)
      .set({
        neededResearchTopics: eval_.neededResearchTopics || [],
        optionalResearchTopics: eval_.optionalResearchTopics || [],
        evaluationScores: {
          commercialFeasibility: eval_.commercialFeasibility,
          marketNeed: eval_.marketNeed,
          technicalDifficulty: eval_.technicalDifficulty,
          trendAlignment: eval_.trendAlignment,
          riskGovernance: eval_.riskGovernance,
          summary: eval_.summary,
          pivotSuggestion: eval_.pivotSuggestion ?? undefined,
        },
        evaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ideasTable.id, ideaId));
  } catch (_) { /* non-blocking — silently fail */ }
}

// ─── Tool execution ───────────────────────────────────────────────────────────

type ActionEvent =
  | { action: "research_saved"; data: { id: number; title: string } }
  | { action: "idea_saved"; data: { id: number; title: string } };

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  actions: ActionEvent[]
): Promise<unknown> {
  switch (name) {
    case "save_research": {
      const rawTitle = (args.title as string) || "Başlıksız Araştırma";
      const rawSummary = (args.summary as string) || "";
      const rawFindings = (args.findings as string) || "";
      const rawTechnical = (args.technicalAnalysis as string) || "";
      const rawContent = [rawSummary, rawFindings].filter(Boolean).join("\n\n");

      // ── Step 1: Reformat & proofread content using Gemini ───────────────────
      let fmtSummary = rawSummary;
      let fmtFindings = rawFindings;
      let fmtTechnical = rawTechnical;

      try {
        const formatPrompt = `Aşağıdaki araştırma içeriğini akademik ve profesyonel formatta yeniden düzenle.

GİRDİ:
Başlık: ${rawTitle}
Özet: ${rawSummary}
Bulgular/İçerik: ${rawFindings}
Teknik Analiz: ${rawTechnical}

BÖLÜM KURALLARI:

**summary** (ÖZET):
- 2-3 cümlelik, kısa ve öz bir özet
- Araştırmanın amacını ve kapsamını anlat
- Düz paragraf halinde yaz, liste kullanma
- İçeriği doğrudan yansıt — abartma veya genelleme yapma

**findings** (BULGULAR):
- Araştırmanın somut bulgularını ve sonuçlarını içer
- Madde listesi (- ile) kullan, her bulgu ayrı satırda
- **Önemli sayısal veriler**, **anahtar kavramlar** ve **kritik sonuçlar** bold yap
- Minimum 3, maksimum 8 madde
- Akademik, doğrudan ve kesin bir dil kullan

**technicalAnalysis** (TEKNİK ANALİZ):
- Eğer girdide teknik detay varsa: metodoloji, kullanılan araçlar, platform veya teknik karşılaştırma yaz
- **Teknik terimler**, **platform adları**, **metodoloji adları** bold yap
- Madde listesi veya paragraf olabilir
- Eğer girdide teknik analiz yoksa boş string döndür: ""

GENEL KURALLAR:
- Türkçe dil bilgisi ve yazım hatalarını düzelt
- "bu çalışma incelemektedir" yerine "araştırma ortaya koymuştur" gibi aktif bulgusal dil kullan
- Gereksiz tekrar ve dolgu cümleleri kaldır
- Markdown formatını kullan: **bold**, - liste
- Her bölüm kendi içinde tam ve anlamlı olmalı

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"summary":"...","findings":"...","technicalAnalysis":"..."}`;

        const formatRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: formatPrompt }] }],
          config: { maxOutputTokens: 3072 },
        });
        const match = formatRes.text?.match(/\{[\s\S]*\}/);
        if (match) {
          const fmt = JSON.parse(match[0]);
          // Gemini may return arrays or strings — normalise to string
          const toStr = (v: unknown, fallback: string): string => {
            if (!v) return fallback;
            if (Array.isArray(v)) return v.join("\n");
            if (typeof v === "string") return v;
            return fallback;
          };
          fmtSummary = toStr(fmt.summary, rawSummary);
          fmtFindings = toStr(fmt.findings, rawFindings);
          fmtTechnical = toStr(fmt.technicalAnalysis, rawTechnical);
        }
      } catch (_) { /* use raw content if formatting fails */ }

      // ── Step 2: Generate cover image ────────────────────────────────────────
      let coverImageB64: string | null = null;
      let coverImageMimeType: string | null = null;

      try {
        const imgPrompt = `Corporate research cover art for: "${rawTitle}". Style: modern editorial, clean minimalism. Visual metaphors related to the topic. Color palette: deep indigo (#4f46e5), white, slate blue gradients. Elements: abstract flowing shapes, subtle grid or network patterns, professional depth. No text, no letters, no numbers. High quality, editorial magazine style.`;
        const imgResult = await generateImage(imgPrompt);
        coverImageB64 = imgResult.b64_json;
        coverImageMimeType = imgResult.mimeType;
      } catch (_) { /* continue without image if generation fails */ }

      // ── Step 3: Save to DB ───────────────────────────────────────────────────
      const [item] = await db
        .insert(researchTable)
        .values({
          title: rawTitle,
          summary: fmtSummary,
          findings: fmtFindings,
          technicalAnalysis: fmtTechnical,
          rawContent,
          authorName: (args.authorName as string) || "Anonim",
          tags: (args.tags as string[]) || [],
          relatedTo: [],
          status: "published",
          coverImageB64,
          coverImageMimeType,
        })
        .returning();

      actions.push({ action: "research_saved", data: { id: item.id, title: item.title } });

      // Auto-link non-blocking
      setImmediate(async () => {
        try {
          const ideas = await db.select().from(ideasTable);
          if (ideas.length === 0) return;
          const ideaList = ideas
            .map((i) => `ID:${i.id} | ${i.title} | ${i.description?.slice(0, 150)}`)
            .join("\n");
          const prompt = `Yeni araştırma: "${item.title}" - ${item.summary}\n\nFikirler:\n${ideaList}\n\nHangi fikirler bu araştırmayla ilgili? JSON: {"linkedIdeaIds":[]}`;
          const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { maxOutputTokens: 256 },
          });
          const match = res.text?.match(/\{[\s\S]*\}/);
          if (!match) return;
          const { linkedIdeaIds } = JSON.parse(match[0]) as { linkedIdeaIds: number[] };
          for (const ideaId of linkedIdeaIds || []) {
            const idea = ideas.find((i) => i.id === ideaId);
            if (!idea) continue;
            const existing = idea.researchIds || [];
            if (existing.includes(item.id)) continue;
            await db
              .update(ideasTable)
              .set({ researchIds: [...existing, item.id], updatedAt: new Date() })
              .where(eq(ideasTable.id, ideaId));
          }
        } catch (_) { /* non-blocking */ }
      });

      return { success: true, id: item.id, message: `"${item.title}" araştırması kaydedildi.` };
    }

    case "save_idea": {
      const neededTopics = (args.neededResearchTopics as string[]) || [];
      const optionalTopics = (args.optionalResearchTopics as string[]) || [];
      const rawLinkedIds = (args.linkedResearchIds as number[]) || [];

      // Validate linked IDs against actual DB research IDs to avoid phantom links
      let validLinkedIds: number[] = [];
      if (rawLinkedIds.length > 0) {
        const existing = await db.select({ id: researchTable.id }).from(researchTable);
        const existingIds = new Set(existing.map(r => r.id));
        validLinkedIds = rawLinkedIds.filter(id => existingIds.has(id));
      }

      const [item] = await db
        .insert(ideasTable)
        .values({
          title: (args.title as string) || "Başlıksız Fikir",
          description: (args.description as string) || "",
          authorName: (args.authorName as string) || "Anonim",
          tags: (args.tags as string[]) || [],
          collaborators: [],
          researchIds: validLinkedIds,
          relatedTo: [],
          roadmap: [],
          neededResearchTopics: neededTopics,
          optionalResearchTopics: optionalTopics,
          status: "active",
        })
        .returning();

      actions.push({ action: "idea_saved", data: { id: item.id, title: item.title } });

      // ── Background autonomous evaluation (non-blocking) ──────────────────────
      setImmediate(() => backgroundEvaluateIdea(item.id, item.title, item.description || ""));

      return {
        success: true,
        id: item.id,
        linkedResearchCount: validLinkedIds.length,
        message: `"${item.title}" fikri kaydedildi. ${validLinkedIds.length} araştırma bağlandı.`,
      };
    }

    case "list_existing_research": {
      const items = await db.select().from(researchTable).orderBy(researchTable.createdAt);
      // response must be an object (not array) for Gemini function_response
      return {
        count: items.length,
        items: items.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary?.slice(0, 200),
          tags: r.tags,
        })),
      };
    }

    case "list_existing_ideas": {
      const items = await db.select().from(ideasTable).orderBy(ideasTable.createdAt);
      // response must be an object (not array) for Gemini function_response
      return {
        count: items.length,
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description?.slice(0, 200),
          tags: i.tags,
          status: i.status,
        })),
      };
    }

    default:
      return { error: `Bilinmeyen araç: ${name}` };
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sen Think-Inn kurumsal inovasyon ekosistemi orkestratör ajanısın. Türkçe konuşuyorsun.

Görevin: Kullanıcının mesajını analiz et ve gerektiğinde araçlarını kullanarak sisteme araştırma veya fikir ekle.

KRİTİK KURAL - VERİTABANI HER ZAMAN ÖNCE KONTROL EDİLMELİ:
- Bir içeriğin daha önce eklenip eklenmediğini ASLA konuşma geçmişinden anlama.
- Bunun yerine MUTLAKA önce list_existing_research veya list_existing_ideas araçlarını çağır ve gerçek DB sonuçlarına bak.
- Konuşma geçmişinde "eklendi" veya "kaydedildi" gibi ifadeler geçse bile, bu geçmiş konuşmalar yanlış olabilir. Her zaman araç çağrısıyla doğrula.
- Kullanıcı tekrar eklemeyi istiyorsa, önce DB'yi kontrol et; eğer gerçekten yoksa ekle.

ARAŞTIRMA KAYDETME:
- Kullanıcı bir araştırma metni, makale özeti, akademik içerik veya bulgu paylaştığında → önce list_existing_research çağır, DB'de yoksa save_research kullan
- İçeriği analiz ederek başlık, özet, bulgular ve teknik analiz çıkar
- Yazar adı belirtilmemişse "Anonim" kullan
- Benzer başlıklı araştırma DB'de varsa kullanıcıya sor, yoksa doğrudan kaydet

FİKİR KAYDETME:
- Kullanıcı bir inovasyon fikri veya proje önerisi paylaştığında → ÖNCE list_existing_research VE list_existing_ideas çağır
- DB'de çok benzer bir fikir varsa: kaydetme, kullanıcıyı bildir
- Benzer fikir yoksa hemen save_idea çağır; şunları belirle:
  a) linkedResearchIds: Sistemdeki araştırmalardan bu fikirle ilgili olanların ID'leri (konu/etiket/özet uyumu)
  b) neededResearchTopics: Fikrin hayata geçmesi için ZORUNLU, sistemde HENÜZ BULUNMAYAN araştırma konuları (max 4)
  c) optionalResearchTopics: Zorunlu olmayan ama fikri güçlendirecek opsiyonel konular (max 3)

FİKİR KAYDEDİLDİKTEN SONRA:
1. Kaydedildiğini kısaca onayla
2. Bağlanan araştırmaları belirt (yoksa "Mevcut araştırmalarla örtüşme bulunamadı")
3. "Fikir detaylarından kapsamlı değerlendirme raporunu görebilirsin." de
4. Kullanıcıya bir sonraki adım için yönlendirme yap (ilgili araştırma öner veya ne tür araştırma gerektiğini söyle)

ARAŞTIRMA KAYDEDİLDİKTEN SONRA YAPILACAKLAR:
- Kaydedilen araştırmayı özetle
- Sistemdeki fikir(ler)le ilişkisini belirt (varsa)
- Bir sonraki adım için yönlendir

YANIT STİLİ:
- Kısa, net ve profesyonel
- Madde listelerini • ile göster
- **bold** ile önemli kavramları vurgula`;

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.createdAt);
    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const [conversation] = await db
      .insert(conversationsTable)
      .values({ title })
      .returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json({ ...conversation, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Conversation not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/messages", async (req, res) => {
  const conversationId = parseInt(req.params.id);
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: "Content is required" });

  try {
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Save user message
    await db.insert(messagesTable).values({ conversationId, role: "user", content });

    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const emitSSE = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Build Gemini contents from conversation history
    const buildContents = (msgs: typeof allMessages) => [
      { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model" as const, parts: [{ text: "Anlıyorum. Sizi dinliyorum ve gerektiğinde araçlarımı kullanarak içerikleri sisteme kaydedeceğim." }] },
      ...msgs.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];

    // ── Agentic Loop ────────────────────────────────────────────────────────
    const executedActions: ActionEvent[] = [];
    let currentContents = buildContents(allMessages);
    let finalText = "";
    let iterations = 0;
    const MAX_ITER = 6;

    while (iterations < MAX_ITER) {
      iterations++;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: currentContents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: { tools: TOOLS as any, maxOutputTokens: 4096 },
      });

      const candidate = result.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Separate text and function calls
      const functionCallParts = parts.filter((p: any) => p.functionCall);
      const textContent = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text as string)
        .join("");

      if (functionCallParts.length === 0) {
        // No function calls — this is the final response
        finalText = textContent;
        break;
      }

      // Execute function calls
      const functionResponseParts: any[] = [];
      for (const part of functionCallParts) {
        const fc = (part as any).functionCall;
        try {
          const toolResult = await executeTool(fc.name, fc.args || {}, executedActions);
          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: toolResult,
            },
          });
        } catch (err) {
          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { error: String(err) },
            },
          });
        }
      }

      // Append assistant message with function calls + user message with results
      currentContents = [
        ...currentContents,
        { role: "model" as const, parts },
        { role: "user" as const, parts: functionResponseParts },
      ];
    }

    // ── Emit action events FIRST so UI refreshes immediately ────────────────
    for (const action of executedActions) {
      emitSSE(action);
    }

    // ── Stream final text response ───────────────────────────────────────────
    if (finalText) {
      // Simulate streaming by sending words in small batches
      const words = finalText.split(/(?<=\s)/);
      let batch = "";
      for (let i = 0; i < words.length; i++) {
        batch += words[i];
        if (batch.length >= 20 || i === words.length - 1) {
          emitSSE({ content: batch });
          batch = "";
        }
      }
    }

    // Save assistant response to DB
    const assistantContent = finalText || "İşlem tamamlandı.";
    await db.insert(messagesTable).values({
      conversationId,
      role: "assistant",
      content: assistantContent,
    });

    emitSSE({ done: true });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
