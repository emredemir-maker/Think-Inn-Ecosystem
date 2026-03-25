import { db } from "@workspace/db";
import { ideasTable, researchTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

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
          `[${r.title}]\nÖzet: ${r.summary ?? ''}\nBulgular: ${(r.findings ?? '').slice(0, 400)}`
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
  Bağlı araştırmanın içeriği (özet + bulgular) bir konuyu gerçekten karşılıyorsa o konuyu bu listeye YAZMA.
  Bağlı araştırma yoksa fikrin gerektirdiği tüm zorunlu konuları listele.
- optionalResearchTopics: Zorunlu olmayan ama fikri güçlendirecek opsiyonel konular (max 3, bağlı araştırmalarla karşılanmayanlar)
- pivotSuggestion: Herhangi bir eksen <6 ise fikri kurtaracak SOMUT bir pivot önerisi (yoksa null)
- summary: 2-3 cümlelik özet değerlendirme

JSON formatı (SADECE JSON döndür, başka metin yok):
{
  "commercialFeasibility": 7,
  "marketNeed": 8,
  "technicalDifficulty": 6,
  "trendAlignment": 9,
  "riskGovernance": 7,
  "neededResearchTopics": ["henüz karşılanmayan konu1"],
  "optionalResearchTopics": ["opsiyonel konu1"],
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
