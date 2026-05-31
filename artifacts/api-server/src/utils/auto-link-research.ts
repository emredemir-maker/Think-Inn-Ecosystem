/**
 * auto-link-research.ts — Yeni eklenen bir araştırmayı, mevcut fikirlerle
 * AI (Gemini) ile semantik olarak eşleştirip otomatik bağlar.
 *
 * Hem REST route'undan (research.ts) hem chat akışından (conversations.ts)
 * çağrılır — böylece araştırma HANGİ yoldan eklenirse eklensin otomatik
 * eşleştirme tetiklenir.
 *
 * Bağlama mantığı:
 *   - İlgili her fikrin researchIds dizisine bu araştırmanın id'si eklenir
 *   - Eşleşen konu varsa researchTopicMappings'e {autoLinked:true} kaydı eklenir
 */
import { db } from "@workspace/db";
import { researchTable, ideasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai, GEMINI_MODELS } from "@workspace/integrations-gemini-ai";

interface TopicMatch {
  topic: string;
  topicType: "needed" | "optional";
  confidence: number;
}
interface LinkResult {
  ideaId: number;
  topicMatch?: TopicMatch;
}

export async function autoLinkResearchToIdeas(
  researchId: number,
  researchTitle: string,
  researchSummary: string,
  researchFindings: string,
  researchTechnicalAnalysis: string,
) {
  try {
    const ideas = await db.select().from(ideasTable);
    if (ideas.length === 0) return;

    const ideaList = ideas
      .map((i) => {
        const needed = ((i.neededResearchTopics as string[]) || []).join(", ") || "—";
        const optional = ((i.optionalResearchTopics as string[]) || []).join(", ") || "—";
        return `ID:${i.id} | Başlık: ${i.title} | Açıklama: ${(i.description || "").slice(0, 200)} | Zorunlu Araştırma Konuları: [${needed}] | Opsiyonel Araştırma Konuları: [${optional}]`;
      })
      .join("\n");

    const researchContent = [
      `Başlık: ${researchTitle}`,
      researchSummary ? `Özet: ${researchSummary.slice(0, 400)}` : "",
      researchFindings ? `Bulgular: ${researchFindings.slice(0, 400)}` : "",
      researchTechnicalAnalysis ? `Teknik Analiz: ${researchTechnicalAnalysis.slice(0, 300)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

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
    { "ideaId": 1, "topicMatch": { "topic": "Eşleşen konu adı (tam metin)", "topicType": "needed", "confidence": 85 } },
    { "ideaId": 2 }
  ]
}

"topicMatch" alanı yalnızca gerçekten eşleşen bir konu varsa ekle. confidence 0-100 arasında.
Hiçbir fikir ilgili değilse: {"links": []}`;

    const result = await ai.models.generateContent({
      model: GEMINI_MODELS.analysis,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = result.text?.trim() || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { links: LinkResult[] };
    const links = parsed.links || [];

    for (const link of links) {
      const idea = ideas.find((i) => i.id === link.ideaId);
      if (!idea) continue;

      const existingIds: number[] = Array.isArray(idea.researchIds) ? (idea.researchIds as number[]) : [];
      const existingMappings: Array<{ researchId: number; topic: string; topicType: string; autoLinked: boolean; confidence?: number }> =
        Array.isArray(idea.researchTopicMappings) ? (idea.researchTopicMappings as any[]) : [];

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (!existingIds.includes(researchId)) {
        updates.researchIds = [...existingIds, researchId];
      }

      if (link.topicMatch) {
        const alreadyMapped = existingMappings.some((m) => m.researchId === researchId && m.topic === link.topicMatch!.topic);
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
        // Karşılanan "needed" konuyu zorunlu listeden ÇIKAR → araştırma eklendikçe liste kısalır (yakınsar)
        if (link.topicMatch.topicType === "needed") {
          const needed: string[] = Array.isArray(idea.neededResearchTopics) ? (idea.neededResearchTopics as string[]) : [];
          const mt = link.topicMatch.topic.trim().toLowerCase();
          const pruned = needed.filter((t) => String(t).trim().toLowerCase() !== mt);
          if (pruned.length !== needed.length) updates.neededResearchTopics = pruned;
        }
      }

      await db.update(ideasTable).set(updates).where(eq(ideasTable.id, link.ideaId));
    }

    if (links.length > 0) {
      const linked = links
        .map((l) => (l.topicMatch ? `#${l.ideaId}(→"${l.topicMatch.topic}")` : `#${l.ideaId}`))
        .join(", ");
      console.log(`[AutoLink] Research #${researchId} linked to ideas: ${linked}`);
    }
  } catch (err) {
    console.error("[AutoLink] Failed:", err);
  }
}
