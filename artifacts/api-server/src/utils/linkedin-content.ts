import { ai, GEMINI_MODELS } from "@workspace/integrations-gemini-ai";

/* ════════════════════════════════════════════════════════════════════════
   LinkedIn içerik üretici — fikir/proje/araştırmadan, GERÇEK veriye dayalı,
   "insan yazmış gibi" LinkedIn gönderisi üretir. Çoklu açı + hook varyantları
   + hashtag + ilk-yorum metni. Dil: Türkçe. (CEO planı: docs/designs/linkedin-share-kit.md)
   ════════════════════════════════════════════════════════════════════════ */

export type LinkedInAngle = "founder" | "problem" | "research";

export interface LinkedInContentInput {
  kind: "research" | "idea" | "project";
  title: string;
  summary: string;
  category?: string | null;
  tags?: string[];
  /** Gönderide atıf yapılacak somut gerçekler (skorlar, bulgular, akış adımları) */
  facts?: string[];
  angle: LinkedInAngle;
  /** 0 = daha kişisel/sıcak · 100 = daha analitik/veri-odaklı */
  tone: number;
}

export interface LinkedInContentResult {
  post: string;
  hooks: string[];
  hashtags: string[];
  firstComment: string;
  angle: LinkedInAngle;
}

const ANGLE_TR: Record<LinkedInAngle, string> = {
  founder:
    "Kurucu/insan hikâyesi — birinci tekil, kişisel motivasyon, 'bunu neden yaptık / beni ne harekete geçirdi' anlatısı.",
  problem:
    "Problem→çözüm — sektördeki gerçek bir acıyı net koy, sonra bu fikrin/araştırmanın onu nasıl çözdüğünü anlat.",
  research:
    "Araştırmanın arkası — bulguları ve öğrenmeleri merak uyandıracak şekilde paylaş; 'şunu fark ettik' tonu.",
};

const KIND_TR: Record<LinkedInContentInput["kind"], string> = {
  research: "araştırma",
  idea: "fikir",
  project: "proje",
};

/** Tek senkron Gemini çağrısı → düzenlenebilir gönderi + hook'lar + hashtag + ilk-yorum. */
export async function generateLinkedInContent(
  input: LinkedInContentInput,
): Promise<LinkedInContentResult | null> {
  const toneDesc =
    input.tone <= 33
      ? "daha kişisel, sıcak, anekdotlu"
      : input.tone >= 67
        ? "daha analitik, veri-odaklı, net"
        : "kişisel ve analitik arası dengeli";

  const facts = (input.facts ?? [])
    .filter(Boolean)
    .slice(0, 8)
    .map((f) => `- ${f}`)
    .join("\n");

  const prompt = `Sen think-Inn (AI inovasyon ekosistemi) için yazan, deneyimli bir kurumsal inovasyon lideri ve içerik yazarısın. LinkedIn için, İNSAN TARAFINDAN YAZILDIĞI BELLİ OLAN, özgün bir uzun-form gönderi yaz. Dil: TÜRKÇE.

KONU (${KIND_TR[input.kind]}): ${input.title}
Özet: ${input.summary?.slice(0, 800) || "(yok)"}
${input.category ? `Kategori: ${input.category}\n` : ""}${input.tags?.length ? `Etiketler: ${input.tags.join(", ")}\n` : ""}${facts ? `Somut gerçekler (gönderide EN AZ 2'sine spesifik atıfta bulun):\n${facts}\n` : ""}
AÇI: ${ANGLE_TR[input.angle]}
TON: ${toneDesc}

İNSAN SESİ RUBRİĞİ (zorunlu):
- Birinci tekil/çoğul ("ben/biz"), gerçek bir kişi anlatıyormuş gibi; bir görüş/duruş içersin.
- AÇILIŞTA klişe YASAK: "Günümüz dünyasında", "Teknolojinin hızla geliştiği çağda", "X, Y'den çok daha fazlasıdır", "Hepimiz biliyoruz ki" gibi kalıpları KULLANMA.
- Yukarıdaki somut gerçeklerden EN AZ 2'sine atıf yap (sayı, bulgu veya akış adımı).
- Kısa paragraflar, doğal ritim. Aşırı simetrik madde listesi YOK (en fazla bir kısa liste).
- Emoji minimal (0-2). Gövdeye hashtag serpiştirme.
- Uzunluk: 900-1500 karakter.
- Gönderinin İÇİNE dış link KOYMA (link ilk yoruma gidecek).

SADECE şu JSON'u döndür (başka metin yok):
{
  "post": "gönderi metni; satır araları \\n ile",
  "hooks": ["3-4 alternatif AÇILIŞ cümlesi — feed'de görünen ilk satır; merak/çarpıcılık yüksek"],
  "hashtags": ["5 alakalı hashtag, # ile (TR/EN karışık olabilir)"],
  "firstComment": "ilk yoruma konacak kısa metin: 1 çağrı cümlesi + {{LINK}} yer tutucusu"
}`;

  let raw = "";
  try {
    const r = await ai.models.generateContent({
      model: GEMINI_MODELS.analysis,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 2048, responseMimeType: "application/json" } as any,
    });
    raw = r.text?.trim() || "";
  } catch (e) {
    console.error("[LinkedIn] Gemini call failed:", (e as Error).message);
    return null;
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* yoksay */
      }
    }
  }

  if (!parsed || typeof parsed.post !== "string" || !parsed.post.trim()) {
    console.warn("[LinkedIn] invalid/empty generation result");
    return null;
  }

  return {
    post: String(parsed.post).trim(),
    hooks: Array.isArray(parsed.hooks) ? parsed.hooks.filter((h: unknown) => typeof h === "string").slice(0, 4) : [],
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((h: unknown) => typeof h === "string").map((h: string) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 6)
      : [],
    firstComment: typeof parsed.firstComment === "string" ? parsed.firstComment : "Detaylar yorumda 👇 {{LINK}}",
    angle: input.angle,
  };
}
