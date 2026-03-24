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
          "Kullanıcı bir yenilik fikri, proje önerisi veya girişim fikri paylaştığında çağır.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Fikrin kısa başlığı" },
            description: {
              type: "STRING",
              description:
                "Fikrin detaylı açıklaması: ne, neden, nasıl sorularını yanıtla",
            },
            authorName: {
              type: "STRING",
              description:
                "Fikri öneren kişi. Bilinmiyorsa 'Anonim' kullan.",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Fikirle ilgili etiketler (maks 5)",
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
        const formatPrompt = `Aşağıdaki araştırma içeriğini profesyonel ve akademik formatta yeniden düzenle.

Başlık: ${rawTitle}
Özet: ${rawSummary}
Bulgular/İçerik: ${rawFindings}
Teknik Analiz: ${rawTechnical}

Yapman gerekenler:
1. Türkçe dil bilgisi ve yazım hatalarını düzelt
2. Cümleleri daha akıcı, net ve profesyonel hale getir
3. Gereksiz tekrarları kaldır
4. Bölümleri düzenli madde/paragraf yapısına getir
5. Akademik üslup kullan — kısaltma ve argo kullanma

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
          fmtSummary = fmt.summary || rawSummary;
          fmtFindings = fmt.findings || rawFindings;
          fmtTechnical = fmt.technicalAnalysis || rawTechnical;
        }
      } catch (_) { /* use raw content if formatting fails */ }

      // ── Step 2: Generate cover image ────────────────────────────────────────
      let coverImageB64: string | null = null;
      let coverImageMimeType: string | null = null;

      try {
        const imgPrompt = `Professional research paper cover visual for a study titled "${rawTitle}". Abstract, minimal, corporate design using blue and indigo color palette. No text or labels. Clean geometric patterns or subtle data visualization motifs.`;
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
      const [item] = await db
        .insert(ideasTable)
        .values({
          title: (args.title as string) || "Başlıksız Fikir",
          description: (args.description as string) || "",
          authorName: (args.authorName as string) || "Anonim",
          tags: (args.tags as string[]) || [],
          collaborators: [],
          researchIds: [],
          relatedTo: [],
          roadmap: [],
          status: "active",
        })
        .returning();

      actions.push({ action: "idea_saved", data: { id: item.id, title: item.title } });
      return { success: true, id: item.id, message: `"${item.title}" fikri kaydedildi.` };
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
- Kullanıcı bir inovasyon fikri, proje önerisi paylaştığında → önce list_existing_ideas çağır, DB'de yoksa save_idea kullan
- Eğer DB'de gerçekten çok benzer bir fikir varsa: kaydetme, kullanıcıyı bildir

YANIT STİLİ:
- Kısa, net ve profesyonel
- Başarıyla kaydettikten sonra ne kaydedildiğini özetle
- Öneri ve bağlantı kur (bu araştırma şu fikirle ilgili olabilir gibi)
- Kullanıcıyı bir sonraki adım için yönlendir`;

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
