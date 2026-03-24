import { Router } from "express";
import { db } from "@workspace/db";
import { researchTable, ideasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

// POST /api/validate-connection
// Body: { researchId: number, ideaId: number }
// Returns: { valid: boolean, confidence: number, reason: string }
router.post("/", async (req, res) => {
  try {
    const { researchId, ideaId } = req.body;

    if (!researchId || !ideaId) {
      return res.status(400).json({ error: "researchId ve ideaId gereklidir" });
    }

    const [research] = await db.select().from(researchTable).where(eq(researchTable.id, researchId));
    const [idea] = await db.select().from(ideasTable).where(eq(ideasTable.id, ideaId));

    if (!research || !idea) {
      return res.status(404).json({ error: "Araştırma veya fikir bulunamadı" });
    }

    const prompt = `Sen bir inovasyon ekosistemi uzmanısın. Verilen araştırma ile fikrin anlamlı bir bağlantısı olup olmadığını değerlendir.

ARAŞTIRMA:
Başlık: ${research.title}
Özet: ${research.summary || ''}
Etiketler: ${(research.tags || []).join(', ')}

FİKİR:
Başlık: ${idea.title}
Açıklama: ${idea.description || ''}
Etiketler: ${(idea.tags || []).join(', ')}

Bu araştırma ve fikrin bağlantılı olması için kriterler:
- Konu bütünlüğü (aynı alan, teknoloji veya sorun alanı)
- Araştırmanın fikri destekleyip desteklemediği
- Fikirden araştırmanın ortaya çıkıp çıkmadığı
- Ortak anahtar kavramlar

YALNIZCA aşağıdaki JSON formatında yanıt ver:
{"valid": true/false, "confidence": 0-100, "reason": "kısa Türkçe açıklama (max 100 karakter)"}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 256 },
    });

    const text = result.text?.trim() ?? '';
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      // Fallback if AI fails to return JSON
      return res.json({ valid: true, confidence: 50, reason: "AI değerlendirmesi alınamadı, bağlantıya izin verildi." });
    }

    const parsed = JSON.parse(match[0]);
    return res.json({
      valid: Boolean(parsed.valid),
      confidence: Number(parsed.confidence) || 50,
      reason: String(parsed.reason || ''),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to validate connection");
    // On error, allow the connection (fail open)
    res.json({ valid: true, confidence: 50, reason: "Doğrulama servisi geçici olarak kullanılamıyor." });
  }
});

export default router;
