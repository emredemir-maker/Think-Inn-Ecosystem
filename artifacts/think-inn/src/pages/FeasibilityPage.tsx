import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListIdeas, type Idea } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { API_ORIGIN } from "@/lib/api-config";

/* Asistana odaklı görev gönderir + asistanı açar */
function sendToChat(message: string) {
  window.dispatchEvent(new CustomEvent("think-inn:send-message", { detail: { message } }));
  window.dispatchEvent(new CustomEvent("think-inn:open-assistant"));
}

/* Material Symbols ikon */
function Icon({ name, size = 18, filled = false, className = "" }: {
  name: string; size?: number; filled?: boolean; className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}` }}
    >
      {name}
    </span>
  );
}

type Eval = {
  commercialFeasibility: number; marketNeed: number; technicalDifficulty: number;
  trendAlignment: number; riskGovernance: number; summary?: string; pivotSuggestion?: string;
} | null;

/* Skor → renk + etiket */
function verdict(score: number) {
  if (score >= 75) return { label: "Yüksek Güven", rec: "GO", color: "#157A3A", recColor: "#157A3A", recBg: "rgba(34,197,94,0.10)" };
  if (score >= 50) return { label: "Potansiyelli", rec: "İNCELE", color: "#8A5A00", recColor: "#8A5A00", recBg: "rgba(255,176,32,0.14)" };
  return { label: "Geliştirme Gerekli", rec: "BEKLET", color: "#B0292B", recColor: "#B0292B", recBg: "rgba(239,68,68,0.10)" };
}

/* Çeyrek kartı — gerçek evalScores ekseninden beslenir */
function Quad({ title, icon, color, bg, score, label }: {
  title: string; icon: string; color: string; bg: string; score: number; label: string;
}) {
  return (
    <div className="rounded-[16px] border border-outline-variant bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-heading text-[15px] font-bold text-on-surface">{title}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: bg, color }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="text-on-surface-variant">{label}</span>
        <b className="text-on-surface" style={{ color: score >= 70 ? "#157A3A" : score >= 45 ? "#8A5A00" : "#B0292B" }}>%{score}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export default function FeasibilityPage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { data: ideaList } = useListIdeas();
  const { user } = useAuth();
  const isAdmin = !!user;
  const qc = useQueryClient();
  const [revaluating, setRevaluating] = useState(false);
  const evalAtRef = useRef<any>(undefined);

  const id = useMemo(() => {
    const p = new URLSearchParams(searchStr);
    return Number(p.get("id"));
  }, [searchStr]);

  const idea = (ideaList ?? []).find((i) => i.id === id) as Idea | undefined;
  const ev = (idea as any)?.evaluationScores as Eval;
  const roadmap: string[] = (idea as any)?.roadmap ?? [];

  // Genel fizibilite skoru (gerçek: evalScores ortalaması ×10)
  const score = ev
    ? Math.round(((ev.commercialFeasibility + ev.marketNeed + ev.technicalDifficulty + ev.trendAlignment + ev.riskGovernance) / 5) * 10)
    : 0;
  const v = verdict(score);

  // AI ile yeniden değerlendirme — re-evaluate ucu (evalScores'u sıfırlayıp yeniden üretir)
  const reEvaluate = useCallback(async () => {
    if (!idea || revaluating) return;
    evalAtRef.current = (idea as any).evaluatedAt;
    setRevaluating(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/re-evaluate`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
    } catch { setRevaluating(false); }
  }, [idea, revaluating]);
  useEffect(() => {
    if (!revaluating) return;
    const iv = setInterval(() => qc.invalidateQueries({ queryKey: ["/api/ideas"] }), 3000);
    const stop = setTimeout(() => setRevaluating(false), 70000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [revaluating, qc]);
  useEffect(() => {
    const e = (idea as any)?.evaluatedAt;
    if (revaluating && e && e !== evalAtRef.current) setRevaluating(false);
  }, [idea, revaluating]);

  // AI ile revizyon — asistan riskleri azaltacak şekilde fikri günceller (update_idea → otomatik yeniden değerlendirme)
  const reviseWithAI = () => {
    if (!idea) return;
    const low = ev
      ? ([["Ticari", ev.commercialFeasibility], ["Pazar", ev.marketNeed], ["Teknik", ev.technicalDifficulty], ["Trend", ev.trendAlignment], ["Risk & Yönetişim", ev.riskGovernance]] as Array<[string, number]>)
          .filter(([, n]) => n < 6).map(([l, n]) => `${l} (${n}/10)`)
      : [];
    sendToChat(
      `"${idea.title}" projesinin fizibilitesini iyileştir. Zayıf noktalar: ${low.join(", ") || "genel risk"}. ` +
      `${ev?.pivotSuggestion ? "Pivot önerisi: " + ev.pivotSuggestion + ". " : ""}` +
      `Bu riskleri azaltacak SOMUT revizeleri fikrin açıklamasına işle ve update_idea ile güncelle (ideaId=${idea.id}); ardından otomatik yeniden değerlendirilecek.`
    );
  };

  // Yol haritası fazları — gerçek roadmap'ten veya varsayılan 5 faz iskeleti
  const phases = roadmap.length > 0
    ? roadmap.map((name, i) => ({ n: i + 1, name, state: i === 0 ? "done" : i === 1 ? "current" : "" }))
    : [];

  if (!idea) {
    return (
      <div className="min-h-full bg-background">
        <div className="mx-auto max-w-[1100px] px-10 pt-7">
          <button onClick={() => navigate("/projects")} className="mb-6 flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-primary">
            <Icon name="arrow_back" size={16} /> Projelere dön
          </button>
          <div className="hub-empty"><div className="ico"><Icon name="fact_check" size={26} /></div>
            <div className="t">Proje bulunamadı</div>
            <div className="p">Fizibilite raporu için geçerli bir proje seç.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-[1200px] space-y-6 px-10 pb-16 pt-7">
        {/* Geri + başlık */}
        <button onClick={() => navigate("/projects")} className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary">
          <Icon name="arrow_back" size={16} /> Projelere dön
        </button>

        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[12px] text-on-surface-variant">Projeler &gt; <b className="text-on-surface">Fizibilite</b></div>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] text-on-surface">{idea.title}</h1>
            <div className="mt-1 text-[13px] text-on-surface-variant">Kapsamlı Fizibilite Analizi</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button onClick={reviseWithAI} className="flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/[0.08] px-4 py-2.5 text-[13px] font-semibold text-secondary transition-colors hover:bg-secondary/[0.15]">
                <Icon name="auto_awesome" size={15} /> AI ile Revize Et
              </button>
            )}
            {isAdmin && (
              <button onClick={reEvaluate} disabled={revaluating} className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-4 py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/[0.14] disabled:opacity-60">
                <Icon name={revaluating ? "progress_activity" : "refresh"} size={15} className={revaluating ? "animate-spin" : ""} /> {revaluating ? "Değerlendiriliyor…" : "Yeniden Değerlendir"}
              </button>
            )}
            <button className="flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2.5 text-[13px] font-semibold text-on-surface transition-colors hover:bg-background">
              <Icon name="download" size={15} /> Raporu Dışa Aktar
            </button>
          </div>
        </div>

        {revaluating && !ev ? (
          <div className="rounded-[18px] border border-primary/25 bg-primary/[0.04] p-10 text-center">
            <div className="brand-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md">
              <Icon name="progress_activity" size={26} className="animate-spin" filled />
            </div>
            <h3 className="mt-4 font-heading text-[18px] font-bold text-on-surface">AI yeniden değerlendiriyor…</h3>
            <p className="mx-auto mt-2 max-w-[460px] text-[14px] leading-relaxed text-on-surface-variant">
              Revize edilen fikir için fizibilite eksenleri yeniden hesaplanıyor (~10-20 sn).
            </p>
          </div>
        ) : ev ? (
          <>
            {/* Üst grid: güven göstergesi + AI önerisi */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.4fr]">
              <div className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-outline-variant bg-white p-6 text-center shadow-sm">
                <div
                  className="flex h-28 w-28 flex-col items-center justify-center rounded-full"
                  style={{ background: `${v.color}14`, border: `4px solid ${v.color}40` }}
                >
                  <span className="font-display text-[34px] font-bold leading-none" style={{ color: v.color }}>%{score}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Fizibilite</span>
                </div>
                <div className="font-heading text-[18px] font-bold" style={{ color: v.color }}>{v.label}</div>
                <p className="text-[12px] leading-relaxed text-on-surface-variant">
                  Sistem geneli veriler, mevcut parametrelerle güçlü bir başarı potansiyeline işaret ediyor.
                </p>
              </div>

              <div className="rounded-[18px] border border-primary/25 bg-primary/[0.04] p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
                    <Icon name="auto_awesome" size={24} filled />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-[17px] font-bold text-on-surface">AI Önerisi: {v.rec}</h3>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: v.recBg, color: v.recColor }}>
                        Öncelik {score >= 75 ? "Yüksek" : "Orta"}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">
                      {ev.summary || `"${idea.title}" için pazar talebi ve teknolojik olgunluk dengeli görünüyor. Detaylı eksen puanları aşağıda.`}
                    </p>
                    {ev.pivotSuggestion && (
                      <div className="mt-3 rounded-xl border border-risk/25 bg-risk/[0.06] px-3.5 py-2.5 text-[12px] text-[#8A5A00]">
                        <b>Pivot önerisi:</b> {ev.pivotSuggestion}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 çeyrek — gerçek evalScores eksenleri */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Quad title="Teknik" icon="memory" color="#1463F3" bg="rgba(20,99,243,0.10)" score={ev.technicalDifficulty * 10} label="Mimari Hazırlık" />
              <Quad title="Ticari" icon="payments" color="#157A3A" bg="rgba(34,197,94,0.10)" score={ev.commercialFeasibility * 10} label="Ticari Fizibilite" />
              <Quad title="Pazar" icon="trending_up" color="#7A5CFF" bg="rgba(122,92,255,0.10)" score={ev.marketNeed * 10} label="Pazar İhtiyacı" />
              <Quad title="Risk & Trend" icon="shield" color="#8A5A00" bg="rgba(255,176,32,0.14)" score={Math.round((ev.riskGovernance + ev.trendAlignment) / 2 * 10)} label="Risk Yönetişimi" />
            </div>

            {/* Uygulama yol haritası — gerçek roadmap */}
            {phases.length > 0 && (
              <div className="rounded-[18px] border border-outline-variant bg-white p-6 shadow-sm">
                <h3 className="mb-5 font-heading text-[17px] font-bold text-on-surface">Uygulama Yol Haritası</h3>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(phases.length, 5)}, 1fr)` }}>
                  {phases.slice(0, 5).map((p) => (
                    <div
                      key={p.n}
                      className={[
                        "rounded-xl border p-4",
                        p.state === "done" ? "border-[#20C997]/40 bg-[#20C997]/[0.06]" :
                        p.state === "current" ? "border-primary/40 bg-primary/[0.06]" :
                        "border-outline-variant bg-surface-container-low",
                      ].join(" ")}
                    >
                      <div className="font-display text-[18px] font-bold" style={{ color: p.state === "done" ? "#157A3A" : p.state === "current" ? "#1463F3" : "#94A0B8" }}>
                        {String(p.n).padStart(2, "0")}
                      </div>
                      <div className="mt-1 text-[13px] font-bold text-on-surface leading-snug">{p.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finansal senaryoya geçiş */}
            <button
              onClick={() => navigate(`/financial?id=${idea.id}`)}
              className="flex w-full items-center justify-between rounded-[16px] border border-outline-variant bg-white px-6 py-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="finance" size={20} /></div>
                <div>
                  <div className="font-heading text-[15px] font-bold text-on-surface">Finansal Senaryo Analizi</div>
                  <div className="text-[12px] text-on-surface-variant">ROI, maliyet ve gelir projeksiyonları</div>
                </div>
              </div>
              <Icon name="arrow_forward" size={18} className="text-primary" />
            </button>
          </>
        ) : (
          /* Değerlendirme yoksa — boş durum */
          <div className="hub-empty">
            <div className="ico"><Icon name="fact_check" size={26} /></div>
            <div className="t">Fizibilite verisi henüz yok</div>
            <div className="p">
              Bu fikir için AI değerlendirmesi (evalScores) henüz üretilmemiş. Kart detayındaki
              "Yeniden Değerlendir" ile AI fizibilite eksenlerini hesaplar; ardından rapor burada dolar.
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: "idea", id: idea.id } }))}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(20,99,243,0.30)] hover:bg-[#0e54d8]"
            >
              <Icon name="auto_awesome" size={15} /> Kartı Aç & Değerlendir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
