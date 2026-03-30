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
import { backgroundEvaluateIdea } from "../../utils/evaluate-idea";
import { buildResearchCoverPrompt } from "../../utils/cover-image";
import { autoCreateResearchThread } from "../../utils/community-auto";

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
              description: "Araştırmanın kısa yönetici özeti (2-4 cümle). SADECE bu alan kısa olacak.",
            },
            findings: {
              type: "STRING",
              description:
                "İçerikteki TÜM bulgular, argümanlar, veriler ve sonuçlar. KISALTMA YAPMA — içeriğin tamamını buraya koy. rawContent varsa oradaki metni aynen aktar.",
            },
            technicalAnalysis: {
              type: "STRING",
              description:
                "İçerikteki TÜM teknik detaylar, metodolojiler, araçlar ve karşılaştırmalar. KISALTMA YAPMA. Teknik bilgi yoksa boş bırak.",
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
            rawContent: {
              type: "STRING",
              description:
                "Kullanıcının yapıştırdığı ham, formatlanmamış tam metin. Düz metin makale/araştırma yapıştırıldıysa MUTLAKA bu alana koy. AI bu metni yapılandıracak.",
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
        name: "update_idea",
        description:
          "Mevcut bir fikri günceller. " +
          "Kullanıcı bir fikre araştırma eklemek, bağlamak veya mevcut bir fikrin bilgilerini güncellemek istediğinde kullan. " +
          "YENİ FİKİR OLUŞTURMA - save_idea; MEVCUT FİKİR GÜNCELLEME - update_idea.",
        parameters: {
          type: "OBJECT",
          properties: {
            ideaId: {
              type: "NUMBER",
              description: "Güncellenecek fikrin ID'si. list_existing_ideas çıktısından al.",
            },
            addResearchIds: {
              type: "ARRAY",
              items: { type: "NUMBER" },
              description:
                "Bu fikre EKLENECEK araştırma ID'leri. Mevcut bağlantılara eklenir, silmez. " +
                "Sadece eklemek istenen ID'leri gönder.",
            },
            neededResearchTopics: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Güncellenmiş zorunlu araştırma konuları listesi (tümünü yaz, yerini alır).",
            },
            optionalResearchTopics: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Güncellenmiş opsiyonel araştırma konuları listesi (tümünü yaz, yerini alır).",
            },
            title: {
              type: "STRING",
              description: "Yeni başlık (opsiyonel, yalnızca değişecekse gönder).",
            },
            description: {
              type: "STRING",
              description: "Yeni açıklama (opsiyonel, yalnızca değişecekse gönder).",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Yeni etiketler (opsiyonel, yalnızca değişecekse gönder).",
            },
          },
          required: ["ideaId"],
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
      {
        name: "generate_idea_analysis",
        description:
          "Bir fikir için kapsamlı fonksiyonel analiz, teknik analiz ve mimari plan oluşturur. " +
          "Kullanıcı 'analiz oluştur', 'mimari şema', 'fonksiyonel analiz', 'teknik analiz' veya " +
          "'mimari plan' gibi ifadeler kullandığında MUTLAKA bu aracı çağır. " +
          "list_existing_ideas çıktısından ilgili fikrin ID'sini al.",
        parameters: {
          type: "OBJECT",
          properties: {
            ideaId: {
              type: "NUMBER",
              description: "Analiz edilecek fikrin ID'si. list_existing_ideas çıktısından al.",
            },
          },
          required: ["ideaId"],
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
      const pastedRawContent = (args.rawContent as string) || "";
      // Use pasted raw content as primary source if provided; fall back to extracted fields
      const rawContent = pastedRawContent || [rawSummary, rawFindings, rawTechnical].filter(Boolean).join("\n\n");

      // ── Step 1: Reformat & structure content using Gemini ───────────────────
      let fmtSummary = rawSummary;
      let fmtFindings = rawFindings;
      let fmtTechnical = rawTechnical;

      try {
        const formatPrompt = `Aşağıdaki araştırma/makale içeriğini formatla ve yapılandır. İÇERİĞİ KISALTMA — sadece format ve yapı değişecek.
${pastedRawContent ? `\nHAM METİN (kullanıcının yapıştırdığı düz metin — bunu öncelikli kaynak olarak kullan):\n${pastedRawContent}\n` : ""}
GİRDİ (AI tarafından çıkarılan alanlar):
Başlık: ${rawTitle}
Özet: ${rawSummary}
Bulgular/İçerik: ${rawFindings}
Teknik Analiz: ${rawTechnical}

BÖLÜM KURALLARI:

**summary** (YÖNETİCİ ÖZETİ — sadece bu alan kısa olacak):
- Maksimum 4-5 cümle, makalenin başına konacak kısa bir özet kutusu için
- Araştırmanın amacını, kapsamını ve temel çıktısını anlat
- Düz paragraf halinde yaz, liste kullanma
- Okuyucuya "bu makale ne hakkında?" sorusunu yanıtlasın

**findings** (BULGULAR VE İÇERİK — TAMAMI KORUNACAK):
- HAM METİN veya girdideki TÜM bilgi, bulgu, veri, argüman ve sonuçları koru
- HİÇBİR bilgiyi çıkarma, kısaltma veya özetleme — sadece formatla
- Madde listesi (- ile) kullan, her önemli nokta ayrı satırda
- **Önemli sayısal veriler**, **anahtar kavramlar**, **kritik sonuçlar** ve **özel isimler** bold yap
- Madde sayısında SINIR YOK — içerik ne kadarsa o kadar madde yaz
- Alt başlıklar gerekiyorsa ## kullan
- Akademik, doğrudan ve kesin dil kullan

**technicalAnalysis** (TEKNİK ANALİZ — TAMAMI KORUNACAK):
- Girdideki TÜM teknik detayları, metodolojileri, araçları, platformları ve karşılaştırmaları koru
- **Teknik terimler**, **platform adları**, **metodoloji adları**, **araç isimleri** bold yap
- Madde listesi veya alt başlıklı paragraflar kullan
- Eğer girdide hiç teknik analiz yoksa boş string döndür: ""

GENEL KURALLAR:
- Türkçe dil bilgisi ve yazım hatalarını düzelt
- Aktif dil kullan: "araştırma ortaya koymuştur", "bulgular göstermektedir"
- Gereksiz tekrar ve dolgu cümleler kaldır AMA bilgi kaybı olmasın
- Markdown: **bold**, - liste, ## alt başlık
- summary kısa, findings ve technicalAnalysis TAM ve KAPSAMLI olmalı

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"summary":"...","findings":"...","technicalAnalysis":"..."}`;

        const formatRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: formatPrompt }] }],
          config: { maxOutputTokens: 32768 },
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

      // ── Step 2: Save to DB immediately (no image yet) ───────────────────────
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
          coverImageB64: null,
          coverImageMimeType: null,
        })
        .returning();

      actions.push({ action: "research_saved", data: { id: item.id, title: item.title } });

      // ── Step 3: Generate cover image + community thread in background ────────
      setImmediate(() => {
        autoCreateResearchThread({ id: item.id, title: item.title, summary: fmtSummary || "" });
      });
      setImmediate(async () => {
        try {
          const imgPrompt = await buildResearchCoverPrompt(
            rawTitle,
            fmtSummary || "",
            (args.tags as string[]) || [],
            fmtFindings || "",
          );
          const imgResult = await generateImage(imgPrompt);
          await db.update(researchTable)
            .set({ coverImageB64: imgResult.b64_json, coverImageMimeType: imgResult.mimeType, updatedAt: new Date() })
            .where(eq(researchTable.id, item.id));
          console.log(`[CoverImage] Generated for research #${item.id}`);
        } catch (imgErr) {
          console.error(`[CoverImage] Failed for research #${item.id}:`, imgErr);
        }
      });

      return { success: true, id: item.id, message: `"${item.title}" araştırması kaydedildi. Kapak görseli arka planda oluşturuluyor.` };
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
      setImmediate(() => backgroundEvaluateIdea(item.id, item.title, item.description || "", validLinkedIds));

      return {
        success: true,
        id: item.id,
        linkedResearchCount: validLinkedIds.length,
        message: `"${item.title}" fikri kaydedildi. ${validLinkedIds.length} araştırma bağlandı.`,
      };
    }

    case "update_idea": {
      const ideaId = args.ideaId as number;
      if (!ideaId) return { error: "ideaId zorunlu." };

      // Fetch existing idea
      const [existing] = await db.select().from(ideasTable).where(eq(ideasTable.id, ideaId));
      if (!existing) return { error: `Fikir bulunamadı: ID ${ideaId}` };

      // Build update object — only update provided fields
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      // Merge research IDs (add new ones, keep existing)
      if (args.addResearchIds && (args.addResearchIds as number[]).length > 0) {
        const rawIds = args.addResearchIds as number[];
        // Validate against actual DB research IDs
        const allResearch = await db.select({ id: researchTable.id }).from(researchTable);
        const validIds = new Set(allResearch.map(r => r.id));
        const toAdd = rawIds.filter(id => validIds.has(id));
        const existingIds = existing.researchIds || [];
        const merged = [...new Set([...existingIds, ...toAdd])];
        updates.researchIds = merged;
      }

      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.tags) updates.tags = args.tags;

      // If research is being added, reset evaluatedAt so re-evaluation runs
      const researchAdded = updates.researchIds !== undefined;
      if (researchAdded) {
        updates.evaluatedAt = null;
        updates.evaluationScores = null;
      }

      const [updated] = await db
        .update(ideasTable)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updates as any)
        .where(eq(ideasTable.id, ideaId))
        .returning();

      actions.push({ action: "idea_saved", data: { id: updated.id, title: updated.title } });

      const addedCount = researchAdded
        ? ((updates.researchIds as number[]).length - (existing.researchIds || []).length)
        : 0;

      // Re-evaluate with updated linked research context (non-blocking)
      if (researchAdded) {
        const finalResearchIds = updates.researchIds as number[];
        setImmediate(() =>
          backgroundEvaluateIdea(updated.id, updated.title, updated.description || "", finalResearchIds)
        );
      }

      return {
        success: true,
        id: updated.id,
        message: `"${updated.title}" fikri güncellendi. ${addedCount > 0 ? `${addedCount} araştırma eklendi, değerlendirme yenileniyor.` : ''}`,
        totalLinkedResearch: (updated.researchIds || []).length,
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
          linkedResearchIds: i.researchIds || [],
          linkedResearchCount: (i.researchIds || []).length,
          neededResearchTopics: i.neededResearchTopics || [],
          optionalResearchTopics: i.optionalResearchTopics || [],
        })),
      };
    }

    case "generate_idea_analysis": {
      const ideaId = args.ideaId as number;
      if (!ideaId) return { error: "ideaId zorunlu." };

      // Fetch idea
      const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, ideaId));
      if (!idea) return { error: `Fikir bulunamadı: ID ${ideaId}` };

      // Fetch all linked research
      let allLinkedResearch: (typeof researchTable.$inferSelect)[] = [];
      if (idea.researchIds && idea.researchIds.length > 0) {
        const allResearch = await db.select().from(researchTable);
        allLinkedResearch = allResearch.filter(r => (idea.researchIds || []).includes(r.id));
      }

      const ideaContext = `Fikir Başlığı: ${idea.title}
Açıklama: ${idea.description}
Etiketler: ${(idea.tags || []).join(", ")}
Zorunlu Araştırma Konuları: ${(idea.neededResearchTopics || []).join(", ") || "—"}
Opsiyonel Araştırma Konuları: ${(idea.optionalResearchTopics || []).join(", ") || "—"}`;

      const researchContext = allLinkedResearch.length > 0
        ? allLinkedResearch.map(r =>
            `Araştırma: ${r.title}\nÖzet: ${(r.summary || "").slice(0, 500)}\nBulgular: ${(r.findings || "").slice(0, 500)}`
          ).join("\n---\n")
        : "Henüz bağlı araştırma yok.";

      // ── Generate three sections SEQUENTIALLY to avoid rate limits ──────────
      const geminiCall = async (prompt: string, tokens = 6000): Promise<string> => {
        try {
          const r = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { maxOutputTokens: tokens },
          });
          return r.text?.trim() || "";
        } catch (e) {
          console.error("[Analysis] Gemini call failed:", (e as Error).message);
          return "";
        }
      };

      const baseCtx = `## FİKİR\n${ideaContext}\n\n## İLGİLİ ARAŞTIRMALAR\n${researchContext}\n\n`;

      const functionalAnalysis  = await geminiCall(`${baseCtx}Bu fikrin FONKSİYONEL ANALİZİNİ yap. Sistemin ne yapacağını, temel özellikleri, kullanıcı senaryolarını, iş akışlarını, fonksiyonel gereksinimler ve kabul kriterlerini Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık (##) kullan. Sadece analiz içeriğini döndür.`);
      const technicalAnalysis   = await geminiCall(`${baseCtx}Bu fikrin TEKNİK ANALİZİNİ yap. Önerilen teknoloji yığını ve gerekçeleri, mimari pattern'ler, performans/ölçeklenebilirlik/güvenlik stratejileri, API tasarımı, veri modeli ve teknik riskler konularını Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık (##) kullan. Sadece analiz içeriğini döndür.`);
      const architecturalPlan   = await geminiCall(`${baseCtx}Bu fikrin MİMARİ PLANINI hazırla. Sistem bileşenlerini katmanlara göre detaylı açıkla. Her bileşenin sorumluluğunu, iletişim protokollerini, veri akışını ve deployment stratejisini Türkçe Markdown formatında kapsamlı yaz. Minimum 5 ana başlık kullan. Sadece plan içeriğini döndür.`);

      console.log(`[Analysis] Idea #${ideaId} — functional: ${functionalAnalysis.length}, technical: ${technicalAnalysis.length}, arch: ${architecturalPlan.length} chars`);

      if (!functionalAnalysis && !technicalAnalysis && !architecturalPlan) {
        return { error: "Gemini analiz üretemedi. Lütfen tekrar deneyin." };
      }

      // ── Generate structured flow diagram (sequential, after text) ───────────
      type FlowNode = { id: string; label: string; type: string; description?: string; layer?: string };
      type FlowEdge = { from: string; to: string; label?: string; animated?: boolean };
      let flowDiagram: { nodes: FlowNode[]; edges: FlowEdge[] } | undefined;

      try {
        const flowPrompt = `Proje: ${idea.title}
Açıklama: ${idea.description}

Bu proje için sistem mimarisi JSON şemasını oluştur. Katman türleri: user, frontend, backend, database, external, process.

JSON (SADECE bunu döndür, başka hiçbir şey yazma):
{"nodes":[{"id":"n1","label":"Kullanıcı","type":"user","description":"Son kullanıcı","layer":"user"},{"id":"n2","label":"Web Arayüzü","type":"frontend","description":"React SPA","layer":"frontend"},{"id":"n3","label":"API Sunucusu","type":"backend","description":"Node.js REST API","layer":"backend"},{"id":"n4","label":"Veritabanı","type":"database","description":"PostgreSQL","layer":"database"}],"edges":[{"from":"n1","to":"n2","label":"HTTPS","animated":true},{"from":"n2","to":"n3","label":"REST"},{"from":"n3","to":"n4","label":"SQL"}]}

Proje gerçekliğine uygun 6-12 node üret. Her edge'de protokol/teknoloji belirt.`;

        const flowRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: flowPrompt }] }],
          config: { maxOutputTokens: 4096, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } as any,
        });

        const rawText = flowRes.text?.trim() || "";
        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch {
          const m = rawText.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (parsed?.nodes?.length > 0 && Array.isArray(parsed.edges)) {
          flowDiagram = parsed;
          console.log(`[FlowDiagram] ✓ ${parsed.nodes.length} nodes, ${parsed.edges.length} edges`);
        }
      } catch (e) {
        console.warn("[FlowDiagram] Could not generate flow data:", (e as Error).message);
      }

      const architecturalAnalysis = {
        functionalAnalysis,
        technicalAnalysis,
        architecturalPlan,
        generatedAt: new Date().toISOString(),
        ...(flowDiagram ? { flowDiagram } : {}),
      };

      await db.update(ideasTable)
        .set({ architecturalAnalysis, updatedAt: new Date() } as any)
        .where(eq(ideasTable.id, ideaId));

      actions.push({ action: "idea_saved", data: { id: idea.id, title: idea.title } });

      return {
        success: true,
        ideaId: idea.id,
        ideaTitle: idea.title,
        message: `"${idea.title}" fikri için analiz oluşturuldu ve kaydedildi. Fikir kartını açarak görüntüleyebilirsin.`,
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
- Kullanıcı DÜZ METİN yapıştırdıysa (ham, formatsız metin): rawContent alanına tam metni AYNEN koy. summary için 2-4 cümlelik kısa özet yaz. findings ve technicalAnalysis alanlarına da içeriği KISALTMADAN aktar — sistem sonradan otomatik formatlar
- Yazar adı belirtilmemişse "Anonim" kullan
- Benzer başlıklı araştırma DB'de varsa kullanıcıya sor, yoksa doğrudan kaydet

FİKİR İŞLEMLERİ — KRİTİK KURAL:

▶ YENİ FİKİR OLUŞTURMA (save_idea):
- Kullanıcı yeni bir inovasyon fikri veya proje önerisi paylaştığında kullan
- ÖNCE list_existing_research VE list_existing_ideas çağır; DB'de çok benzer fikir varsa kaydetme
- Benzer yoksa save_idea çağır: linkedResearchIds (ilgili araştırma ID'leri), neededResearchTopics (max 4 zorunlu), optionalResearchTopics (max 3 opsiyonel)

▶ MEVCUT FİKİR GÜNCELLEME (update_idea) — KESİNLİKLE save_idea DEĞİL:
Şu durumlarda update_idea çağır:
  - "Bu fikre araştırmayı bağla / ekle / link et"
  - "Fikri güncelle / düzenle"
  - "Bu araştırmayı fikre ekle"
  - Kullanıcı mevcut bir fikirden bahsederken araştırma bağlamak istediğinde
Adımlar:
  1. list_existing_ideas çağır → fikrin ID'sini al
  2. list_existing_research çağır → eklenecek araştırmanın ID'sini doğrula
  3. update_idea çağır: { ideaId, addResearchIds: [<ID>] }
  ASLA save_idea ÇAĞIRMA — bu mükerrer fikir oluşturur!

FİKİR KAYDEDİLDİKTEN / GÜNCELLENDİKTEN SONRA:
1. İşlemi kısaca onayla
2. Bağlanan araştırmaları belirt
3. "Fikir detaylarından kapsamlı değerlendirme raporunu görebilirsin." de

ARAŞTIRMA KAYDEDİLDİKTEN SONRA YAPILACAKLAR:
- Kaydedilen araştırmayı özetle
- Sistemdeki fikir(ler)le ilişkisini belirt (varsa)
- Bir sonraki adım için yönlendir

ANALİZ OLUŞTURMA:
- Kullanıcı bir fikir için "analiz oluştur", "mimari şema", "fonksiyonel analiz", "teknik analiz", "mimari plan" istediğinde:
  1. ÖNCE list_existing_ideas çağır → fikrin ID'sini bul
  2. SONRA generate_idea_analysis çağır: { ideaId: <ID> }
  3. Analiz tamamlandığında kullanıcıya "Analiz tamamlandı, fikir detaylarından görüntüleyebilirsiniz." mesajı ver
- ASLA "bu aracım yok" veya "yapamam" deme — generate_idea_analysis aracını kullan

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

    // Keep SSE connection alive during long operations
    const keepAlive = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 5000);

    // Build Gemini contents from conversation history
    const buildContents = (msgs: typeof allMessages) => [
      { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model" as const, parts: [{ text: "Anlıyorum. Sizi dinliyorum ve gerektiğinde araçlarımı kullanarak içerikleri sisteme kaydedeceğim." }] },
      ...msgs.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];

    // ── Tool name → human-readable progress label ────────────────────────────
    const TOOL_PROGRESS: Record<string, string> = {
      list_existing_research:  "Mevcut araştırmalar kontrol ediliyor...",
      list_existing_ideas:     "Mevcut fikirler kontrol ediliyor...",
      save_research:           "Araştırma kaydediliyor...",
      save_idea:               "Fikir kaydediliyor...",
      update_idea:             "Fikir güncelleniyor...",
      generate_idea_analysis:  "Mimari analiz oluşturuluyor (bu işlem 1-2 dakika sürebilir)...",
    };

    // ── Agentic Loop ────────────────────────────────────────────────────────
    const executedActions: ActionEvent[] = [];
    let currentContents = buildContents(allMessages);
    let finalText = "";
    let iterations = 0;
    const MAX_ITER = 6;

    while (iterations < MAX_ITER) {
      iterations++;

      const result = await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: currentContents,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: { tools: TOOLS as any, maxOutputTokens: 4096 },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini API timeout (90s)")), 90_000)
        ),
      ]);

      const candidate = result.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Separate text and function calls
      const functionCallParts = parts.filter((p: any) => p.functionCall);
      const rawTextContent = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text as string)
        .join("");
      // Strip tool_code blocks that Gemini sometimes leaks into text output
      const textContent = rawTextContent
        .replace(/```tool_code[\s\S]*?```/g, "")
        .replace(/tool_code\s+\S[^\n]*/g, "")
        .trim();

      if (functionCallParts.length === 0) {
        // No function calls — this is the final response
        finalText = textContent;
        break;
      }

      // ── Emit progress for each tool about to run ─────────────────────────
      for (const part of functionCallParts) {
        const toolName = (part as any).functionCall?.name as string;
        const label = TOOL_PROGRESS[toolName];
        if (label) emitSSE({ progress: label });
      }

      // Execute function calls
      const functionResponseParts: any[] = [];
      for (const part of functionCallParts) {
        const fc = (part as any).functionCall;
        try {
          const toolResult = await executeTool(fc.name, fc.args || {}, executedActions);

          // ── Emit action events inline as tools complete ──────────────────
          while (executedActions.length > 0) {
            const action = executedActions.shift()!;
            emitSSE(action);
          }

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

    // ── Emit any remaining action events ────────────────────────────────────
    for (const action of executedActions) {
      emitSSE(action);
    }

    // ── If loop ended without a final text, ask Gemini for a summary ────────
    if (!finalText) {
      try {
        // No tools in the summary call — we want text, not another tool invocation
        const summaryResult = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: currentContents,
          config: { maxOutputTokens: 1024 },
        });
        const sp = summaryResult.candidates?.[0]?.content?.parts || [];
        finalText = sp.filter((p: any) => p.text).map((p: any) => p.text as string).join("");
      } catch {
        finalText = "İşlem tamamlandı.";
      }
    }

    // ── Clean final text before streaming ───────────────────────────────────
    finalText = finalText
      .replace(/```tool_code[\s\S]*?```/g, "")
      .replace(/tool_code\s+\S[^\n]*/g, "")
      .trim();

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

    clearInterval(keepAlive);
    emitSSE({ done: true });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      clearInterval(keepAlive);
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
