import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStream } from "@/hooks/use-chat-stream";
import {
  useCreateGeminiConversation,
  useListGeminiConversations,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_ORIGIN } from "@/lib/api-config";
import { SECTION_LABEL, type AssistantContext, type ReviseSection } from "@/lib/assistant";

/* Material Symbols ikon */
function Icon({
  name,
  size = 18,
  filled = false,
  className = "",
}: {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Bağlam-farkında revize paneli — "AI ile Revize Et" / "Düzenle" ile açılır.
   Asistan hangi öğeyi/bölümü revize ettiğini bilir, yönlendirici soru sorar,
   öneri çipleri verir; düzenlemeyi doğru endpoint'e yapıp kartı tazeler.
   ════════════════════════════════════════════════════════════════════════ */

// Bölüme özel yönlendirme soruları
const REVISE_QUESTION: Partial<Record<ReviseSection, string>> = {
  functional: "Fonksiyonel analizi nasıl revize edelim? Neyi değiştireyim, neyi ekleyeyim?",
  technical: "Teknik analizi hangi yönde güncelleyeyim?",
  architecturalPlan: "Mimari planı nasıl iyileştireyim?",
  all: "Tüm projeyi bağlı fikir ve araştırmalara göre yenileyeceğim. Özel bir yönlendirmen var mı? (boş bırakabilirsin)",
  flow: "Sistem mimarisi akış şemasını yeniden üreteceğim. Eklemek istediğin bir not var mı? (opsiyonel)",
};
// Bölüme özel öneri çipleri (tıkla → metin alanını doldurur)
const REVISE_SUGGESTIONS: Partial<Record<ReviseSection, string[]>> = {
  functional: [
    "Kullanıcı senaryolarını detaylandır",
    "Kabul kriterlerini netleştir",
    "Eksik fonksiyonel gereksinimleri ekle",
    "KVKK / uyum gereksinimlerini ekle",
  ],
  technical: [
    "Teknoloji yığınını güncelle ve gerekçelendir",
    "Ölçeklenebilirlik stratejisini güçlendir",
    "Güvenlik mimarisini genişlet",
    "Performans hedefleri ve metrikleri ekle",
  ],
  architecturalPlan: [
    "Veri akışını adım adım netleştir",
    "Deployment stratejisini ekle",
    "Bileşen sorumluluklarını ayrıştır",
    "Harici entegrasyon noktalarını belirt",
  ],
  all: [
    "Bağlı araştırma bulgularını analize işle",
    "Daha gerçekçi ve uygulanabilir yap",
    "Kurumsal ölçeğe göre yeniden kurgula",
  ],
  flow: [],
};

// "Proje" bağlamında önce bölüm seçtir
const PICK_SECTIONS: { key: ReviseSection; icon: string; desc: string }[] = [
  { key: "functional", icon: "fact_check", desc: "Özellikler, senaryolar, gereksinimler" },
  { key: "technical", icon: "memory", desc: "Teknoloji yığını, güvenlik, ölçek" },
  { key: "architecturalPlan", icon: "account_tree", desc: "Katmanlar, veri akışı, deployment" },
  { key: "flow", icon: "schema", desc: "Sistem mimarisi akış şeması" },
  { key: "all", icon: "auto_awesome", desc: "Bağlı fikir + araştırmalara göre tümünü yenile" },
];

function GuidedRevise({ ctx, onDismiss }: { ctx: AssistantContext; onDismiss: () => void }) {
  const qc = useQueryClient();
  const [section, setSection] = useState<ReviseSection>(ctx.section);
  const [guidance, setGuidance] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "started" | "error">("idle");
  const [result, setResult] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Bağlam değişince paneli sıfırla
  useEffect(() => {
    setSection(ctx.section); setGuidance(""); setStatus("idle"); setResult(""); setErr(null);
  }, [ctx.entityId, ctx.section]);

  const needsPick = section === "project";
  const isSync = section === "functional" || section === "technical" || section === "architecturalPlan";
  const optionalGuidance = section === "all" || section === "flow";

  const run = async () => {
    setErr(null);
    if (isSync && !guidance.trim()) { setErr("Önce nasıl revize edeceğimi yaz."); return; }
    setStatus("working");
    try {
      if (isSync) {
        const res = await fetch(`${API_ORIGIN}/api/ideas/${ctx.entityId}/revise-analysis`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ section, guidance: guidance.trim() }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Revizyon başarısız");
        setResult(j.content || "");
        setStatus("done");
        qc.invalidateQueries({ queryKey: ["/api/ideas"] });
      } else {
        const res = await fetch(`${API_ORIGIN}/api/ideas/${ctx.entityId}/regenerate-analysis`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ scope: section, guidance: guidance.trim() || undefined }),
        });
        if (!res.ok) throw new Error("Yenileme başlatılamadı");
        setStatus("started");
        // Üretim arka planda; kartı birkaç kez tazele ki bitince güncellensin
        let n = 0;
        const iv = setInterval(() => { qc.invalidateQueries({ queryKey: ["/api/ideas"] }); if (++n >= 25) clearInterval(iv); }, 4000);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Bir hata oluştu"); setStatus("error");
    }
  };

  const sectionLabel = SECTION_LABEL[section];

  return (
    <div className="rounded-[16px] border border-secondary/25 bg-gradient-to-b from-secondary/[0.06] to-transparent p-3.5">
      {/* Bağlam çipi */}
      <div className="mb-3 flex items-center gap-2">
        <div className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
          <Icon name="auto_fix_high" size={15} filled />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-secondary">AI ile düzenleme</div>
          <div className="truncate text-[13px] font-bold text-on-surface">
            {ctx.entityTitle}
            {!needsPick && <span className="font-medium text-on-surface-variant"> · {sectionLabel}</span>}
          </div>
        </div>
        <button onClick={onDismiss} title="Kapat" className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-background">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Adım: bölüm seç (proje "Düzenle") */}
      {needsPick && status === "idle" && (
        <>
          <p className="mb-2.5 text-[13px] leading-relaxed text-on-surface">
            <span className="font-semibold">{ctx.entityTitle}</span> projesinde neyi düzenleyelim? Bir bölüm seç:
          </p>
          <div className="space-y-1.5">
            {PICK_SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className="flex w-full items-center gap-2.5 rounded-[11px] border border-outline-variant bg-white p-2.5 text-left transition-all hover:border-secondary/40 hover:bg-secondary/[0.05]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/[0.1] text-secondary">
                  <Icon name={s.icon} size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight text-on-surface">{SECTION_LABEL[s.key]}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-on-surface-variant">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Adım: yönlendirme gir (bölüm seçili) */}
      {!needsPick && (status === "idle" || status === "error") && (
        <>
          {ctx.section === "project" && (
            <button onClick={() => setSection("project")} className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-secondary hover:underline">
              <Icon name="arrow_back" size={13} /> Bölüm değiştir
            </button>
          )}
          <p className="mb-2.5 text-[13px] leading-relaxed text-on-surface">{REVISE_QUESTION[section]}</p>

          {(REVISE_SUGGESTIONS[section] ?? []).length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {(REVISE_SUGGESTIONS[section] ?? []).map((s) => (
                <button
                  key={s}
                  onClick={() => { setGuidance((g) => (g.trim() ? g.trim() + "; " + s : s)); setTimeout(() => taRef.current?.focus(), 0); }}
                  className="rounded-full border border-secondary/30 bg-secondary/[0.07] px-2.5 py-1 text-[11.5px] font-medium text-secondary transition-all hover:bg-secondary/[0.14]"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={taRef}
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            rows={3}
            autoFocus
            placeholder={optionalGuidance ? "Opsiyonel yönlendirme… (boş bırakıp doğrudan yenileyebilirsin)" : "Örn: güvenlik bölümünü KVKK odaklı genişlet, ölçeklenebilirlik varsayımını gerçekçi yap…"}
            className="w-full resize-none rounded-[11px] border border-outline-variant bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-secondary/50 focus:ring-2 focus:ring-secondary/15"
          />
          {err && <p className="mt-1.5 text-[12px] text-error">{err}</p>}
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={run}
              disabled={isSync && !guidance.trim()}
              className="flex items-center gap-1.5 rounded-[11px] bg-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-all hover:bg-[#0e54d8] disabled:opacity-50"
            >
              <Icon name="auto_awesome" size={14} filled />
              {optionalGuidance ? "Yenile" : "Revize Et"}
            </button>
            <button onClick={onDismiss} className="rounded-[11px] px-3 py-2 text-[12.5px] font-semibold text-on-surface-variant hover:bg-background">İptal</button>
          </div>
        </>
      )}

      {/* Çalışıyor */}
      {status === "working" && (
        <div className="flex items-center gap-2.5 py-2 text-[13px] font-semibold text-primary">
          <Icon name="progress_activity" size={18} className="animate-spin" />
          {isSync ? `${sectionLabel} revize ediliyor…` : `${sectionLabel} yenileniyor…`}
        </div>
      )}

      {/* Senkron revizyon bitti — önizleme + kartta güncel */}
      {status === "done" && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#157A3A]">
            <Icon name="check_circle" size={16} filled /> {sectionLabel} güncellendi — kartta yenilendi.
          </div>
          {result && (
            <div className="max-h-[220px] overflow-y-auto rounded-[11px] border border-outline-variant bg-white px-3 py-2.5 text-[12.5px] leading-relaxed text-on-surface custom-scrollbar
              prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-on-surface prose-p:my-1 prose-strong:text-on-surface prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.slice(0, 1400)}</ReactMarkdown>
            </div>
          )}
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => { setStatus("idle"); setResult(""); setGuidance(""); }} className="flex items-center gap-1.5 rounded-[11px] border border-secondary/30 bg-secondary/[0.07] px-3 py-1.5 text-[12px] font-semibold text-secondary hover:bg-secondary/[0.14]">
              <Icon name="redo" size={13} /> Tekrar revize et
            </button>
            <button onClick={onDismiss} className="rounded-[11px] bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0e54d8]">Bitir</button>
          </div>
        </div>
      )}

      {/* Async yenileme başladı */}
      {status === "started" && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[#157A3A]">
            <Icon name="check_circle" size={16} filled /> {sectionLabel} yenileniyor.
          </div>
          <p className="text-[12.5px] leading-relaxed text-on-surface-variant">
            Üretim arka planda sürüyor; sonuç birkaç dakika içinde proje kartında otomatik güncellenecek.
          </p>
          <div className="mt-2.5">
            <button onClick={onDismiss} className="rounded-[11px] bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0e54d8]">Bitir</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrchestratorChat({ reviseContext }: { reviseContext?: AssistantContext | null } = {}) {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  // Aktif revize bağlamı — prop'tan alınır; panelde "Bitir/İptal" ile temizlenir
  const [activeCtx, setActiveCtx] = useState<AssistantContext | null>(reviseContext ?? null);
  useEffect(() => { if (reviseContext) setActiveCtx(reviseContext); }, [reviseContext]);

  const { data: conversations, isLoading: isLoadingConvos } = useListGeminiConversations();
  const { mutateAsync: createConvo } = useCreateGeminiConversation();

  const { messages, sendMessage, isTyping, error } = useChatStream(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // İlk konuşmayı al veya yeni yarat
  useEffect(() => {
    if (conversations && !conversationId) {
      if (conversations.length > 0) {
        setConversationId(conversations[0].id);
      } else {
        createConvo({ data: { title: "Session " + new Date().getTime() } })
          .then((res) => setConversationId(res.id))
          .catch(console.error);
      }
    }
  }, [conversations, conversationId, createConvo]);

  // Yeni mesaj geldikçe aşağı kaydır
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  // Custom event listener — başka componentten mesaj gönderme
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail?.message;
      if (msg && conversationId && !isTyping) {
        sendMessage(msg);
      }
    };
    window.addEventListener("think-inn:send-message", handler);
    return () => window.removeEventListener("think-inn:send-message", handler);
  }, [conversationId, isTyping, sendMessage]);

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <aside className="flex h-full w-full flex-1 flex-col bg-surface-container-low">
      {/* ── Header (referans .cd-head) ──────────────────────────── */}
      <header className="shrink-0 border-b border-outline-variant bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-3">
          {/* ai-badge: brand gradient 38px */}
          <div className="brand-gradient flex h-[38px] w-[38px] items-center justify-center rounded-[12px] text-white shadow-[0_6px_16px_rgba(20,99,243,0.30)]">
            <Icon name="auto_awesome" size={18} filled />
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-[15px] font-bold leading-tight text-on-surface">
              İnovasyon Asistanı
            </h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#20C997] shadow-[0_0_8px_rgba(32,201,151,0.6)]" />
              <span className="text-[11px] font-semibold text-primary">Çevrimiçi · Gemini 3.5</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5 custom-scrollbar"
      >
        {/* Bağlam-farkında revize paneli — "AI ile Revize Et" / "Düzenle" ile açılır */}
        {activeCtx && <GuidedRevise ctx={activeCtx} onDismiss={() => setActiveCtx(null)} />}

        {!activeCtx && messages.length === 0 && (
          <div className="flex flex-col gap-4">
            {/* Karşılama balonu (referans seed mesajı) */}
            <div className="flex items-start gap-2.5">
              <div className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white">
                Ai
              </div>
              <div className="max-w-[78%] rounded-[14px] rounded-tl-[4px] border border-outline-variant bg-surface-container-low px-4 py-3 text-[13.5px] leading-relaxed text-on-surface">
                Merhaba! Ne yapalım? Araştırma yapıştırabilir, fikir anlatabilir veya ekosisteme soru
                sorabilirsin.
              </div>
            </div>

            {/* 4 hızlı-araç kartı (referans .cd-tools — 2 sütun) */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "research", icon: "menu_book", iconBg: "rgba(24,201,232,0.10)", iconColor: "#0A8FA8", t: "Araştırma yapıştır", d: "Metni yapıştır, AI başlık ve özet üretsin", starter: "" },
                { id: "idea", icon: "lightbulb", iconBg: "rgba(255,176,32,0.14)", iconColor: "#8A5A00", t: "Fikrini anlat", d: "Serbest yaz, yapılandırılmış karta dönsün", starter: "Bir fikrim var: " },
                { id: "ask", icon: "contact_support", iconBg: "rgba(122,92,255,0.10)", iconColor: "#5B3FE0", t: "Soru sor", d: "Ekosisteme dair her şeyi sorabilirsin", starter: "" },
                { id: "connect", icon: "hub", iconBg: "rgba(20,99,243,0.10)", iconColor: "#1463F3", t: "Bağlantı öner", d: "İki düğüm arasında ilişki kur", starter: "Şu iki öğe arasında bağlantı öner: " },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    // Gerçek kullanım: input'a başlangıç metni koy + odakla (otomatik göndermez)
                    setInput(tool.starter);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className="flex items-start gap-2.5 rounded-[12px] border border-outline-variant bg-surface-container-low p-3 text-left transition-all hover:border-primary/30 hover:bg-white hover:shadow-[0_4px_12px_rgba(7,27,58,0.05)]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: tool.iconBg, color: tool.iconColor }}
                  >
                    <Icon name={tool.icon} size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading text-[13px] font-semibold leading-tight text-on-surface">
                      {tool.t}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-on-surface-variant">{tool.d}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Rol etiketi */}
              <div
                className={`mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold ${
                  msg.role === "user" ? "flex-row-reverse text-outline" : "text-primary"
                }`}
              >
                {msg.role === "user" ? (
                  <>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-high">
                      <Icon name="person" size={12} className="text-on-surface-variant" />
                    </div>
                    <span>Siz</span>
                  </>
                ) : (
                  <>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-tertiary-fixed-dim to-primary">
                      <Icon name="smart_toy" size={12} className="text-white" filled />
                    </div>
                    <span>think-Inn AI</span>
                  </>
                )}
              </div>

              {/* Saved items — tıklanınca kart açılır (global event) */}
              {/* AI'ın sisteme eklediği kart(lar) — referans .cd-result preview-card */}
              {msg.role === "assistant" && msg.savedItems && msg.savedItems.length > 0 && (
                <div className="mb-2 ml-[42px] w-[78%] max-w-[78%] space-y-2">
                  {msg.savedItems.map((item) => (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[12px] border border-primary/20 bg-primary/[0.05] p-3.5"
                    >
                      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-primary">
                        <Icon name="auto_awesome" size={14} filled />
                        SİSTEME EKLENEN {item.type === "research" ? "ARAŞTIRMA" : "FİKİR"}
                      </div>
                      <div className="rounded-[10px] border border-outline-variant bg-white p-3">
                        <div className="flex items-start gap-2">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={
                              item.type === "research"
                                ? { background: "rgba(24,201,232,0.12)", color: "#0A8FA8" }
                                : { background: "rgba(20,99,243,0.10)", color: "#1463F3" }
                            }
                          >
                            <Icon name={item.type === "research" ? "menu_book" : "lightbulb"} size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-heading text-[14px] font-bold leading-snug text-on-surface">
                              {item.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#157A3A]">
                              <Icon name="check_circle" size={12} filled /> Sisteme eklendi
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("think-inn:open-card", {
                                detail: { type: item.type, id: item.id },
                              })
                            )
                          }
                          className="flex-1 rounded-[10px] bg-primary px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#0e54d8]"
                        >
                          Kartı Aç
                        </button>
                        <button
                          onClick={() =>
                            window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: item.type, id: item.id } }))
                          }
                          className="rounded-[10px] border border-outline-variant bg-white px-3.5 py-2 text-[12px] font-semibold text-on-surface-variant transition-colors hover:border-outline-strong hover:text-on-surface"
                        >
                          Düzenle
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Bubble */}
              <div
                className={[
                  "max-w-[92%] p-3.5 shadow-sm font-body-md text-body-sm",
                  msg.role === "user"
                    ? "bg-secondary text-on-secondary rounded-2xl chat-bubble-user"
                    : "bg-surface-container-lowest text-on-surface border border-outline-variant/40 ai-accent-border rounded-2xl chat-bubble-ai",
                ].join(" ")}
              >
                {msg.role === "assistant" ? (
                  <div>
                    {msg.isStreaming && msg.progressLabel && !msg.content && (
                      <div className="flex items-center gap-2 py-1 text-[12px] font-bold text-primary">
                        <Icon
                          name="refresh"
                          size={14}
                          className="animate-spin shrink-0"
                        />
                        <span>{msg.progressLabel}</span>
                      </div>
                    )}
                    <div
                      className="prose prose-sm max-w-none
                      prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-on-surface
                      prose-headings:font-bold prose-headings:text-on-surface
                      prose-strong:font-semibold prose-strong:text-on-surface
                      prose-ul:my-2 prose-li:my-0.5 prose-li:text-on-surface
                      prose-a:text-primary prose-code:text-primary prose-code:bg-primary-container/10 prose-code:rounded prose-code:px-1
                      prose-table:text-xs prose-th:bg-surface-container prose-th:p-2 prose-td:p-2"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content ||
                          (msg.isStreaming && !msg.progressLabel ? "..." : "")}
                      </ReactMarkdown>
                      {msg.isStreaming && msg.content && (
                        <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-middle" />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-body-md text-body-sm leading-relaxed">
                    {msg.content}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && messages.every((m) => !m.isStreaming) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-tertiary-fixed-dim to-primary">
              <Icon name="smart_toy" size={12} className="text-white" filled />
            </div>
            <div className="flex items-center gap-1 rounded-2xl chat-bubble-ai border border-outline-variant/40 bg-surface-container-lowest ai-accent-border px-4 py-3 shadow-sm">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                />
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-center font-body-sm text-body-sm text-error">
            {error}
          </div>
        )}
      </div>

      {/* ── Input bar (glass-card) ──────────────────────────────── */}
      <div className="shrink-0 border-t border-outline-variant/40 bg-surface-container-low p-3">
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-1 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
            >
              <Icon name="add_circle" size={20} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Yeni fikrini anlat..."
              rows={1}
              disabled={isTyping || isLoadingConvos}
              className="flex-1 resize-none border-none bg-transparent py-2 font-body-md text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-0 max-h-32"
            />

            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
            >
              <Icon name="mic" size={20} />
            </button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              type="submit"
              disabled={!input.trim() || isTyping || !conversationId}
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
                input.trim() && !isTyping && conversationId
                  ? "bg-primary text-on-primary hover:opacity-90 shadow-md"
                  : "bg-surface-container text-outline cursor-not-allowed",
              ].join(" ")}
            >
              {isTyping ? (
                <Icon name="progress_activity" size={18} className="animate-spin" />
              ) : (
                <Icon name="send" size={18} filled />
              )}
            </motion.button>
          </div>
          <p className="mt-1 px-2 text-[10px] text-outline">
            Shift+Enter yeni satır · Enter ile gönder
          </p>
        </form>
      </div>
    </aside>
  );
}
