/**
 * Gemini model registry — tek noktadan tüm model isimlerini yönet.
 *
 * Bu sabitleri değiştirmek tüm uygulamayı yeni modele geçirir; ayrı ayrı
 * route dosyalarına dokunmaya gerek yok.
 *
 * Mayıs 2026 itibarıyla aktif stabil modeller (Google Gemini):
 *   - gemini-3.5-flash         → "Most intelligent" — chat + JSON için ideal
 *   - gemini-3.1-flash-lite    → Frontier-class hız/maliyet dengesi
 *   - gemini-2.5-flash         → Eski stabil
 *   - gemini-2.5-pro           → Eski stabil, üst seviye
 *   - gemini-2.5-flash-image   → Görsel üretimi (Imagen değil, çok-modlu)
 *
 * Override için `process.env.GEMINI_CHAT_MODEL` vb. ortam değişkenleri okunabilir.
 */

export const GEMINI_MODELS = {
  /** Genel sohbet, akış, JSON çıktı, fonksiyon çağrımı — varsayılan asistan */
  chat: process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash",
  /** Yapılandırılmış analiz (idea/research evaluate) — tutarlılık için JSON modu */
  analysis: process.env.GEMINI_ANALYSIS_MODEL || "gemini-3.5-flash",
  /** Hızlı/ucuz arka plan görevleri (validate, küçük format çağrıları) */
  fast: process.env.GEMINI_FAST_MODEL || "gemini-3.1-flash-lite",
  /** Görsel üretimi (cover image) — image modeli */
  image: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
} as const;

export type GeminiModelKey = keyof typeof GEMINI_MODELS;
