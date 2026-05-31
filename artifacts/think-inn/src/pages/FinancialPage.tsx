import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListIdeas, type Idea } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { API_ORIGIN } from "@/lib/api-config";

function Icon({ name, size = 18, filled = false, className = "", style }: {
  name: string; size?: number; filled?: boolean; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`, ...style }}
    >
      {name}
    </span>
  );
}

type Scenario = { name: string; year1Revenue?: string; year3Revenue?: string; roiPct?: number; breakEvenMonths?: number; note?: string };
type Financial = {
  summary?: string; revenueModel?: string; capex?: string; opex?: string;
  assumptions?: string[]; keyRisks?: string[]; scenarios?: Scenario[]; generatedAt?: string;
};

// Senaryo rengi/zemini
function scMeta(name: string) {
  const n = (name || "").toLowerCase();
  if (/(iyimser|iyi|optim)/.test(n)) return { c: "#16A34A", bg: "rgba(22,163,74,0.06)" };
  if (/(kötü|kotu|pesim|olumsuz)/.test(n)) return { c: "#EF4444", bg: "rgba(239,68,68,0.05)" };
  return { c: "#1463F3", bg: "rgba(20,99,243,0.05)" };
}

/* Risk maddesi — (admin) kullanıcının gireceği araştırma/yöntemle AI değerlendirir → Giderildi/Azaltıldı/Açık */
function RiskItem({ ideaId, risk, logged, isAdmin, onDone }: {
  ideaId: number; risk: string; logged?: any; isAdmin: boolean; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(logged || null);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${ideaId}/mitigate-risk`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ risk, mitigation: text, scope: "financial" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Değerlendirilemedi");
      setResult(j); setOpen(false); setText(""); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Bir hata oluştu"); }
    finally { setBusy(false); }
  };

  const VB: Record<string, { label: string; color: string; bg: string }> = {
    resolved: { label: "Giderildi", color: "#0F8C66", bg: "rgba(22,163,74,0.12)" },
    reduced: { label: "Azaltıldı", color: "#8A5A00", bg: "rgba(255,176,32,0.18)" },
    open: { label: "Açık", color: "#B0292B", bg: "rgba(239,68,68,0.10)" },
  };
  const v = result ? VB[result.verdict] : null;

  return (
    <li className="rounded-xl border border-[#FFE2AE] bg-white/70 p-3">
      <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-on-surface">
        <Icon name="error" size={15} className="mt-0.5 shrink-0" style={{ color: result?.verdict === "resolved" ? "#0F8C66" : "#FFB020" }} filled />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span style={result?.verdict === "resolved" ? { textDecoration: "line-through", opacity: 0.7 } : undefined}>{risk}</span>
            {v && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: v.color, background: v.bg }}>{v.label}</span>}
          </div>
          {result?.rationale && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-on-surface-variant">
              <b style={{ color: v?.color }}>AI:</b> {result.rationale}{result.residualRisk ? ` · Kalan: ${result.residualRisk}` : ""}
            </p>
          )}
          {isAdmin && !open && (
            <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline">
              <Icon name="science" size={13} />{result ? "Yeniden araştırma/yöntem gir" : "Araştırma/yöntemle gider"}
            </button>
          )}
          {isAdmin && open && (
            <div className="mt-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
                placeholder="Bu riski azaltacak araştırma / yöntem / önlem… (örn. 'KVKK için hukuk görüşü + anonimleştirme + pilot denetim')"
                className="w-full resize-none rounded-lg border border-outline-variant bg-white px-3 py-2 text-[12.5px] text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15" />
              {err && <p className="mt-1 text-[11.5px] text-error">{err}</p>}
              <div className="mt-1.5 flex gap-2">
                <button onClick={submit} disabled={busy || !text.trim()} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-[#0e54d8] disabled:opacity-60">
                  {busy ? <Icon name="progress_activity" size={13} className="animate-spin" /> : <Icon name="science" size={13} />}{busy ? "Değerlendiriliyor…" : "AI ile Değerlendir"}
                </button>
                <button onClick={() => { setOpen(false); setText(""); setErr(null); }} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:bg-background">İptal</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function FinancialPage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { data: ideaList } = useListIdeas();
  const { user } = useAuth();
  const isAdmin = !!user;
  const qc = useQueryClient();

  const id = useMemo(() => Number(new URLSearchParams(searchStr).get("id")), [searchStr]);
  const idea = (ideaList ?? []).find((i) => i.id === id) as Idea | undefined;
  const fin = (idea as any)?.architecturalAnalysis?.financial as Financial | undefined;
  const riskLog = (((idea as any)?.architecturalAnalysis?.riskLog as any[]) ?? []);

  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState(false);

  const generate = useCallback(async () => {
    if (!idea || generating) return;
    setErr(false);
    setGenerating(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/generate-financial`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
    } catch { setGenerating(false); setErr(true); }
  }, [idea, generating]);

  // Üretim sürerken listeyi tazele; finansal gelince dur. ~2 dk güvenlik.
  useEffect(() => {
    if (!generating) return;
    const iv = setInterval(() => qc.invalidateQueries({ queryKey: ["/api/ideas"] }), 4000);
    const stop = setTimeout(() => setGenerating(false), 120000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [generating, qc]);
  useEffect(() => { if (generating && fin) setGenerating(false); }, [fin, generating]);

  if (!idea) {
    return (
      <div className="min-h-full bg-background">
        <div className="mx-auto max-w-[1100px] px-10 pt-7">
          <button onClick={() => navigate("/projects")} className="mb-6 flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-primary">
            <Icon name="arrow_back" size={16} /> Projelere dön
          </button>
          <div className="hub-empty"><div className="ico"><Icon name="finance" size={26} /></div>
            <div className="t">Proje bulunamadı</div>
            <div className="p">Finansal senaryo için geçerli bir proje seç.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-[1200px] space-y-6 px-10 pb-16 pt-7">
        <button onClick={() => navigate(`/feasibility?id=${idea.id}`)} className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary">
          <Icon name="arrow_back" size={16} /> Fizibiliteye dön
        </button>

        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[12px] text-on-surface-variant">Projeler &gt; Fizibilite &gt; <b className="text-on-surface">Finansal</b></div>
            <h1 className="mt-1 font-display text-[32px] font-bold tracking-[-0.02em] text-on-surface">{idea.title}</h1>
            <div className="mt-1 text-[13px] text-on-surface-variant">Finansal Senaryo Analizi</div>
          </div>
          {isAdmin && fin && (
            <button onClick={generate} disabled={generating} className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-4 py-2 text-[13px] font-semibold text-primary transition-all hover:bg-primary/[0.14] disabled:opacity-60">
              <Icon name={generating ? "progress_activity" : "refresh"} size={16} className={generating ? "animate-spin" : ""} />
              {generating ? "Üretiliyor…" : "Yenile"}
            </button>
          )}
        </div>

        {/* Üretiliyor */}
        {generating && !fin ? (
          <div className="rounded-[18px] border border-primary/25 bg-primary/[0.04] p-10 text-center">
            <div className="brand-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md">
              <Icon name="progress_activity" size={26} className="animate-spin" filled />
            </div>
            <h3 className="mt-4 font-heading text-[18px] font-bold text-on-surface">Finansal senaryolar üretiliyor…</h3>
            <p className="mx-auto mt-2 max-w-[460px] text-[14px] leading-relaxed text-on-surface-variant">
              AI; mimari analiz ve değerlendirme skorlarını kullanarak iyimser/baz/kötümser senaryoları, ROI ve başabaş tahminlerini hazırlıyor (~1 dk).
            </p>
          </div>
        ) : fin && fin.scenarios && fin.scenarios.length > 0 ? (
          <>
            {/* Özet */}
            {fin.summary && (
              <div className="rounded-[18px] border border-outline-variant bg-white p-6">
                <p className="overline mb-2 flex items-center gap-1.5 text-primary"><Icon name="insights" size={14} />Yönetici Özeti</p>
                <p className="text-[14px] leading-relaxed text-on-surface">{fin.summary}</p>
              </div>
            )}

            {/* Senaryolar */}
            <div>
              <p className="overline mb-3">Finansal Senaryolar</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {fin.scenarios.map((s, i) => {
                  const m = scMeta(s.name);
                  return (
                    <div key={i} className="rounded-[18px] border bg-white p-5" style={{ borderColor: `${m.c}40`, background: m.bg }}>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: m.c }} />
                        <span className="font-heading text-[15px] font-bold text-on-surface">{s.name}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div><div className="overline">1. Yıl Gelir</div><div className="mt-0.5 font-display text-[18px] font-bold text-on-surface">{s.year1Revenue ?? "—"}</div></div>
                        <div><div className="overline">3. Yıl Gelir</div><div className="mt-0.5 font-display text-[18px] font-bold text-on-surface">{s.year3Revenue ?? "—"}</div></div>
                        <div><div className="overline">ROI (24 ay)</div><div className="mt-0.5 font-display text-[18px] font-bold" style={{ color: m.c }}>{s.roiPct != null ? `%${s.roiPct}` : "—"}</div></div>
                        <div><div className="overline">Başabaş</div><div className="mt-0.5 font-display text-[18px] font-bold text-on-surface">{s.breakEvenMonths != null ? `${s.breakEvenMonths} ay` : "—"}</div></div>
                      </div>
                      {s.note && <p className="mt-3 text-[12px] leading-relaxed text-on-surface-variant">{s.note}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gelir modeli / CAPEX / OPEX */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                { l: "Gelir Modeli", v: fin.revenueModel, icon: "payments" },
                { l: "CAPEX (Yatırım)", v: fin.capex, icon: "account_balance" },
                { l: "OPEX (İşletme)", v: fin.opex, icon: "receipt_long" },
              ].map((x) => x.v && (
                <div key={x.l} className="rounded-[16px] border border-outline-variant bg-white p-5">
                  <div className="mb-2 flex items-center gap-2 text-primary"><Icon name={x.icon} size={16} /><span className="font-heading text-[13px] font-bold text-on-surface">{x.l}</span></div>
                  <p className="text-[13px] leading-relaxed text-on-surface-variant">{x.v}</p>
                </div>
              ))}
            </div>

            {/* Varsayımlar + Riskler */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {fin.assumptions && fin.assumptions.length > 0 && (
                <div className="rounded-[16px] border border-outline-variant bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-primary"><Icon name="rule" size={16} /><span className="font-heading text-[14px] font-bold text-on-surface">Temel Varsayımlar</span></div>
                  <ul className="space-y-2">
                    {fin.assumptions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-on-surface">
                        <Icon name="check_circle" size={15} className="mt-0.5 shrink-0 text-[#16A34A]" filled /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fin.keyRisks && fin.keyRisks.length > 0 && (
                <div className="rounded-[16px] border p-5" style={{ borderColor: "rgba(255,176,32,0.30)", background: "rgba(255,176,32,0.05)" }}>
                  <div className="mb-3 flex items-center gap-2" style={{ color: "#8A5A00" }}><Icon name="warning" size={16} /><span className="font-heading text-[14px] font-bold text-on-surface">Finansal Riskler</span></div>
                  <ul className="space-y-2">
                    {fin.keyRisks.map((r, i) => {
                      const logged = riskLog.filter((e: any) => e?.risk === r).pop();
                      return (
                        <RiskItem
                          key={i}
                          ideaId={idea!.id}
                          risk={r}
                          logged={logged}
                          isAdmin={isAdmin}
                          onDone={() => qc.invalidateQueries({ queryKey: ["/api/ideas"] })}
                        />
                      );
                    })}
                  </ul>
                  {isAdmin && (
                    <p className="mt-2.5 text-[11px] leading-relaxed text-on-surface-variant">
                      Bir riski araştırma veya yöntemle ele al; AI önlemini değerlendirip "Giderildi / Azaltıldı / Açık" olarak işaretler.
                    </p>
                  )}
                </div>
              )}
            </div>

            {fin.generatedAt && (
              <p className="text-[11px] text-outline">
                {new Date(fin.generatedAt).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} tarihli AI finansal analizi
              </p>
            )}
          </>
        ) : (
          // Henüz finansal yok
          <div className="rounded-[18px] border border-primary/25 bg-primary/[0.04] p-8 text-center">
            <div className="brand-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md">
              <Icon name="finance" size={26} filled />
            </div>
            <h3 className="mt-4 font-heading text-[20px] font-bold text-on-surface">Finansal senaryo henüz üretilmedi</h3>
            <p className="mx-auto mt-2 max-w-[480px] text-[14px] leading-relaxed text-on-surface-variant">
              AI; mimari analiz ve değerlendirme skorlarını kullanarak <b>iyimser / baz / kötümser</b> senaryolar, ROI projeksiyonu, CAPEX/OPEX ve başabaş noktası üretir.
            </p>
            {err && <p className="mt-3 text-[13px] font-medium text-error">Üretim başlatılamadı. Tekrar dene.</p>}
            {isAdmin ? (
              <button onClick={generate} disabled={generating} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8] disabled:opacity-60">
                <Icon name={generating ? "progress_activity" : "auto_awesome"} size={18} className={generating ? "animate-spin" : ""} />
                {generating ? "Üretiliyor…" : "Finansal Senaryo Üret"}
              </button>
            ) : (
              <p className="mt-4 text-[12px] text-outline">Bu analiz yönetici tarafından üretildiğinde burada görünecek.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
