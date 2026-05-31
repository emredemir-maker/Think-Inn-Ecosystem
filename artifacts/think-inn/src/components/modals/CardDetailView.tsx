import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Link2, Users, TrendingUp, Star, Share2,
  GitMerge, Rocket, FileText, Sparkles, Cpu, LineChart, ShieldAlert, Map as MapIcon,
  Gauge, BarChart3, BookOpen, Lightbulb, Tags, Info, ExternalLink, Plus,
  Route, GitBranch, Activity, UserPlus, Check, PenLine, Banknote,
  CheckCircle2, AlertTriangle, Circle, Lock, FlaskConical, Loader2,
  ChevronDown, ChevronRight, RefreshCw, Workflow, MonitorPlay, ImagePlus, X, Linkedin,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useListIdeas, useListResearch, type Idea, type Research } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { API_ORIGIN } from "@/lib/api-config";
import { ManualLinkModal } from "./ManualLinkModal";
import { LinkIdeaToProjectModal } from "./LinkIdeaToProjectModal";
import LinkedInComposerModal from "./LinkedInComposerModal";
import AnalysisDoc from "./AnalysisDoc";
import FlowDiagram from "./FlowDiagram";
import UsageFlow from "./UsageFlow";
import { openAssistantRevise, type ReviseSection } from "@/lib/assistant";

// 5 eksenli fikir değerlendirme barları (Ticari/Pazar/Teknik/Trend/Risk)
const SCORE_AXES: { key: string; label: string }[] = [
  { key: "commercialFeasibility", label: "Ticari Fizibilite" },
  { key: "marketNeed", label: "Pazar İhtiyacı" },
  { key: "technicalDifficulty", label: "Teknik Uygulanabilirlik" },
  { key: "trendAlignment", label: "Trend Uyumu" },
  { key: "riskGovernance", label: "Risk & Yönetişim" },
];
const scoreColor = (s: number) => (s >= 7 ? "#20C997" : s >= 5 ? "#FFB020" : "#EF4444");

/* ─── Ortak yardımcılar ─────────────────────────────────────────────── */

// Görseli istemci tarafında küçült → JPEG base64 data URL (DB json'unda saklanır, ek altyapı yok)
async function downscaleImage(file: File, maxW = 1280, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const scale = Math.min(1, maxW / (img.width || maxW));
    const w = Math.max(1, Math.round((img.width || maxW) * scale));
    const h = Math.max(1, Math.round((img.height || maxW) * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Lede/önizleme için markdown işaretlerini temizle (---, #, *, ` vs. ham görünmesin)
function plainText(s?: string) {
  return (s || "").replace(/[`#*_>]/g, "").replace(/-{2,}/g, " ").replace(/\s+/g, " ").trim();
}

function md(content: string) {
  return (
    <div className="dp-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/* Türkçe göreli zaman ("2 hafta önce") */
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "bugün";
  if (d === 1) return "dün";
  if (d < 7) return `${d} gün önce`;
  if (d < 30) return `${Math.floor(d / 7)} hafta önce`;
  if (d < 365) return `${Math.floor(d / 30)} ay önce`;
  return `${Math.floor(d / 365)} yıl önce`;
}

function initials(name?: string): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

type EvalScores = {
  commercialFeasibility: number; marketNeed: number; technicalDifficulty: number;
  trendAlignment: number; riskGovernance: number; summary?: string; pivotSuggestion?: string;
};

function maturityOf(idea: Idea): number {
  const ev = (idea as any).evaluationScores as EvalScores | null;
  if (ev) {
    const avg = (ev.commercialFeasibility + ev.marketNeed + ev.technicalDifficulty + ev.trendAlignment + ev.riskGovernance) / 5;
    return Math.round(avg * 10);
  }
  const votes = idea.voteCount ?? 0;
  const rels = idea.relatedTo?.length ?? 0;
  const research = idea.researchIds?.length ?? 0;
  return Math.min(95, votes * 5 + rels * 10 + research * 10);
}

function tierLabel(m: number): string {
  return m >= 75 ? "Projeleştirmeye hazır" : m >= 50 ? "Olgunlaşıyor" : m >= 25 ? "Geliştiriliyor" : "Yeni";
}

function openCard(type: "research" | "idea", id: number, view?: "idea" | "project") {
  window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type, id, ...(view ? { view } : {}) } }));
}
function sendToChat(message: string) {
  window.dispatchEvent(new CustomEvent("think-inn:send-message", { detail: { message } }));
  window.dispatchEvent(new CustomEvent("think-inn:open-assistant"));
}

/* ─── Dış sarmalayıcı: veri çek, türü seç ───────────────────────────── */

export function CardDetailView({
  detail, onClose,
}: {
  detail: { type: "research" | "idea"; id: number; view?: "idea" | "project" };
  onClose: () => void;
}) {
  const { data: ideaList } = useListIdeas();
  const { data: researchList } = useListResearch();
  const ideas = ideaList ?? [];
  const researches = researchList ?? [];

  if (detail.type === "research") {
    const r = researches.find((x) => x.id === detail.id);
    if (!r) return <NotFound onClose={onClose} label="Araştırmalara dön" />;
    return <ResearchDetailView research={r} allIdeas={ideas} onClose={onClose} />;
  }

  const idea = ideas.find((x) => x.id === detail.id);
  if (!idea) return <NotFound onClose={onClose} label="Geri dön" />;

  // Yüz seçimi: Fikirler'den (view="idea") → her zaman fikir kartı (analiz olsa bile).
  // Projeler'den (view="project") → proje kartı (analiz varsa). İpucu yoksa: analiz varsa proje.
  const hasAnalysis = !!(idea as any).architecturalAnalysis;
  const asProject = detail.view === "idea" ? false : detail.view === "project" ? hasAnalysis : hasAnalysis;
  return asProject ? (
    <ProjectDetailView idea={idea} allResearch={researches} allIdeas={ideas} onClose={onClose} />
  ) : (
    <IdeaDetailView idea={idea} allResearch={researches} allIdeas={ideas} onClose={onClose} />
  );
}

function NotFound({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <div className="mx-auto max-w-[1280px] px-10 pt-7">
      <button className="dp-back" onClick={onClose}><ArrowLeft size={14} /> {label}</button>
      <div className="hub-empty mt-6">
        <div className="ico"><Info size={26} /></div>
        <div className="t">Kayıt yükleniyor…</div>
        <div className="p">İçerik bulunamadıysa listeden tekrar açmayı dene.</div>
      </div>
    </div>
  );
}

/* Katlanabilir analiz bölümü — uzun fonksiyonel/teknik analiz "proje kapağı altında" tutulur */
function CollapsibleSection({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="dp-section">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
      >
        <h3 style={{ margin: 0 }}>{icon}{title}</h3>
        {open ? <ChevronDown size={18} color="#64708B" /> : <ChevronRight size={18} color="#64708B" />}
      </button>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </section>
  );
}

/* Revize edilebilir analiz — AnalysisDoc + (admin) "AI ile Revize Et".
   Buton, bağlam-farkında AI asistanını açar (entity + bölüm); asistan yönlendirip
   /api/ideas/:id/revise-analysis çağırır ve sonucu kartta tazeler. */
function RevisableAnalysis({ ideaId, title, section, markdown, accent }: {
  ideaId: number; title: string; section: "functional" | "technical" | "architecturalPlan"; markdown?: string | null; accent: "blue" | "cyan" | "violet" | "mint";
}) {
  const { user } = useAuth();
  const isAdmin = !!user;
  return (
    <div>
      <AnalysisDoc markdown={markdown || ""} accent={accent} />
      {isAdmin && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => openAssistantRevise({ intent: "revise", entityType: "project", entityId: ideaId, entityTitle: title, section })}
            className="flex items-center gap-1.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] px-3 py-1.5 text-[12px] font-semibold text-secondary transition-all hover:bg-secondary/[0.14]"
          >
            <Sparkles size={13} />AI ile Revize Et
          </button>
        </div>
      )}
    </div>
  );
}

/* Bağlı içerik kartı — gerçek research/idea referanslarından */
function ConnectedItem({ kind, type, name, score, onClick }: {
  kind: "research" | "idea" | "project"; type: string; name: string; score: string; onClick: () => void;
}) {
  const Ic = kind === "research" ? BookOpen : kind === "project" ? Rocket : Lightbulb;
  return (
    <div className="connected-item" onClick={onClick}>
      <div className={"ico " + kind}><Ic size={16} /></div>
      <div className="meta">
        <div className="t">{type}</div>
        <div className="n">{name}</div>
      </div>
      <span className="score">{score}</span>
    </div>
  );
}

/* ════════════════════ FİKİR DETAY ════════════════════ */

function IdeaDetailView({ idea, allResearch, allIdeas, onClose }: {
  idea: Idea; allResearch: Research[]; allIdeas: Idea[]; onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = !!user;
  const [showLink, setShowLink] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const evalAtRef = useRef<any>(undefined);
  const queryClient = useQueryClient();

  const maturity = maturityOf(idea);
  const tier = tierLabel(maturity);
  const scores = (idea as any).evaluationScores as EvalScores | null;
  const usageSteps: string[] = (idea as any).roadmap ?? [];
  const evaluatedAt = (idea as any).evaluatedAt;
  const hasAnalysis = !!(idea as any).architecturalAnalysis; // projeye dönüşmüş mü?

  const researchIds: number[] = idea.researchIds ?? [];
  const relatedIds: number[] = (idea as any).relatedTo ?? [];
  const linkedResearch = researchIds.map((id) => allResearch.find((r) => r.id === id)).filter(Boolean) as Research[];
  const relatedIdeas = relatedIds.map((id) => allIdeas.find((i) => i.id === id)).filter(Boolean) as Idea[];
  const links = researchIds.length + relatedIds.length;
  const contributors = idea.collaborators?.length ?? 0;

  // Projelendirme için gerekli araştırmalar (gerçek alanlar).
  // Bağlı araştırmaların KARŞILADIĞI "needed" konuları çıkar — böylece araştırma ekledikçe liste kısalır.
  const coveredNeeded = new Set(
    (((idea as any).researchTopicMappings as Array<{ topic: string; topicType: string }>) ?? [])
      .filter((m) => m?.topicType === "needed" && m?.topic)
      .map((m) => String(m.topic).trim().toLowerCase()),
  );
  const requiredTopics: string[] = (((idea as any).neededResearchTopics as string[]) ?? [])
    .filter((t) => !coveredNeeded.has(String(t).trim().toLowerCase()));
  const optionalTopics: string[] = (idea as any).optionalResearchTopics ?? [];
  // Tüm zorunlu konular karşılandıysa (eksik yok) ve en az bir araştırma bağlıysa proje kartı üretilebilir
  const canBuild = requiredTopics.length === 0 && linkedResearch.length > 0;

  // Otonom analiz: backend 4 katmanı (fonksiyonel/teknik/mimari + akış şeması) arka planda üretir,
  // architecturalAnalysis kaydedilince fikir otomatik PROJE kartına dönüşür. Asistana GİTMEZ.
  const startAnalysis = useCallback(async () => {
    if (analyzing) return;
    setAnalyzeError(false);
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/regenerate-analysis`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Başlatılamadı — sonsuz poll'a düşmeyelim, hatayı göster
      setAnalyzing(false);
      setAnalyzeError(true);
    }
  }, [analyzing, idea.id]);

  // Analiz sürerken fikir listesini periyodik tazele (poll). architecturalAnalysis gelince
  // CardDetailView otomatik ProjectDetailView'a geçer (bu bileşen unmount olur → effect temizlenir).
  // Güvenlik için ~2 dk sonra durdur (üretim takılırsa kullanıcı kilitli kalmasın).
  useEffect(() => {
    if (!analyzing) return;
    const iv = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
    }, 4000);
    const stop = setTimeout(() => setAnalyzing(false), 120000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [analyzing, queryClient]);

  // Fikri yeniden değerlendir — skorları + kullanım akışını (roadmap) otonom yeniden üretir (asistansız).
  const reEvaluate = useCallback(async () => {
    if (evaluating) return;
    evalAtRef.current = evaluatedAt;
    setEvaluating(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/re-evaluate`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
    } catch { setEvaluating(false); }
  }, [evaluating, idea.id, evaluatedAt]);
  useEffect(() => {
    if (!evaluating) return;
    const iv = setInterval(() => queryClient.invalidateQueries({ queryKey: ["/api/ideas"] }), 3000);
    const stop = setTimeout(() => setEvaluating(false), 70000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [evaluating, queryClient]);
  useEffect(() => {
    if (evaluating && evaluatedAt && evaluatedAt !== evalAtRef.current) setEvaluating(false);
  }, [evaluatedAt, evaluating]);

  const copyLink = () => { try { navigator.clipboard?.writeText(window.location.href); } catch { /* yoksay */ } };

  // Riskleri AI ile gider/revize et → asistana odaklı görev gönderir; asistan update_idea ile
  // açıklamayı revize eder, güncelleme otomatik YENİDEN DEĞERLENDİRMEYİ tetikler.
  const reviseRisks = () => {
    const low = scores
      ? SCORE_AXES.filter((a) => ((scores as any)[a.key] ?? 10) < 6).map((a) => `${a.label} (${(scores as any)[a.key]}/10)`)
      : [];
    const focus = [
      low.length ? `zayıf eksenler: ${low.join(", ")}` : "",
      scores?.pivotSuggestion ? `pivot önerisi: ${scores.pivotSuggestion}` : "",
      scores ? `risk & yönetişim: ${scores.riskGovernance}/10` : "",
    ].filter(Boolean).join(" · ");
    sendToChat(
      `"${idea.title}" fikrinin değerlendirme risklerini gider. Odak — ${focus || "genel risk azaltımı"}. ` +
      `Bu riskleri azaltacak SOMUT iyileştirmeleri fikrin açıklamasına işle ve update_idea ile güncelle (ideaId=${idea.id}). ` +
      `Güncelleme sonrası fikir otomatik yeniden değerlendirilecek.`
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-7 md:px-10">
      <div className="detail-page">
        <button className="dp-back" onClick={onClose}><ArrowLeft size={14} /> Fikirlere dön</button>

        {/* Banner */}
        <div className="idea-banner">
          <div>
            <div className="top-tags">
              <span className="tag-pill idea-t">FİKİR</span>
              {(idea as any).category && (
                <span className="tag-pill" style={{ background: "rgba(20,99,243,0.06)", color: "#1463F3", borderColor: "rgba(20,99,243,0.20)" }}>
                  {(idea as any).category}
                </span>
              )}
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64708B" }}>
                · {timeAgo(idea.createdAt)}{idea.authorName ? ` · ${idea.authorName} tarafından` : ""}
              </span>
            </div>
            <h1>{idea.title}</h1>
            {idea.description && (() => { const t = plainText(idea.description); return (
              <p className="lede">{t.length > 180 ? t.slice(0, 180) + "…" : t}</p>
            ); })()}
            <div className="meta-row">
              <span className="item"><Link2 size={14} color="#64708B" /><b>{links}</b> bağlantı</span>
              <span className="item"><Users size={14} color="#64708B" /><b>{contributors}</b> katkıda bulunan</span>
              <span className="item" style={{ color: "#157A3A" }}>
                <TrendingUp size={14} color="#157A3A" /><b style={{ color: "#157A3A" }}>{tier}</b>
              </span>
            </div>
          </div>
          {isAdmin && (
          <div className="maturity-big" style={{ ["--p" as any]: maturity + "%" }}>
            <div className="center">
              <div className="label">Olgunluk</div>
              <div className="v">%{maturity}</div>
              <div className="hint">AI tarafından hesaplandı</div>
            </div>
          </div>
          )}
        </div>

        {/* Aksiyon barı */}
        <div className="dp-actions">
          <span className="dp-vote"><Star size={16} color="#8A5A00" /><span className="v">{Math.max(0, idea.voteCount ?? 0)}</span><span>oy</span></span>
          <button className="btn-link" onClick={copyLink}><Share2 size={14} color="#1463F3" />Paylaş</button>
          {isAdmin && (
            <button className="btn-link" onClick={() => setShowLink(true)}><GitMerge size={14} color="#1463F3" />Bağlantı ekle</button>
          )}
          {isAdmin && (
            <button className="btn-link" onClick={() => setShowLinkedIn(true)}><Linkedin size={14} color="#0A66C2" />LinkedIn İçeriği</button>
          )}
          {hasAnalysis ? (
            <button className="btn-primary" onClick={() => openCard("idea", idea.id, "project")}>
              <Rocket size={14} color="#fff" />Projeyi Aç
            </button>
          ) : isAdmin ? (
            canBuild && !analyzing ? (
              <button className="btn-primary" onClick={startAnalysis}>
                <Rocket size={14} color="#fff" />Projeleştir
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled
                title={analyzing ? "Analiz üretiliyor…" : "Önce gerekli araştırmaları tamamla"}
                style={{ marginLeft: "auto", background: "#F4F7FE", color: "#94A0B8", boxShadow: "none", cursor: "not-allowed", border: "1px solid #E8EEF9" }}
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} color="#94A0B8" />}Projeleştir
              </button>
            )
          ) : null}
        </div>

        <div className="idea-body-grid">
          {/* Sol kolon */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <section className="dp-section">
              <h3><FileText size={16} color="#1463F3" />Fikrin tam açıklaması</h3>
              {idea.description ? md(idea.description) : <p className="dp-prose" style={{ color: "#94A0B8" }}>Açıklama girilmemiş.</p>}
              {idea.tags && idea.tags.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  {idea.tags.map((t) => <span key={t} className="tag-pill">#{t}</span>)}
                </div>
              )}
            </section>

            {/* Kullanım Akışı — AI üretimi (public görmez) */}
            {isAdmin && (
            <section className="dp-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}><Workflow size={16} color="#1463F3" />Kullanım Akışı</h3>
                {isAdmin && (
                  <button
                    onClick={reEvaluate}
                    disabled={evaluating}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[12px] font-semibold text-primary transition-all disabled:opacity-60"
                  >
                    {evaluating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {evaluating ? "Üretiliyor…" : usageSteps.length > 0 ? "Yenile" : "Akışı Üret"}
                  </button>
                )}
              </div>
              {usageSteps.length > 0 ? (
                <UsageFlow steps={usageSteps} />
              ) : evaluating ? (
                <div className="usage-flow" style={{ justifyContent: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#64708B", padding: 12 }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: "#1463F3" }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600 }}>Kullanım akışı üretiliyor…</span>
                  </div>
                </div>
              ) : (
                <p className="dp-prose" style={{ fontSize: 13, color: "#94A0B8" }}>
                  Kullanım akışı henüz üretilmedi. {isAdmin ? "“Akışı Üret” ile AI son kullanıcı senaryosunu adım adım çıkarır." : "Fikir değerlendirildiğinde burada gösterilecek."}
                </p>
              )}
            </section>
            )}

            {/* Projelendirme için gerekli araştırmalar + proje kartı oluşturma */}
            <section className="dp-section">
              <h3><FlaskConical size={16} color="#1463F3" />Projelendirme için Araştırmalar</h3>
              <div className="proj-build">
                {/* Durum çubuğu */}
                <div className={"proj-status " + (hasAnalysis ? "ready" : requiredTopics.length > 0 ? "wait" : linkedResearch.length > 0 ? "ready" : "idle")}>
                  {hasAnalysis ? <CheckCircle2 size={15} /> : requiredTopics.length > 0 ? <AlertTriangle size={15} /> : linkedResearch.length > 0 ? <CheckCircle2 size={15} /> : <Info size={15} />}
                  <span>
                    {hasAnalysis
                      ? "Bu fikir projeye dönüştü — detaylar Proje görünümünde"
                      : requiredTopics.length > 0
                        ? `${requiredTopics.length} zorunlu araştırma konusu eksik — tamamlanınca proje kartı üretilebilir`
                        : linkedResearch.length > 0
                          ? "Gerekli araştırmalar tamam — bu fikir projeye dönüştürülebilir"
                          : "Bu fikre henüz araştırma bağlanmadı"}
                  </span>
                </div>

                {/* Karşılanan (bağlı) araştırmalar */}
                {linkedResearch.length > 0 && (
                  <div>
                    <div className="req-gh"><CheckCircle2 size={12} color="#0F8C66" />Karşılanan Araştırmalar ({linkedResearch.length})</div>
                    {linkedResearch.map((r) => (
                      <div key={r.id} className="req-row done" style={{ cursor: "pointer" }} onClick={() => openCard("research", r.id)}>
                        <span className="ic"><Check size={12} strokeWidth={3} /></span>
                        <span className="tx">{r.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zorunlu (eksik) konular */}
                {isAdmin && requiredTopics.length > 0 && (
                  <div>
                    <div className="req-gh"><AlertTriangle size={12} color="#B0292B" />Gerekli Araştırma Konuları ({requiredTopics.length})</div>
                    {requiredTopics.map((t, i) => (
                      <div key={i} className="req-row miss"><span className="ic"><Circle size={9} /></span><span className="tx">{t}</span></div>
                    ))}
                  </div>
                )}

                {/* Opsiyonel konular */}
                {isAdmin && optionalTopics.length > 0 && (
                  <div>
                    <div className="req-gh"><BookOpen size={12} color="#0E54D8" />Opsiyonel Konular ({optionalTopics.length})</div>
                    {optionalTopics.map((t, i) => (
                      <div key={i} className="req-row opt"><span className="ic"><Circle size={9} /></span><span className="tx">{t}</span></div>
                    ))}
                  </div>
                )}

                {/* Hiç konu/araştırma yoksa */}
                {requiredTopics.length === 0 && optionalTopics.length === 0 && linkedResearch.length === 0 && (
                  <p className="dp-prose" style={{ fontSize: 13, color: "#94A0B8" }}>
                    Araştırma konuları henüz belirlenmedi. Asistana fikri anlat — gerekli araştırma başlıklarını çıkarır.
                  </p>
                )}

                {/* Aksiyonlar — yalnızca admin (içerik üretir) */}
                {isAdmin && (
                  <div className="proj-actions">
                    <button className="doc-add" style={{ flex: "0 0 auto", padding: "10px 16px" }} onClick={() => setShowLink(true)}>
                      <Link2 size={14} color="#1463F3" />Manuel Araştırma Bağla
                    </button>
                    {/* Zaten projeye dönüşmüşse "Proje Kartı Oluştur" GÖSTERME — Projeyi Aç */}
                    {hasAnalysis ? (
                      <button className="proj-cta go" onClick={() => openCard("idea", idea.id, "project")}><Rocket size={14} />Projeyi Aç</button>
                    ) : canBuild && !analyzing ? (
                      <button className="proj-cta go" onClick={startAnalysis}><Rocket size={14} />Proje Kartı Oluştur</button>
                    ) : analyzing ? (
                      <button className="proj-cta lock" disabled><Loader2 size={14} className="animate-spin" />Üretiliyor…</button>
                    ) : (
                      <button className="proj-cta lock" disabled title="Önce gerekli araştırmaları tamamla"><Lock size={14} />Proje Kartı Oluştur</button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* AI Derin Analiz — AI üretimi (public görmez) */}
            {isAdmin && (hasAnalysis ? (
              <div className="dp-analyze">
                <div className="l">
                  <div className="titlerow">
                    <div className="sparkle"><CheckCircle2 size={20} color="#fff" /></div>
                    <h3>Bu fikir projeye dönüştü</h3>
                  </div>
                  <p>Fonksiyonel/teknik analiz ve <b>sistem mimarisi şeması</b> Proje görünümünde yer alır. Fikir tarafında skorlar, araştırmalar ve kullanım akışı kalır.</p>
                </div>
                <button onClick={() => openCard("idea", idea.id, "project")}>Proje görünümünü aç</button>
              </div>
            ) : (
              <div className="dp-analyze">
                <div className="l">
                  <div className="titlerow">
                    <div className="sparkle">{analyzing ? <Loader2 size={20} color="#fff" className="animate-spin" /> : <Sparkles size={20} color="#fff" />}</div>
                    <h3>{analyzing ? "AI Derin Analiz üretiliyor…" : "AI Derin Analiz"}</h3>
                  </div>
                  <p>
                    {analyzing ? (
                      <>4 katman (mimari, pazar, risk, yol haritası) ve akış şeması <b>arka planda</b> üretiliyor. ~1 dakika sürebilir; tamamlanınca bu kart <b>otomatik olarak Proje</b> görünümüne dönüşür. Sayfada kalman yeterli.</>
                    ) : (
                      <>Fikir için <b>4 katmanlı</b> analiz <b>otonom</b> üretilir (fonksiyonel, teknik, mimari plan + akış şeması). Tamamlanınca fikir <b>otomatik olarak Proje</b> kartına dönüşür — asistana gitmez, burada üretilir.</>
                    )}
                  </p>
                  <div className="pills">
                    <span className="pill"><Cpu size={11} />Mimari</span>
                    <span className="pill"><LineChart size={11} />Pazar</span>
                    <span className="pill"><ShieldAlert size={11} />Risk</span>
                    <span className="pill"><MapIcon size={11} />Yol Haritası</span>
                  </div>
                  {analyzeError && (
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "#B0292B", margin: 0 }}>
                      Analiz başlatılamadı. Bağlantını kontrol edip tekrar dene.
                    </p>
                  )}
                </div>
                {analyzing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 120 }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: "#1463F3" }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "#0E54D8" }}>Üretiliyor…</span>
                  </div>
                ) : isAdmin ? (
                  canBuild ? (
                    <button onClick={startAnalysis}>Analizi başlat</button>
                  ) : (
                    <button disabled title="Önce gerekli araştırmaları tamamla" style={{ background: "#F4F7FE", color: "#94A0B8", boxShadow: "none", cursor: "not-allowed" }}>Araştırma bekleniyor</button>
                  )
                ) : (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#94A0B8", whiteSpace: "nowrap" }}>Analiz bekleniyor</span>
                )}
              </div>
            ))}

          </div>

          {/* Sağ kolon — public: yalnız Bağlı içerikler (dokümanlar). AI değerlendirme/aşamalar admin'e özel. */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {isAdmin && (<>
            <section className="dp-section">
              <h3><Gauge size={16} color="#1463F3" />Fikir Değerlendirmesi</h3>
              {evaluating && !scores ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 0", color: "#64708B" }}>
                  <Loader2 size={22} className="animate-spin" style={{ color: "#1463F3" }} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600 }}>AI fikri puanlıyor…</span>
                </div>
              ) : scores ? (
                <>
                  {(() => {
                    const avg = (scores.commercialFeasibility + scores.marketNeed + scores.technicalDifficulty + scores.trendAlignment + scores.riskGovernance) / 5;
                    const c = scoreColor(avg);
                    const verdict = avg >= 7 ? "Güçlü Fikir" : avg >= 5 ? "Potansiyelli" : "Geliştirme Gerekli";
                    return (
                      <div className="eval-hero">
                        <div className="circle" style={{ background: `${c}1a`, border: `3px solid ${c}55` }}>
                          <span className="n" style={{ color: c }}>{avg.toFixed(1)}</span>
                          <span className="d">/10</span>
                        </div>
                        <div>
                          <div className="overline">Genel Skor</div>
                          <div className="verdict" style={{ color: c }}>{verdict}</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="eval-bars">
                    {SCORE_AXES.map(({ key, label }) => {
                      const v = (scores as any)[key] as number;
                      const c = scoreColor(v);
                      return (
                        <div key={key} className="eval-bar">
                          <div className="top"><span className="l">{label}</span><span className="v" style={{ color: c }}>{v}/10</span></div>
                          <div className="track"><span style={{ width: `${v * 10}%`, background: c }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  {scores.summary && (
                    <div className="mt-3.5 rounded-[12px] border border-primary/15 bg-primary/[0.04] px-4 py-3">
                      <div className="overline mb-1.5 flex items-center gap-1.5 text-primary"><Sparkles size={12} />Özet</div>
                      <p className="text-[12.5px] leading-relaxed text-on-surface">{scores.summary}</p>
                    </div>
                  )}
                  {isAdmin && scores.pivotSuggestion && (
                    <div className="mt-2.5 rounded-[12px] border px-4 py-3" style={{ background: "rgba(255,176,32,0.06)", borderColor: "rgba(255,176,32,0.25)" }}>
                      <div className="overline mb-1.5 flex items-center gap-1.5" style={{ color: "#8A5A00" }}><Lightbulb size={12} />Pivot Önerisi</div>
                      <p className="text-[12.5px] leading-relaxed text-on-surface">{scores.pivotSuggestion}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={reviseRisks}
                      className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-secondary/30 bg-secondary/[0.08] py-2.5 text-[13px] font-semibold text-secondary transition-all hover:bg-secondary/[0.15]"
                    >
                      <Sparkles size={14} />Riskleri AI ile Revize Et
                    </button>
                  )}
                </>
              ) : (
                <p className="dp-prose" style={{ fontSize: 13, color: "#64708B" }}>
                  Bu fikir henüz AI tarafından puanlanmadı.{isAdmin ? " “Kullanım Akışı” bölümündeki “Akışı Üret” ile değerlendirme başlatılır." : ""}
                </p>
              )}
            </section>

            <section className="dp-section">
              <h3><BarChart3 size={16} color="#1463F3" />Fikir Aşamaları</h3>
              <div className="maturity-bar">
                <div className="bar"><span style={{ width: maturity + "%" }} /></div>
                <div className="ticks">
                  <span className={maturity < 25 ? "active" : ""}>Yeni</span>
                  <span className={maturity >= 25 && maturity < 50 ? "active" : ""}>Geliştiriliyor</span>
                  <span className={maturity >= 50 && maturity < 75 ? "active" : ""}>Olgunlaşıyor</span>
                  <span className={maturity >= 75 ? "active" : ""}>Proje hazır</span>
                </div>
              </div>
              <p className="dp-prose" style={{ fontSize: 13, marginTop: 14 }}>
                Fikir aşamaları <b>olgunluk skoruna</b> göre belirlenir. <b>%75'e</b> ulaşınca projeye dönüştürülebilir — proje aşamaları (Keşif→Lansman) ayrı işler.
              </p>
            </section>
            </>)}

            {/* Bağlı içerikler — sağ kolonda (tek sütun), boş alanı doldurur */}
            {(linkedResearch.length > 0 || relatedIdeas.length > 0) && (
              <section className="dp-section">
                <h3><GitMerge size={16} color="#1463F3" />Bağlı içerikler</h3>
                <div className="connected-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                  {linkedResearch.map((r) => (
                    <ConnectedItem key={"r" + r.id} kind="research" type="Araştırma" name={r.title} score="kaynak" onClick={() => openCard("research", r.id)} />
                  ))}
                  {relatedIdeas.map((i) => {
                    const proj = !!(i as any).architecturalAnalysis;
                    return <ConnectedItem key={"i" + i.id} kind={proj ? "project" : "idea"} type={proj ? "Proje" : "Benzer Fikir"} name={i.title} score={proj ? "sinerji" : "benzer"} onClick={() => openCard("idea", i.id)} />;
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {showLink && (
        <ManualLinkModal
          ideaId={idea.id}
          ideaTitle={idea.title}
          currentResearchIds={researchIds}
          allResearch={allResearch}
          onClose={() => setShowLink(false)}
        />
      )}
      {showLinkedIn && (
        <LinkedInComposerModal kind="idea" id={idea.id} title={idea.title} defaultAngle={hasAnalysis ? "problem" : "founder"} shareLink={`${window.location.origin}/i/${idea.id}`} onClose={() => setShowLinkedIn(false)} />
      )}
    </div>
  );
}

/* ════════════════════ ARAŞTIRMA DETAY ════════════════════ */

function ResearchDetailView({ research, allIdeas, onClose }: {
  research: Research; allIdeas: Idea[]; onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = !!user;
  const [showLinkedIn, setShowLinkedIn] = useState(false);

  const linkedIdeas = allIdeas.filter((i) => (i.researchIds ?? []).includes(research.id));
  const tags = research.tags ?? [];
  const sourceUrl = (research as any).sourceUrl as string | undefined;
  const source = (research as any).source as string | undefined;

  const hasImage = !!(research as any).hasCoverImage || !!research.coverImageB64;
  const imageSrc = research.coverImageB64
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : hasImage ? `${API_ORIGIN}/api/research/${research.id}/cover` : null;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-7 md:px-10">
      <div className="detail-page">
        <button className="dp-back" onClick={onClose}><ArrowLeft size={14} /> Araştırmalara dön</button>

        {imageSrc && (
          <div className="research-hero"><img src={imageSrc} alt={research.title} /></div>
        )}

        <div className="research-banner">
          <div className="source-row">
            <span className="source-pill"><BookOpen size={12} />ARAŞTIRMA</span>
            {source && <span>{source}</span>}
            {tags[0] && <><span style={{ color: "#CBD3E2" }}>·</span><span>{tags[0]}</span></>}
            <span style={{ color: "#CBD3E2" }}>·</span>
            <span>{timeAgo(research.createdAt)} eklendi</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {isAdmin && (
                <button className="btn-link" onClick={() => setShowLinkedIn(true)}><Linkedin size={14} color="#0A66C2" />LinkedIn İçeriği</button>
              )}
              {sourceUrl && (
                <a className="icon-btn" href={sourceUrl} target="_blank" rel="noreferrer" aria-label="Kaynağa git"><ExternalLink size={14} color="#1463F3" /></a>
              )}
            </span>
          </div>
          <h1>{research.title}</h1>
          {research.authorName && (
            <div className="authors">
              <span>Ekleyen:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="av">{initials(research.authorName)}</span>
                <span>{research.authorName}</span>
              </div>
            </div>
          )}
        </div>

        {/* İstatistikler — gerçek veri */}
        <div className="research-stats">
          <div className="research-stat">
            <span className="l">Bağlı Fikir</span><span className="v">{linkedIdeas.length}</span>
          </div>
          <div className="research-stat">
            <span className="l">Etiket</span><span className="v">{tags.length}</span>
          </div>
          <div className="research-stat">
            <span className="l">Oy</span><span className="v" style={{ color: "#1463F3" }}>{Math.max(0, research.voteCount ?? 0)}</span>
          </div>
          <div className="research-stat">
            <span className="l">Eklenme</span><span className="v" style={{ fontSize: 16, color: "#5B3FE0" }}>{timeAgo(research.createdAt)}</span>
          </div>
        </div>

        <div className="research-body-grid">
          {/* Sol — makale gövdesi */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {research.summary && (
              <section className="dp-section">
                <h3><FileText size={16} color="#1463F3" />Özet</h3>
                {md(research.summary)}
              </section>
            )}
            {research.findings && (
              <section className="dp-section">
                <h3><Sparkles size={16} color="#1463F3" />Bulgular</h3>
                <AnalysisDoc markdown={research.findings} accent="cyan" />
              </section>
            )}
            {isAdmin && (research as any).technicalAnalysis && (
              <section className="dp-section">
                <h3><Cpu size={16} color="#1463F3" />Teknik Analiz</h3>
                <AnalysisDoc markdown={(research as any).technicalAnalysis} accent="violet" />
              </section>
            )}
            {tags.length > 0 && (
              <section className="dp-section">
                <h3><Tags size={16} color="#1463F3" />Anahtar kelimeler</h3>
                <div className="kw-cloud">
                  {tags.map((k, i) => <span key={k} className={"kw " + (i === 0 ? "xl" : i === 1 ? "lg" : "")}>#{k}</span>)}
                </div>
              </section>
            )}
          </div>

          {/* Sağ — bağlantılar + kaynak */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <section className="dp-section">
              <h3><GitMerge size={16} color="#1463F3" />Bu araştırma neyi besliyor?</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {linkedIdeas.length > 0 ? linkedIdeas.map((i) => {
                  const proj = !!(i as any).architecturalAnalysis;
                  return <ConnectedItem key={i.id} kind={proj ? "project" : "idea"} type={proj ? "Proje" : "Fikir"} name={i.title} score="bağlı" onClick={() => openCard("idea", i.id)} />;
                }) : (
                  <p className="dp-prose" style={{ fontSize: 13, color: "#94A0B8" }}>Bu araştırmaya henüz fikir bağlanmadı.</p>
                )}
                {isAdmin && (
                  <button className="doc-add" style={{ marginTop: 4 }} onClick={() => sendToChat(`"${research.title}" araştırmasını uygun fikirlerle eşleştir.`)}>
                    <Plus size={14} color="#1463F3" />Yeni bağlantı öner
                  </button>
                )}
              </div>
            </section>

            <section className="dp-section">
              <h3><Info size={16} color="#1463F3" />Kaynak</h3>
              <div className="dp-prose" style={{ fontSize: 13 }}>
                {source && <p><b>Yayın:</b> {source}</p>}
                <p><b>Eklenme:</b> {new Date(research.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              {sourceUrl && (
                <a className="btn-link" href={sourceUrl} target="_blank" rel="noreferrer" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
                  <ExternalLink size={14} color="#1463F3" />Orijinal kaynağa git
                </a>
              )}
            </section>
          </aside>
        </div>
      </div>
      {showLinkedIn && (
        <LinkedInComposerModal kind="research" id={research.id} title={research.title} defaultAngle="research" shareLink={`${window.location.origin}/r/${research.id}`} onClose={() => setShowLinkedIn(false)} />
      )}
    </div>
  );
}

/* ════════════════════ PROJE DETAY ════════════════════ */

const AV_COLORS = ["#1463F3", "#18C9E8", "#7A5CFF", "#20C997", "#F59E0B"];

function projectStage(idea: Idea): { cls: string; label: string; progress: number } {
  const ps = (idea as any).projectStatus as string | null;
  switch (ps) {
    case "fikir": return { cls: "discovery", label: "Keşif", progress: 12 };
    case "planlama": return { cls: "architecture", label: "Mimari", progress: 35 };
    case "gelistirme": return { cls: "build", label: "Geliştirme", progress: 65 };
    case "test": return { cls: "build", label: "Test", progress: 85 };
    case "tamamlandi": return { cls: "launch", label: "Lansman", progress: 100 };
    case "beklemede": return { cls: "discovery", label: "Beklemede", progress: 20 };
    default: return { cls: "architecture", label: "Geliştirme", progress: maturityOf(idea) || 42 };
  }
}

// Proje yaşam-döngüsü aşamaları (fikir olgunluk aşamalarından AYRI)
const LIFECYCLE = [
  { name: "Keşif", sub: "İhtiyaç & fizibilite" },
  { name: "Mimari", sub: "Teknik tasarım kararları" },
  { name: "Geliştirme", sub: "Prototip & geliştirme" },
  { name: "Test", sub: "Pilot & QA" },
  { name: "Lansman", sub: "Yayına alma" },
];
function lifecycleIndex(idea: Idea): number {
  switch ((idea as any).projectStatus as string | null) {
    case "fikir": return 0;
    case "planlama": return 1;
    case "gelistirme": return 2;
    case "test": return 3;
    case "tamamlandi": return 4;
    case "beklemede": return 0;
    default: return 2; // mimari analiz var ama statü atanmamış → "Geliştirme" varsay
  }
}

function ProjectDetailView({ idea, allResearch, allIdeas, onClose }: {
  idea: Idea; allResearch: Research[]; allIdeas: Idea[]; onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = !!user;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const stage = projectStage(idea);
  const progress = stage.progress;
  const scores = (idea as any).evaluationScores as EvalScores | null;
  const analysis = (idea as any).architecturalAnalysis as
    | { functionalAnalysis?: string; technicalAnalysis?: string; architecturalPlan?: string; flowDiagram?: any; generatedAt?: string } | null;
  const flowDiagram = analysis?.flowDiagram;
  const curStage = lifecycleIndex(idea); // proje yaşam-döngüsü aşaması (0-4)

  // Analizi yeniden üret — otonom (asistana gitmez). scope: tüm proje / belirli bölüm.
  // Bağlam: bağlı fikir + araştırmalar (backend besleyen fikirleri de kapsar).
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenMenu, setShowRegenMenu] = useState(false);
  const genAtRef = useRef<string | undefined>(undefined);
  const regenerate = useCallback(async (scope: ReviseSection = "all") => {
    if (regenerating) return;
    setShowRegenMenu(false);
    genAtRef.current = analysis?.generatedAt;
    setRegenerating(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/regenerate-analysis`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRegenerating(false);
    }
  }, [regenerating, idea.id, analysis?.generatedAt]);
  // Üretim sürerken listeyi tazele; generatedAt değişince (yeni analiz geldi) dur. ~2 dk güvenlik.
  useEffect(() => {
    if (!regenerating) return;
    const iv = setInterval(() => queryClient.invalidateQueries({ queryKey: ["/api/ideas"] }), 4000);
    const stop = setTimeout(() => setRegenerating(false), 120000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [regenerating, queryClient]);
  useEffect(() => {
    const g = analysis?.generatedAt;
    if (regenerating && g && g !== genAtRef.current) setRegenerating(false);
  }, [analysis?.generatedAt, regenerating]);

  const team: Array<{ name: string; role?: string }> =
    ((idea as any).projectTeam as Array<{ name: string; role?: string }> | undefined) ??
    (idea.collaborators ?? []).map((n) => ({ name: n, role: "Katkıda bulunan" }));

  const researchIds: number[] = idea.researchIds ?? [];
  const relatedIds: number[] = (idea as any).relatedTo ?? [];
  const linkedResearch = researchIds.map((id) => allResearch.find((r) => r.id === id)).filter(Boolean) as Research[];
  const relatedIdeas = relatedIds.map((id) => allIdeas.find((i) => i.id === id)).filter(Boolean) as Idea[];

  // Bu projeyi BESLEYEN fikirler (many-to-one): relatedTo'sunda bu projenin id'si olanlar
  // + projenin kendi relatedTo'su (dedup, self hariç). Birden fazla fikir bağlanabilir.
  const [showLinkIdea, setShowLinkIdea] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);

  // Prototip / Demo — sistem "prototip var mı"yı architecturalAnalysis.prototype.url'den anlar.
  // Admin demo URL ekler; PUT ile architecturalAnalysis'e gömülür (migration yok). Public de görür.
  const prototype = (analysis as any)?.prototype as { url?: string; note?: string; screenshots?: string[]; addedAt?: string } | undefined;
  const [showProtoForm, setShowProtoForm] = useState(false);
  const [protoUrl, setProtoUrl] = useState("");
  const [protoNote, setProtoNote] = useState("");
  const [protoShots, setProtoShots] = useState<string[]>([]);
  const [savingProto, setSavingProto] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const onPickShots = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const next = [...protoShots];
    for (const f of files) { if (next.length >= 6) break; try { next.push(await downscaleImage(f)); } catch { /* yoksay */ } }
    setProtoShots(next);
    e.target.value = "";
  }, [protoShots]);
  const savePrototype = useCallback(async () => {
    if (!protoUrl.trim() && protoShots.length === 0) return;
    setSavingProto(true);
    try {
      const merged = {
        ...((analysis as any) || {}),
        prototype: {
          url: protoUrl.trim() || undefined,
          note: protoNote.trim() || undefined,
          screenshots: protoShots,
          addedAt: new Date().toISOString(),
        },
      };
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ architecturalAnalysis: merged }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
        await queryClient.refetchQueries({ queryKey: ["/api/ideas"] });
        setShowProtoForm(false);
      }
    } finally { setSavingProto(false); }
  }, [protoUrl, protoNote, protoShots, analysis, idea.id, queryClient]);

  const incomingIdeas = allIdeas.filter((i) => i.id !== idea.id && ((i as any).relatedTo ?? []).includes(idea.id));
  const feedingIdeas = [
    ...incomingIdeas,
    ...relatedIdeas.filter((r) => r.id !== idea.id && !incomingIdeas.some((x) => x.id === r.id)),
  ];

  const avgScore = scores
    ? ((scores.commercialFeasibility + scores.marketNeed + scores.technicalDifficulty + scores.trendAlignment + scores.riskGovernance) / 5)
    : null;
  const riskLevel = scores ? (scores.riskGovernance >= 7 ? "Düşük" : scores.riskGovernance >= 4 ? "Orta" : "Yüksek") : "—";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-7 md:px-10">
      <div className="detail-page">
        <button className="dp-back" onClick={onClose}><ArrowLeft size={14} /> Projelere dön</button>

        <div className="project-banner">
          <div className="row">
            <span className="tag-pill project-t">PROJE</span>
            {isAdmin && <span className={"status-pill-select " + stage.cls}>{stage.label}</span>}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isAdmin && (<>
                <button className="btn-link" onClick={() => navigate(`/feasibility?id=${idea.id}`)}><BarChart3 size={14} color="#1463F3" />Fizibilite Raporu</button>
                <button className="btn-link" onClick={() => navigate(`/financial?id=${idea.id}`)}><Banknote size={14} color="#1463F3" />Finansal Analiz</button>
              </>)}
              {isAdmin && (
                <button className="btn-link" onClick={() => setShowLinkedIn(true)}><Linkedin size={14} color="#0A66C2" />LinkedIn İçeriği</button>
              )}
              {isAdmin && (
                <div style={{ position: "relative" }}>
                  <button className="btn-link" onClick={() => regenerating ? undefined : setShowRegenMenu((o) => !o)} disabled={regenerating} title="Bağlı fikir ve araştırmalara göre projeyi yenile">
                    {regenerating ? <Loader2 size={14} className="animate-spin" color="#1463F3" /> : <RefreshCw size={14} color="#1463F3" />}
                    {regenerating ? "Yenileniyor…" : "Yenile"}
                    {!regenerating && <ChevronDown size={13} color="#1463F3" />}
                  </button>
                  {showRegenMenu && !regenerating && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowRegenMenu(false)} />
                      <div className="rounded-xl border border-outline-variant bg-white p-1.5 shadow-[0_12px_32px_rgba(7,27,58,0.16)]" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, width: 230 }}>
                        <div className="overline px-2.5 py-1 text-on-surface-variant">Neyi yenileyelim?</div>
                        {([
                          { s: "all", icon: <Sparkles size={14} color="#7A5CFF" />, t: "Tüm proje", d: "Bağlı fikir + araştırmalara göre" },
                          { s: "functional", icon: <Activity size={14} color="#1463F3" />, t: "Fonksiyonel analiz", d: "" },
                          { s: "technical", icon: <Cpu size={14} color="#18C9E8" />, t: "Teknik analiz", d: "" },
                          { s: "architecturalPlan", icon: <MapIcon size={14} color="#7A5CFF" />, t: "Mimari plan", d: "" },
                          { s: "flow", icon: <Workflow size={14} color="#20C997" />, t: "Akış şeması", d: "" },
                        ] as { s: ReviseSection; icon: React.ReactNode; t: string; d: string }[]).map((it) => (
                          <button
                            key={it.s}
                            onClick={() => regenerate(it.s)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-background"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">{it.icon}</span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold leading-tight text-on-surface">{it.t}</span>
                              {it.d && <span className="block text-[11px] leading-snug text-on-surface-variant">{it.d}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {isAdmin && (
                <button className="btn-primary" style={{ marginLeft: 0 }} onClick={() => openAssistantRevise({ intent: "revise", entityType: "project", entityId: idea.id, entityTitle: idea.title, section: "project" })}><PenLine size={14} color="#fff" />Düzenle</button>
              )}
            </span>
          </div>
          <h1>{idea.title}</h1>
          {idea.description && (() => { const t = plainText(idea.description); return (
            <p className="lede">{(idea as any).category ? (idea as any).category + " · " : ""}{t.length > 220 ? t.slice(0, 220) + "…" : t}</p>
          ); })()}

          {isAdmin && (
          <div style={{ position: "relative", marginTop: 18 }}>
            <div className="project-progress-bar">
              <span style={{ width: progress + "%" }} />
              <div className="marker" style={{ left: progress + "%" }}>%{progress}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#94A0B8" }}>
              <span>Başlangıç</span><span>Mimari</span><span style={{ color: "#5B3FE0" }}>Geliştirme</span><span>Beta</span><span>Lansman</span>
            </div>
          </div>
          )}
        </div>

        <div className="project-body-grid">
          {/* Sol kolon */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Proje Aşamaları — AI yaşam-döngüsü (public görmez) */}
            {isAdmin && (
            <section className="dp-section">
              <h3><Route size={16} color="#1463F3" />Proje Aşamaları</h3>
              <div className="timeline">
                {LIFECYCLE.map((s, i) => {
                  const state = i < curStage ? "done" : i === curStage ? "current" : "";
                  return (
                    <div key={i} className={"milestone " + state}>
                      <div className="marker">{state === "done" && <Check size={11} color="#fff" strokeWidth={2.5} />}</div>
                      <div className="meta">
                        <div className="name">{s.name}</div>
                        <div className="sub">{s.sub}</div>
                        <span className="badge">{state === "done" ? "Tamamlandı" : state === "current" ? "Aktif aşama" : "Planlandı"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            )}

            {/* Prototip / Demo — built ürünün canlı sergilenmesi (iframe önizleme + aç) */}
            <section className="dp-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}><MonitorPlay size={16} color="#1463F3" />Prototip / Demo</h3>
                {isAdmin && (
                  <button
                    onClick={() => { setProtoUrl(prototype?.url ?? ""); setProtoNote(prototype?.note ?? ""); setProtoShots(prototype?.screenshots ?? []); setShowProtoForm((v) => !v); }}
                    className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[12px] font-semibold text-primary transition-all hover:bg-primary/[0.12]"
                  >
                    {(prototype?.url || prototype?.screenshots?.length) ? <PenLine size={13} /> : <Plus size={13} />}{(prototype?.url || prototype?.screenshots?.length) ? "Düzenle" : "Prototip Ekle"}
                  </button>
                )}
              </div>

              {showProtoForm ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    value={protoUrl} onChange={(e) => setProtoUrl(e.target.value)}
                    placeholder="Canlı demo / prototip URL'i (https://...)"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                  <input
                    value={protoNote} onChange={(e) => setProtoNote(e.target.value)}
                    placeholder="Kısa not (opsiyonel) — ör. 'v0.4 beta · giriş: demo/demo'"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                  {/* Ekran görüntüsü galerisi — istemci tarafında küçültülüp base64 olarak saklanır */}
                  <div>
                    <div className="overline mb-2">Ekran Görüntüleri ({protoShots.length}/6)</div>
                    <div className="flex flex-wrap gap-2">
                      {protoShots.map((s, i) => (
                        <div key={i} className="relative">
                          <img src={s} alt="" className="h-16 w-24 rounded-lg border border-outline-variant object-cover" />
                          <button
                            onClick={() => setProtoShots(protoShots.filter((_, j) => j !== i))}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-white shadow"
                            aria-label="Kaldır"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {protoShots.length < 6 && (
                        <label className="flex h-16 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/40 text-primary transition-colors hover:bg-primary/[0.04]">
                          <ImagePlus size={16} />
                          <span className="text-[10px] font-semibold">Görsel Ekle</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={onPickShots} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowProtoForm(false)} className="flex-1 rounded-xl border border-outline-variant bg-white py-2.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-background">Vazgeç</button>
                    <button onClick={savePrototype} disabled={savingProto || (!protoUrl.trim() && protoShots.length === 0)} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0e54d8] disabled:opacity-60">
                      {savingProto ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Kaydet
                    </button>
                  </div>
                </div>
              ) : prototype && (prototype.url || (prototype.screenshots && prototype.screenshots.length > 0)) ? (
                <div>
                  {/* Canlı demo — deneyimlenebilir iframe */}
                  {prototype.url && (
                    <>
                      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid #E8EEF9", background: "#F8FAFF" }}>
                        <iframe
                          src={prototype.url}
                          title="Prototip önizleme"
                          style={{ width: "100%", height: 420, border: "none", display: "block", background: "#fff" }}
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[12px] text-on-surface-variant">
                          {prototype.note || "Canlı prototip önizlemesi. Bazı demolar gömülemez — yeni sekmede açın."}
                        </p>
                        <a href={prototype.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]">
                          <ExternalLink size={14} />Demo'yu Aç
                        </a>
                      </div>
                    </>
                  )}
                  {/* Ekran görüntüleri galerisi */}
                  {prototype.screenshots && prototype.screenshots.length > 0 && (
                    <div className={prototype.url ? "mt-4" : ""}>
                      {prototype.url && <div className="overline mb-2">Ekran Görüntüleri</div>}
                      {!prototype.url && prototype.note && <p className="mb-3 text-[12px] text-on-surface-variant">{prototype.note}</p>}
                      <div className="flex gap-2.5 overflow-x-auto pb-1">
                        {prototype.screenshots.map((s, i) => (
                          <img
                            key={i}
                            src={s}
                            alt={`Ekran ${i + 1}`}
                            onClick={() => setLightbox(s)}
                            className="h-44 shrink-0 cursor-zoom-in rounded-xl border border-outline-variant object-cover transition-transform hover:scale-[1.02]"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="dp-prose" style={{ fontSize: 13, color: "#94A0B8" }}>
                  Bu projenin prototipi/demosu henüz eklenmedi. {isAdmin ? "“Prototip Ekle” ile canlı demo URL'i ve/veya ekran görüntüleri bağla — Dashboard İnovasyon Hattı'ndaki Prototip aşamasına da yansır." : "Hazır olduğunda burada sergilenecek."}
                </p>
              )}
            </section>

            {/* Sistem mimarisi — AI üretimi şema (public görmez) */}
            {isAdmin && ((flowDiagram && Array.isArray(flowDiagram.nodes) && flowDiagram.nodes.length > 0) || regenerating) && (
              <section className="dp-section">
                <h3><GitBranch size={16} color="#1463F3" />Sistem Mimarisi Şeması</h3>
                {flowDiagram && Array.isArray(flowDiagram.nodes) && flowDiagram.nodes.length > 0 ? (
                  <FlowDiagram data={flowDiagram} />
                ) : (
                  <div className="flow-viewport" style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#64708B" }}>
                      <Loader2 size={26} className="animate-spin" style={{ color: "#1463F3" }} />
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600 }}>Mimari şema üretiliyor… (~1 dk)</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* AI Derin Analiz — uzun fonksiyonel/teknik/mimari METİN içeriği proje kapağı altında,
                katlanabilir bölümler (varsayılan kapalı) içinde. Sayfayı uzun uzun doldurmaz. */}
            {isAdmin && (analysis?.functionalAnalysis || analysis?.technicalAnalysis || analysis?.architecturalPlan) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="overline" style={{ margin: "4px 2px 0" }}>AI Derin Analiz · Detaylı Açıklama</p>
                {analysis?.functionalAnalysis && (
                  <CollapsibleSection icon={<Activity size={16} color="#1463F3" />} title="Fonksiyonel Analiz"><RevisableAnalysis ideaId={idea.id} title={idea.title} section="functional" markdown={analysis.functionalAnalysis} accent="blue" /></CollapsibleSection>
                )}
                {analysis?.technicalAnalysis && (
                  <CollapsibleSection icon={<Cpu size={16} color="#1463F3" />} title="Teknik Analiz"><RevisableAnalysis ideaId={idea.id} title={idea.title} section="technical" markdown={analysis.technicalAnalysis} accent="cyan" /></CollapsibleSection>
                )}
                {analysis?.architecturalPlan && (
                  <CollapsibleSection icon={<MapIcon size={16} color="#1463F3" />} title="Mimari Plan (Açıklama)"><RevisableAnalysis ideaId={idea.id} title={idea.title} section="architecturalPlan" markdown={analysis.architecturalPlan} accent="violet" /></CollapsibleSection>
                )}
              </div>
            )}

          </div>

          {/* Sağ kolon — public: yalnız bağlı içerikler (dokümanlar). Proje durumu/ekip admin'e özel. */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {isAdmin && (
            <section className="dp-section">
              <h3><Activity size={16} color="#1463F3" />Proje durumu</h3>
              <div className="dp-eval-stack">
                <div className="dp-eval-item">
                  <span className="l">Aşama</span><span className="v secondary" style={{ fontSize: 16 }}>{stage.label}</span>
                  <p className="p">Projenin mevcut yaşam döngüsü aşaması.</p>
                </div>
                <div className="dp-eval-item">
                  <span className="l">İlerleme</span><span className="v">%{progress}</span>
                  <p className="p">Aşama ve olgunluk skorundan hesaplandı.</p>
                </div>
                {avgScore != null && (
                  <div className="dp-eval-item">
                    <span className="l">Fizibilite Skoru</span><span className="v success">{(avgScore * 10).toFixed(0)}</span>
                    <p className="p">5 eksenli AI değerlendirmesinin ortalaması (×10).</p>
                  </div>
                )}
                <div className="dp-eval-item">
                  <span className="l">Risk Seviyesi</span><span className="v warning" style={{ fontSize: 16 }}>{riskLevel}</span>
                  <p className="p">{scores ? `Risk & yönetişim puanı ${scores.riskGovernance}/10.` : "Değerlendirme bekleniyor."}</p>
                </div>
              </div>
            </section>
            )}

            {isAdmin && (
            <section className="dp-section">
              <h3><Users size={16} color="#1463F3" />Ekip · {team.length}</h3>
              {team.length > 0 ? (
                <div className="team-cards">
                  {team.map((m, idx) => (
                    <div key={idx} className="team-card">
                      <div className="av" style={{ background: AV_COLORS[idx % AV_COLORS.length] }}>{initials(m.name)}</div>
                      <div className="meta"><div className="n">{m.name}</div><div className="r">{m.role || "Ekip üyesi"}</div></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dp-prose" style={{ fontSize: 13, color: "#94A0B8" }}>Ekip henüz atanmadı.</p>
              )}
              {isAdmin && (
                <button className="doc-add" style={{ marginTop: 12 }} onClick={() => sendToChat(`"${idea.title}" projesine ekip üyesi öner.`)}>
                  <UserPlus size={14} color="#1463F3" />Üye ekle
                </button>
              )}
            </section>
            )}

            {/* Bağlı Fikirler — bu projeyi besleyen fikirler (çok-bir). Sağ kolonda, tek sütun. */}
            <section className="dp-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}><Lightbulb size={16} color="#1463F3" />Bağlı Fikirler ({1 + feedingIdeas.length})</h3>
                {isAdmin && (
                  <button onClick={() => setShowLinkIdea(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[12px] font-semibold text-primary transition-all hover:bg-primary/[0.12]">
                    <Plus size={13} />Fikir Bağla
                  </button>
                )}
              </div>
              <div className="connected-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                {/* Kaynak fikir — bu projenin türediği fikrin kendisi (fikir yüzünü açar) */}
                <ConnectedItem kind="idea" type="Kaynak Fikir" name={idea.title} score="bu proje" onClick={() => openCard("idea", idea.id, "idea")} />
                {feedingIdeas.map((i) => (
                  <ConnectedItem key={"i" + i.id} kind="idea" type="Besleyen Fikir" name={i.title} score="bağlı" onClick={() => openCard("idea", i.id)} />
                ))}
              </div>
              {feedingIdeas.length === 0 && isAdmin && (
                <p className="dp-prose" style={{ fontSize: 12.5, color: "#94A0B8", marginTop: 10 }}>
                  Başka fikirleri de bu projeye bağlamak için “Fikir Bağla”yı kullan (çok-bir).
                </p>
              )}
            </section>

            {/* Bağlı Araştırmalar — sağ kolonda, tek sütun */}
            {linkedResearch.length > 0 && (
              <section className="dp-section">
                <h3><BookOpen size={16} color="#1463F3" />Bağlı Araştırmalar ({linkedResearch.length})</h3>
                <div className="connected-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                  {linkedResearch.map((r) => (
                    <ConnectedItem key={"r" + r.id} kind="research" type="Araştırma" name={r.title} score="referans" onClick={() => openCard("research", r.id)} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {showLinkIdea && (
        <LinkIdeaToProjectModal
          projectId={idea.id}
          projectTitle={idea.title}
          allIdeas={allIdeas}
          onClose={() => setShowLinkIdea(false)}
        />
      )}
      {showLinkedIn && (
        <LinkedInComposerModal kind="idea" id={idea.id} title={idea.title} defaultAngle="problem" shareLink={`${window.location.origin}/p/${idea.id}`} onClose={() => setShowLinkedIn(false)} />
      )}

      {/* Ekran görüntüsü büyütme (lightbox) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071B3A]/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Kapat">
            <X size={20} />
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
