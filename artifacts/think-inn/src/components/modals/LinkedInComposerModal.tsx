import { useState } from "react";
import { motion } from "framer-motion";
import { Linkedin, Sparkles, Copy, Check, RefreshCw, X, Loader2, MessageSquare } from "lucide-react";
import { API_ORIGIN } from "@/lib/api-config";

/* ════════════════════════════════════════════════════════════════════════
   LinkedInComposerModal — fikir/proje/araştırmadan "insan sesiyle" LinkedIn
   gönderisi üretir. Çoklu açı + ton + hook varyantları + hashtag + ilk-yorum.
   AI taslağı; yayınlamadan önce kullanıcı düzenler (auto-publish YOK).
   ════════════════════════════════════════════════════════════════════════ */

type Angle = "founder" | "problem" | "research";

const ANGLES: Array<{ id: Angle; label: string; desc: string }> = [
  { id: "founder", label: "Kurucu Hikâyesi", desc: "Kişisel, birinci tekil" },
  { id: "problem", label: "Problem → Çözüm", desc: "Acıyı koy, çözümü anlat" },
  { id: "research", label: "Araştırmanın Arkası", desc: "Bulgular, öğrenmeler" },
];

interface Result {
  post: string;
  hooks: string[];
  hashtags: string[];
  firstComment: string;
  angle: Angle;
}

export default function LinkedInComposerModal({
  kind,
  id,
  title,
  defaultAngle = "problem",
  shareLink,
  onClose,
}: {
  kind: "idea" | "research";
  id: number;
  title: string;
  defaultAngle?: Angle;
  /** İlk yoruma konacak kanonik derin link (yoksa mevcut sayfa linki kullanılır) */
  shareLink?: string;
  onClose: () => void;
}) {
  const [angle, setAngle] = useState<Angle>(defaultAngle);
  const [tone, setTone] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [post, setPost] = useState("");
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const shareUrl = shareLink || (typeof window !== "undefined" ? window.location.href : "");
  const base = kind === "research" ? "research" : "ideas";

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_ORIGIN}/api/${base}/${id}/generate-linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ angle, tone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "İçerik üretilemedi");
      const r = json as Result;
      setResult(r);
      setPost(r.post);
      setComment((r.firstComment || "").replace("{{LINK}}", shareUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* yoksay */
    }
  };

  // Hook seçilince gönderinin ilk satırını onunla değiştir
  const applyHook = (hook: string) => {
    setPost((p) => {
      const rest = p.split("\n").slice(1).join("\n");
      return rest.trim() ? `${hook}\n${rest}` : hook + (p.includes("\n") ? "\n" + rest : "");
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(7,27,58,0.40)" }} onClick={onClose} />
      <motion.div
        className="relative z-10 flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white"
        style={{ width: "100%", maxWidth: 600, boxShadow: "0 28px 80px rgba(7,27,58,0.22)" }}
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(20,99,243,0.10)", color: "#0A66C2" }}>
              <Linkedin size={17} />
            </span>
            <div>
              <div className="font-heading text-[15px] font-bold text-on-surface">LinkedIn İçeriği Üret</div>
              <div className="max-w-[420px] truncate text-[12px] text-on-surface-variant">{title}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant transition-colors hover:text-on-surface"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Açı seçimi */}
          <div className="overline mb-2">Açı</div>
          <div className="grid grid-cols-3 gap-2">
            {ANGLES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAngle(a.id)}
                className={"rounded-xl border px-3 py-2.5 text-left transition-all " + (angle === a.id ? "border-primary bg-primary/[0.06]" : "border-outline-variant bg-white hover:border-outline-strong")}
              >
                <div className={"text-[12.5px] font-bold " + (angle === a.id ? "text-primary" : "text-on-surface")}>{a.label}</div>
                <div className="mt-0.5 text-[10.5px] leading-tight text-on-surface-variant">{a.desc}</div>
              </button>
            ))}
          </div>

          {/* Ton */}
          <div className="mt-4 flex items-center justify-between">
            <span className="overline">Ton</span>
            <span className="text-[11px] font-semibold text-on-surface-variant">{tone <= 33 ? "Kişisel" : tone >= 67 ? "Analitik" : "Dengeli"}</span>
          </div>
          <input type="range" min={0} max={100} value={tone} onChange={(e) => setTone(Number(e.target.value))} className="mt-1.5 w-full accent-primary" />
          <div className="flex justify-between text-[10px] text-on-surface-variant"><span>Kişisel · sıcak</span><span>Analitik · veri</span></div>

          {/* Üret butonu */}
          <button
            onClick={generate}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.28)] transition-all hover:bg-[#0e54d8] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : result ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            {loading ? "Üretiliyor…" : result ? "Yeniden Üret" : "İçerik Üret"}
          </button>

          {error && <p className="mt-3 rounded-lg bg-error/[0.06] px-3 py-2 text-[12.5px] text-error">{error}</p>}

          {result && (
            <div className="mt-5 space-y-4">
              {/* Hook'lar */}
              {result.hooks.length > 0 && (
                <div>
                  <div className="overline mb-1.5">Açılış (hook) — feed'de görünen ilk satır</div>
                  <div className="flex flex-col gap-1.5">
                    {result.hooks.map((h, i) => (
                      <button key={i} onClick={() => applyHook(h)} title="Gönderinin ilk satırına uygula" className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-left text-[12.5px] text-on-surface transition-all hover:border-primary/40 hover:bg-primary/[0.04]">
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gönderi (düzenlenebilir) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="overline">Gönderi metni — yayınlamadan önce kendi sesinle düzenle</span>
                  <button onClick={() => copy(post, "post")} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                    {copied === "post" ? <Check size={12} /> : <Copy size={12} />}{copied === "post" ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <textarea
                  value={post}
                  onChange={(e) => setPost(e.target.value)}
                  rows={12}
                  className="w-full resize-y rounded-xl border border-outline-variant bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                />
                <div className="mt-1 text-right text-[10.5px] text-on-surface-variant">{post.length} karakter</div>
              </div>

              {/* Hashtag */}
              {result.hashtags.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="overline">Hashtag</span>
                    <button onClick={() => copy(result.hashtags.join(" "), "tags")} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                      {copied === "tags" ? <Check size={12} /> : <Copy size={12} />}{copied === "tags" ? "Kopyalandı" : "Kopyala"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.hashtags.map((t) => <span key={t} className="rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11.5px] font-semibold text-primary">{t}</span>)}
                  </div>
                </div>
              )}

              {/* İlk yorum */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="overline flex items-center gap-1.5"><MessageSquare size={12} />İlk Yorum (linki buraya koy — erişim için)</span>
                  <button onClick={() => copy(comment, "comment")} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                    {copied === "comment" ? <Check size={12} /> : <Copy size={12} />}{copied === "comment" ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 text-[12.5px] text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                />
                <p className="mt-1 text-[10.5px] text-on-surface-variant">Link, içeriğin kanonik public sayfasına gider. LinkedIn'de gönderinin gövdesine değil, bu ilk yoruma koy (erişim için).</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="flex items-center gap-2 border-t border-outline-variant px-6 py-3.5">
            <button onClick={() => copy(post, "post2")} className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-background">
              {copied === "post2" ? <Check size={14} /> : <Copy size={14} />}Gönderiyi Kopyala
            </button>
            <button
              onClick={async () => { await copy(post, "post2"); window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "noopener"); }}
              className="ml-auto flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "#0A66C2" }}
            >
              <Linkedin size={15} />Kopyala & LinkedIn'i Aç
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
