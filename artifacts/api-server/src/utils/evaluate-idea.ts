import { db } from "@workspace/db";
import { ideasTable, researchTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai, GEMINI_MODELS } from "@workspace/integrations-gemini-ai";

export async function backgroundEvaluateIdea(
  ideaId: number,
  title: string,
  description: string,
  linkedResearchIds: number[] = [],
) {
  try {
    const allResearch = await db.select().from(researchTable);

    const linkedResearch = allResearch.filter(r => linkedResearchIds.includes(r.id));
    const linkedContext = linkedResearch.length > 0
      ? linkedResearch.map(r =>
          `[${r.title}]\nÖzet: ${r.summary ?? ''}\nBulgular: ${(r.findings ?? '').slice(0, 800)}`
        ).join("\n\n")
      : "(Bu fikre henüz araştırma bağlanmamış)";

    const evalPrompt = `Sen kurumsal inovasyon ekosistemi için bir değerlendirme ajanısın. Aşağıdaki fikri analiz et ve JSON döndür.

FİKİR:
Başlık: ${title}
Açıklama: ${description}

BU FİKRE BAĞLI ARAŞTIRMALAR (içeriklerini dikkate al):
${linkedContext}

Şu kurallara göre değerlendir:
1. Ticari Fizibilite (0-10): Gelir modeli, ölçeklenebilirlik, pazar büyüklüğü
2. Pazar İhtiyacı (0-10): Gerçek bir acı noktası mı çözüyor, pazar talebi var mı?
3. Teknik Zorluk (0-10): 10=çok kolay, 0=imkansız. Mevcut teknoloji ile yapılabilirlik
4. Trend Uyumu (0-10): 2025-2027 pazar ve teknoloji trendleriyle örtüşme
5. Risk & AI Yönetişimi (0-10): KVKK, veri gizliliği, etik AI kullanımı açısından risk düzeyi (10=risksiz)

ARAŞTIRMA KAPSAM DEĞERLENDİRMESİ — KRİTİK:
- neededResearchTopics: Fikrin hayata geçmesi için ZORUNLU ama yukarıdaki BAĞLI araştırmalarla HENÜZ KARŞILANMAYAN konular (max 5).
  Bağlı araştırmanın başlığı veya içeriği bir konuyu karşılıyorsa o konuyu bu listeye YAZMA.
  Tüm zorunlu konular bağlı araştırmalarla karşılanmışsa boş liste döndür: []
  Bağlı araştırma yoksa fikrin gerektirdiği tüm zorunlu konuları listele.
- optionalResearchTopics: Zorunlu olmayan ama fikri güçlendirecek opsiyonel konular (max 3)
- pivotSuggestion: Herhangi bir eksen <6 ise fikri kurtaracak SOMUT bir pivot önerisi (yoksa null)
- summary: 2-3 cümlelik özet değerlendirme
- usageFlow: Ürünün UÇTAN UCA kullanım/işleyiş akışını anlatan 5-7 ANLAMLI aşama. Her aşama bu fikre ÖZGÜ, kısa bir AŞAMA BAŞLIĞI olsun (isim öbeği, 2-6 kelime), mantıksal sırayla, kullanıcı/ürün gözünden (düşük seviye teknik mimari DEĞİL). Jenerik "Kullanıcı kaydolur" gibi değil; alana özgü yaz. Son aşama çıktı/onay/sonuç olsun. Örnek tarz (işe alım için): ["İlan Oluşturma", "Aday Başvurusu & CV Yükleme", "Otonom CV Analizi", "Eşleştirme & Ön Eleme", "AI Mülakat", "Raporlama & Yanlılık Denetimi", "Nihai Onay"].

JSON formatı (SADECE JSON döndür, başka metin yok):
{
  "commercialFeasibility": 7,
  "marketNeed": 8,
  "technicalDifficulty": 6,
  "trendAlignment": 9,
  "riskGovernance": 7,
  "neededResearchTopics": [],
  "optionalResearchTopics": ["opsiyonel konu1"],
  "pivotSuggestion": null,
  "summary": "Değerlendirme özeti...",
  "usageFlow": ["İlan Oluşturma", "Aday Başvurusu & CV Yükleme", "Otonom CV Analizi", "Eşleştirme & Ön Eleme", "AI Mülakat", "Nihai Onay"]
}`;

    const res = await ai.models.generateContent({
      model: GEMINI_MODELS.analysis,
      contents: [{ role: "user", parts: [{ text: evalPrompt }] }],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Strip markdown code fences if present
    const rawText = res.text?.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") ?? "";
    const match = rawText.match(/\{[\s\S]*\}/);
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
      usageFlow?: string[];
    };

    await db
      .update(ideasTable)
      .set({
        neededResearchTopics: eval_.neededResearchTopics || [],
        optionalResearchTopics: eval_.optionalResearchTopics || [],
        // Kullanım akışı adımları — fikrin "Kullanım Akışı" görselini besler (roadmap alanında saklanır)
        roadmap: Array.isArray(eval_.usageFlow) ? eval_.usageFlow : [],
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
  } catch (_) { /* non-blocking — silently ignore */ }
}
