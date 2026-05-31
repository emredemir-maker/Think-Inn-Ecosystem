/* ════════════════════════════════════════════════════════════════════════
   Vercel serverless function — LinkedIn/sosyal crawler'lara per-entity Open Graph.
   vercel.json'daki bot-koşullu rewrite'lar /r|p|i/:id'yi (yalnız crawler UA'sı için)
   buraya yönlendirir. İnsanlar catch-all ile SPA'yı (index.html) alır; bu function
   yalnız bot'lar için çalışır. Yanıt = OG meta'lı minimal HTML.
   Güvenlik: yalnız public-safe alanlar (başlık, özet, kapak) meta'ya konur.
   ════════════════════════════════════════════════════════════════════════ */

// Vercel Node runtime global'leri (build context'inde @types/node yok) — globalThis üzerinden eriş
const API = ((globalThis as any).process?.env?.API_ORIGIN as string) || "https://think-inn-api.fly.dev";
const _fetch = (globalThis as any).fetch as (input: string, init?: any) => Promise<any>;

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default async function handler(req: any, res: any) {
  const type = String(req.query?.type || "");           // research | project | idea
  const id = String(req.query?.id || "").replace(/\D/g, "");
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "think-inn.vercel.app";
  const site = `https://${host}`;

  const prefix = type === "research" ? "r" : type === "project" ? "p" : "i";
  const apiPath = type === "research" ? "research" : "ideas";
  const ogUrl = `${site}/${prefix}/${id}`;

  let title = "think-Inn — AI Innovation Ecosystem";
  let desc = "Fikirleri, araştırmaları ve projeleri yapay zekâ ile birbirine bağlayan inovasyon ekosistemi.";
  let image = `${site}/og-default.svg`;

  if (id) {
    try {
      const r = await _fetch(`${API}/api/${apiPath}/${id}`, { headers: { accept: "application/json" } });
      if (r.ok) {
        const e: any = await r.json();
        if (e?.title) title = `${e.title} · think-Inn`;
        const summary = e?.summary || e?.description || "";
        // Markdown işaretlerini temizle → LinkedIn önizlemesinde düz, okunur açıklama
        if (summary) desc = String(summary)
          .replace(/```[\s\S]*?```/g, " ")
          .replace(/^\s{0,3}#{1,6}\s+/gm, "")
          .replace(/(\*\*|__|\*|_|`|~~|>)/g, "")
          .replace(/-{3,}/g, " ")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 200);
        // Kapak yalnız araştırmada mevcut (Fly cover endpoint); yoksa marka fallback
        if (type === "research" && (e?.hasCoverImage || e?.coverImageB64)) {
          image = `${API}/api/research/${id}/cover`;
        }
      }
    } catch {
      /* fallback meta kullanılır */
    }
  }

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="think-Inn"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${esc(image)}"/>
<meta property="og:url" content="${esc(ogUrl)}"/>
<meta property="og:locale" content="tr_TR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${esc(image)}"/>
<link rel="canonical" href="${esc(ogUrl)}"/>
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<p><a href="${esc(ogUrl)}">think-Inn'de aç</a></p>
</body>
</html>`;

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=300, s-maxage=600");
  res.status(200).send(html);
}
