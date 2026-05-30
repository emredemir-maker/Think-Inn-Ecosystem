import { useMemo } from "react";
import { useLocation } from "wouter";
import { useListResearch, useListIdeas, type Idea, type Research } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import ConceptStrip from "@/components/brand/ConceptStrip";

/* Material Symbols ikon helper */
function Icon({
  name,
  size = 20,
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
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

/* KPI Tile — Hub UI Kit pattern */
type KpiKind = "idea" | "research" | "health" | "urgent";

const KPI_KIND: Record<KpiKind, { iconBg: string; iconColor: string; pillBg: string; pillColor: string }> = {
  idea:     { iconBg: "rgba(20,99,243,0.08)", iconColor: "#1463F3", pillBg: "rgba(34,197,94,0.12)",  pillColor: "#157A3A" },
  research: { iconBg: "rgba(24,201,232,0.10)", iconColor: "#0A8FA8", pillBg: "rgba(20,99,243,0.10)",  pillColor: "#0E54D8" },
  health:   { iconBg: "rgba(34,197,94,0.10)",  iconColor: "#157A3A", pillBg: "rgba(122,92,255,0.12)", pillColor: "#5B3FE0" },
  urgent:   { iconBg: "rgba(239,68,68,0.10)",  iconColor: "#B0292B", pillBg: "rgba(239,68,68,0.12)",  pillColor: "#B0292B" },
};

function KpiTile({
  icon,
  kind,
  label,
  value,
  suffix,
  pill,
}: {
  icon: string;
  kind: KpiKind;
  label: string;
  value: string | number;
  suffix?: string;
  pill: string;
}) {
  const meta = KPI_KIND[kind];
  return (
    <div className="relative flex min-h-[156px] flex-col gap-[18px] rounded-[18px] border border-outline-variant bg-white p-[22px] shadow-[0_1px_2px_rgba(7,27,58,0.04)] transition-all duration-200 hover:border-outline-strong hover:shadow-[0_8px_22px_rgba(7,27,58,0.06)]">
      <div className="flex items-start justify-between">
        <div
          className="flex h-[46px] w-[46px] items-center justify-center rounded-[12px]"
          style={{ background: meta.iconBg, color: meta.iconColor }}
        >
          <Icon name={icon} size={22} />
        </div>
        <span
          className="rounded-full px-2.5 py-[5px] text-[10px] font-bold tracking-[0.04em]"
          style={{ background: meta.pillBg, color: meta.pillColor }}
        >
          {pill}
        </span>
      </div>
      <div className="mt-auto">
        <div className="overline mb-2">{label}</div>
        <div className="font-display text-[40px] font-bold leading-none tracking-[-0.02em] text-on-surface">
          {value}
          {suffix && <span className="text-[16px] font-semibold text-on-surface-variant">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

/* İnovasyon Hattı — GERÇEK ilerleme hunisi (idea.status değil, gerçek sinyaller).
 * Her fikir ulaştığı EN İLERİ aşamaya düşer. */
const PIPELINE_STAGES = [
  { id: "new",       name: "Yeni Fikir" },
  { id: "evaluated", name: "Değerlendirildi" },
  { id: "project",   name: "Proje" },
  { id: "prototype", name: "Prototip" },
  { id: "launch",    name: "Lansman" },
] as const;

/* Bir fikrin inovasyon hattındaki aşaması — gerçek alanlardan türetilir */
function ideaStage(i: Idea): string {
  const aa = (i as any).architecturalAnalysis;
  const hasProto = !!aa?.prototype?.url || (i.status as string) === "prototype";
  const launched = (i as any).projectStatus === "tamamlandi" || (i.status as string) === "merged";
  if (launched) return "launch";
  if (hasProto) return "prototype";
  if (aa) return "project";
  if ((i as any).evaluationScores) return "evaluated";
  return "new";
}

/* DashboardPage — Hub UI Kit executive view */
export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = !!user;
  const { data: researchList, isLoading: researchLoading } = useListResearch();
  const { data: ideaList, isLoading: ideasLoading } = useListIdeas();

  // Kullanıcı adından sadece ilk ismi al (Caner Yıldırım → Caner)
  const firstName = useMemo(() => {
    const name = user?.displayName || user?.username || "İnovatör";
    return name.split(/\s+/)[0];
  }, [user]);

  const research = researchList ?? [];
  const ideas = ideaList ?? [];

  // KPI hesaplamaları (gerçek veri — mock yok)
  const totalProjects = useMemo(
    () => ideas.filter((i) => !!(i as any).architecturalAnalysis).length,
    [ideas]
  );

  const totalVotes = useMemo(
    () => research.reduce((s, r) => s + (r.voteCount ?? 0), 0) + ideas.reduce((s, i) => s + (i.voteCount ?? 0), 0),
    [research, ideas]
  );

  const healthScore = useMemo(() => {
    // Gerçek skor: bağlantı yoğunluğu + araştırma desteği oranı
    if (research.length === 0 && ideas.length === 0) return 0;
    const ideasWithResearch = ideas.filter((i) => (i.researchIds?.length ?? 0) > 0).length;
    const ideasWithLinks = ideas.filter((i) => (i.relatedTo?.length ?? 0) > 0).length;
    const ratioResearch = ideas.length ? ideasWithResearch / ideas.length : 0;
    const ratioLinks = ideas.length ? ideasWithLinks / ideas.length : 0;
    return Math.round((ratioResearch * 50 + ratioLinks * 50) * 100) / 100 * 1; // 0-100
  }, [ideas, research.length]);

  const urgentCount = useMemo(
    () => ideas.filter((i) => (i.researchIds?.length ?? 0) === 0).length,
    [ideas]
  );

  // Pipeline — gerçek ilerleme hunisi (ideaStage). Her fikir tek aşamada.
  const pipelineByStage = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const items = ideas.filter((i) => ideaStage(i as Idea) === stage.id);
      const total = ideas.length || 1;
      const progress = Math.round((items.length / total) * 100);
      return { ...stage, items, progress };
    });
  }, [ideas]);

  // Pipeline kartına tıklanınca doğru yüzle aç (proje/prototip/lansman → proje, diğer → fikir)
  const openItem = (i: Idea) => {
    const view = (i as any).architecturalAnalysis ? "project" : "idea";
    window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: "idea", id: i.id, view } }));
  };

  // AI Insights — gerçek tag aggregation
  const trendTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of research) {
      for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    for (const i of ideas) {
      for (const t of i.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [research, ideas]);

  // Featured project — en yüksek skor + analysis
  const featuredProject = useMemo(() => {
    const withAnalysis = ideas.filter((i) => !!(i as any).architecturalAnalysis);
    return [...withAnalysis].sort(
      (a, b) =>
        (b.voteCount ?? 0) +
        (b.relatedTo?.length ?? 0) +
        (b.researchIds?.length ?? 0) -
        ((a.voteCount ?? 0) + (a.relatedTo?.length ?? 0) + (a.researchIds?.length ?? 0))
    )[0];
  }, [ideas]);

  // Recent activity — son eklenen 3 öğe (idea+research karışık)
  const recentActivity = useMemo(() => {
    const combined: Array<{
      kind: "idea" | "research" | "project";
      title: string;
      author: string;
      createdAt: Date;
      id: number;
    }> = [
      ...research.map((r) => ({
        kind: "research" as const,
        title: r.title,
        author: r.authorName,
        createdAt: new Date(r.createdAt),
        id: r.id,
      })),
      ...ideas.map((i) => ({
        kind: (i as any).architecturalAnalysis ? ("project" as const) : ("idea" as const),
        title: i.title,
        author: i.authorName,
        createdAt: new Date(i.createdAt),
        id: i.id,
      })),
    ];
    return combined
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3);
  }, [research, ideas]);

  const isEmpty = !ideasLoading && !researchLoading && research.length === 0 && ideas.length === 0;

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-7 px-10 pb-16 pt-7">
        {/* ===== Welcome row ===== */}
        <section className="flex items-start justify-between gap-6">
          <div className="max-w-[760px]">
            <h1 className="font-display text-[48px] font-bold leading-[1.05] tracking-[-0.025em] text-primary">
              Hoş Geldin, <span className="text-on-surface">{firstName}</span>
            </h1>
            <p className="mt-2.5 max-w-[700px] text-[15px] leading-[1.55] text-on-surface-variant">
              Ekosisteminizde{" "}
              <span className="font-bold text-on-surface">{research.length}</span> araştırma düğümü,{" "}
              <span className="font-bold text-on-surface">{ideas.length}</span> fikir ve{" "}
              <span className="font-bold text-on-surface">{totalProjects}</span> aktif proje var.
              İşte inovasyon merkezinizden son durum.
            </p>
          </div>
          {isAdmin && (
            <button className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-primary/25 bg-primary/[0.08] px-5 py-[11px] text-[13px] font-semibold text-primary transition-all duration-200 hover:bg-primary/[0.14]">
              <Icon name="ios_share" size={16} />
              Rapor dışa aktar
            </button>
          )}
        </section>

        {/* ===== Konsept şeridi — hero altı (logo konsept sayfasındaki 5 belirteç) ===== */}
        <ConceptStrip variant="hero" />

        {/* ===== KPI row ===== */}
        <section className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            icon="rocket_launch"
            kind="idea"
            label="Aktif İnovasyon Projeleri"
            value={totalProjects}
            pill={totalProjects > 0 ? `${totalProjects} canlı` : "Henüz yok"}
          />
          <KpiTile
            icon="hub"
            kind="research"
            label="Araştırma Düğümleri"
            value={research.length}
            pill="Canlı izleme"
          />
          <KpiTile
            icon="monitor_heart"
            kind="health"
            label="Ekosistem Sağlık Skoru"
            value={healthScore}
            suffix="/100"
            pill="AI Score"
          />
          <KpiTile
            icon="priority_high"
            kind="urgent"
            label="Araştırmasız Fikirler"
            value={urgentCount}
            pill={urgentCount > 0 ? "Acil" : "Temiz"}
          />
        </section>

        {/* ===== Pipeline + AI Panel grid ===== */}
        <section className="grid grid-cols-1 gap-[18px] lg:grid-cols-[2fr_1fr]">
          {/* Pipeline */}
          <div className="rounded-[18px] border border-outline-variant bg-white p-[22px] shadow-[0_1px_2px_rgba(7,27,58,0.04)]">
            <div className="mb-[18px] flex items-center justify-between">
              <h2 className="font-heading text-[18px] font-bold text-on-surface">
                İnovasyon Hattı
              </h2>
              <div className="flex items-center gap-3.5">
                <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                  <span className="size-2 rounded-full bg-primary" />
                  Stratejik
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                  <span className="size-2 rounded-full" style={{ background: "#20C997" }} />
                  Operasyonel
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3.5">
              {pipelineByStage.map((stage) => {
                const active = stage.items.length > 0;
                return (
                  <div key={stage.id}>
                    {/* Progress bar */}
                    <div className="mb-3 h-1 overflow-hidden rounded-full bg-[#E2E8F4]">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                    {/* Stage name + count — uzun TR etiketler taşmasın diye küçük, sarabilen, min-w-0 */}
                    <div className="mb-3 flex min-h-[28px] items-start justify-between gap-1.5">
                      <span
                        className={`min-w-0 text-[9px] font-bold uppercase leading-[1.15] tracking-[0.06em] ${active ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        {stage.name}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                        style={active ? { background: "rgba(20,99,243,0.10)", color: "#0E54D8" } : { background: "#EEF2FB", color: "#94A0B8" }}
                      >
                        {stage.items.length}
                      </span>
                    </div>
                    {/* Stage cards */}
                    <div className="flex flex-col gap-2.5">
                      {stage.items.length === 0 ? (
                        <div className="min-h-[78px] rounded-[12px] border border-dashed border-outline-variant bg-background/40 p-3 text-[12px] text-on-surface-variant/70">
                          Boş
                        </div>
                      ) : (
                        stage.items.slice(0, 2).map((idea) => (
                          <button
                            key={idea.id}
                            onClick={() => openItem(idea as Idea)}
                            className={[
                              "relative flex min-h-[78px] flex-col justify-between rounded-[12px] border p-3 text-left text-[13px] font-semibold leading-[1.3] text-on-surface transition-all duration-200",
                              active
                                ? "border-primary/25 bg-primary/[0.06] hover:border-primary/40"
                                : "border-outline-variant bg-background/60 hover:border-outline-strong",
                            ].join(" ")}
                          >
                            <span className="line-clamp-2 pr-4">{idea.title}</span>
                            <div className="mt-auto flex items-center gap-1 text-[10px] font-medium text-on-surface-variant">
                              <Icon name="person" size={11} />
                              <span className="truncate">{idea.authorName}</span>
                            </div>
                          </button>
                        ))
                      )}
                      {stage.items.length > 2 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          +{stage.items.length - 2} daha
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Panel — 3 vertical insight cards (tasarımdaki gibi) */}
          <div
            className="rounded-[18px] border p-[22px] shadow-[0_8px_24px_rgba(20,99,243,0.08)]"
            style={{
              borderColor: "rgba(20,99,243,0.30)",
              background:
                "radial-gradient(circle at 90% 0%, rgba(122,92,255,0.06), transparent 60%), #FFFFFF",
            }}
          >
            <div className="mb-[18px] flex items-center gap-2.5">
              <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm">
                <Icon name="auto_awesome" size={16} filled />
              </div>
              <h2 className="font-heading text-[18px] font-bold text-on-surface">
                think-Inn AI Analizi
              </h2>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Insight 1 — Kritik Bağlantı (Eksik) */}
              <div className="rounded-[14px] border border-primary/15 bg-background p-4">
                <div className="font-heading text-[13px] font-bold text-on-surface">
                  Kritik Bağlantı Önerisi
                </div>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant">
                  {urgentCount > 0 ? (
                    <>
                      <span className="font-bold text-on-surface">{urgentCount}</span> fikir
                      hâlâ araştırma desteğine bağlı değil. Bunlardan birine kaynak eşleştirerek{" "}
                      sağlık skorunu artırabilirsiniz.
                    </>
                  ) : research.length > 0 && ideas.length === 0 ? (
                    <>
                      Kütüphanenizde <span className="font-bold text-on-surface">{research.length}</span>{" "}
                      araştırma var ama henüz fikir bağlanmamış. AI Workspace'te ilk fikrinizi bağlayalım.
                    </>
                  ) : (
                    <>Tüm fikirler araştırma desteğine sahip — bağlantı yapısı sağlıklı.</>
                  )}
                </p>
              </div>

              {/* Insight 2 — Kaynak Sinerjisi (Tag Cluster) */}
              <div className="rounded-[14px] border border-primary/15 bg-background p-4">
                <div className="font-heading text-[13px] font-bold text-on-surface">
                  Kaynak Sinerjisi
                </div>
                {trendTags.length > 0 ? (
                  <>
                    <p className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant">
                      En yoğun konu kümesi:{" "}
                      <span className="font-bold text-primary">#{trendTags[0][0]}</span>{" "}
                      ({trendTags[0][1]} kayıt).
                      {trendTags.length > 1 && (
                        <>
                          {" "}İkinci sırada{" "}
                          <span className="font-bold text-on-surface">#{trendTags[1][0]}</span> geliyor.
                        </>
                      )}{" "}
                      Bu konularda çapraz araştırma değerli olabilir.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {trendTags.slice(0, 4).map(([tag, count]) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.08] px-2 py-0.5 text-[10px] font-bold text-primary"
                        >
                          #{tag}
                          <span className="text-[9px] opacity-70">{count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant">
                    Konu kümeleri tespit edilemedi — etiketli içerik biriktikçe burada öne çıkanlar görünecek.
                  </p>
                )}
              </div>

              {/* Insight 3 — Pazar / Aktivite Fırsatı */}
              <div className="rounded-[14px] border border-primary/15 bg-background p-4">
                <div className="font-heading text-[13px] font-bold text-on-surface">
                  {totalProjects > 0 ? "Pazar Fırsatı" : "Sıradaki Adım"}
                </div>
                <p className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant">
                  {totalProjects > 0 ? (
                    <>
                      <span className="font-bold text-on-surface">{totalProjects}</span> projeniz mimari
                      analize dönüşmüş. Bunların{" "}
                      <span className="font-bold text-secondary">en bağlantılısı</span> Featured Project
                      kartında öne çıkarıldı.
                    </>
                  ) : ideas.length > 0 ? (
                    <>
                      Mimari analize dönmüş proje yok. Bir fikir kartında <em>"Analiz Oluştur"</em>'a
                      tıklayarak proje pipeline'ına alabilirsiniz.
                    </>
                  ) : (
                    <>
                      Ekosistem henüz boş. AI asistanına bir araştırma metni yapıştırarak başlayın —
                      AI otomatik kart oluşturur.
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/workspace")}
              className="mt-4 flex w-full items-center justify-between text-[13px] font-semibold text-primary hover:underline"
            >
              <span>Tüm AI Raporlarını Gör</span>
              <Icon name="arrow_forward" size={16} />
            </button>
          </div>
        </section>

        {/* ===== Lower row: Featured + Activity + Map preview ===== */}
        <section className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.05fr_1.15fr_1fr]">
          {/* Featured project */}
          <div className="rounded-[18px] border border-outline-variant bg-white p-[22px] shadow-[0_1px_2px_rgba(7,27,58,0.04)]">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-2.5 py-[5px] text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#0E54D8]">
                Öne Çıkan
              </span>
              {featuredProject && (
                <Icon name="arrow_outward" size={18} className="text-on-surface-variant" />
              )}
            </div>
            {featuredProject ? (
              <>
                <h4 className="mt-1 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.015em] text-on-surface">
                  {featuredProject.title}
                </h4>
                <p className="mb-[18px] mt-2.5 line-clamp-3 text-[13px] leading-[1.55] text-on-surface-variant">
                  {featuredProject.description}
                </p>
                <div className="grid grid-cols-2 gap-3.5 border-t border-outline-variant pt-4">
                  <div>
                    <div className="overline mb-1">Skor</div>
                    <div className="font-display text-[22px] font-bold tracking-[-0.01em] text-primary">
                      {(featuredProject.voteCount ?? 0) +
                        (featuredProject.relatedTo?.length ?? 0) +
                        (featuredProject.researchIds?.length ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="overline mb-1">Bağlantı</div>
                    <div className="flex items-center gap-1.5 font-display text-[22px] font-bold tracking-[-0.01em] text-on-surface">
                      <Icon name="hub" size={18} className="text-secondary" />
                      {featuredProject.relatedTo?.length ?? 0}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/projects")}
                  className="mt-[18px] w-full rounded-[12px] border border-primary/25 bg-primary/[0.08] py-[11px] text-[13px] font-semibold text-primary transition-all hover:bg-primary/[0.14]"
                >
                  Mimari Analizi Aç
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Icon name="rocket_launch" size={40} className="text-primary/40" />
                <p className="mt-3 text-[13px] text-on-surface-variant">
                  Henüz mimari analize dönüşen proje yok.
                </p>
                {isAdmin && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))}
                    className="mt-3 text-[12px] font-bold uppercase tracking-wider text-primary hover:underline"
                  >
                    AI Asistanı ile Başla
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="rounded-[18px] border border-outline-variant bg-white p-[22px] shadow-[0_1px_2px_rgba(7,27,58,0.04)]">
            <div className="mb-[18px] flex items-center justify-between">
              <h2 className="font-heading text-[18px] font-bold text-on-surface">
                Son Hareketler
              </h2>
              <Icon name="history" size={18} className="text-on-surface-variant" />
            </div>
            {recentActivity.length > 0 ? (
              <div className="flex flex-col gap-[18px]">
                {recentActivity.map((a) => {
                  const meta =
                    a.kind === "research"
                      ? { bg: "rgba(24,201,232,0.10)", border: "rgba(24,201,232,0.30)", color: "#0A8FA8", icon: "biotech" }
                      : a.kind === "project"
                      ? { bg: "rgba(122,92,255,0.10)", border: "rgba(122,92,255,0.30)", color: "#5B3FE0", icon: "account_tree" }
                      : { bg: "rgba(20,99,243,0.10)", border: "rgba(20,99,243,0.30)", color: "#1463F3", icon: "lightbulb" };
                  return (
                    <div key={`${a.kind}-${a.id}`} className="flex gap-3.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
                        style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}
                      >
                        <Icon name={meta.icon} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-[1.5] text-on-surface-variant">
                          <span className="font-semibold text-on-surface">{a.author}</span> bir{" "}
                          <span className="font-semibold" style={{ color: meta.color }}>
                            {a.kind === "research" ? "araştırma" : a.kind === "project" ? "proje" : "fikir"}
                          </span>{" "}
                          ekledi: <span className="font-semibold text-on-surface">{a.title}</span>
                        </p>
                        <p className="overline mt-1 text-[10px]">
                          {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Icon name="schedule" size={36} className="mx-auto text-on-surface-variant/40" />
                <p className="mt-2 text-[13px] text-on-surface-variant">Henüz hareket yok</p>
              </div>
            )}
          </div>

          {/* Map preview */}
          <div className="rounded-[18px] border border-outline-variant bg-white p-[22px] shadow-[0_1px_2px_rgba(7,27,58,0.04)]">
            <div className="mb-[18px] flex items-center justify-between">
              <h2 className="font-heading text-[18px] font-bold text-on-surface">
                Ekosistem Haritası
              </h2>
              <button
                onClick={() => navigate("/map")}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant transition-colors hover:border-outline-strong"
                title="Haritaya git"
              >
                <Icon name="open_in_full" size={14} />
              </button>
            </div>

            <div
              className="relative h-[200px] overflow-hidden rounded-[14px]"
              style={{
                background:
                  "radial-gradient(circle at 50% 60%, #EEF2FB 0%, #F4F7FE 60%, #F4F7FE 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(20,99,243,0.18) 1px, transparent 1px)",
                  backgroundSize: "14px 14px",
                }}
              />
              {/* Mini node pills */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="flex flex-col items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] shadow-md">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {ideas.length} fikir
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_1px_1fr] gap-3.5 border-t border-outline-variant pt-4">
              <div className="flex flex-col items-center gap-1">
                <div className="font-display text-[26px] font-bold tracking-[-0.01em] text-on-surface">
                  {ideas.length + research.length}
                </div>
                <div className="overline">Düğüm</div>
              </div>
              <div className="bg-input" />
              <div className="flex flex-col items-center gap-1">
                <div className="font-display text-[26px] font-bold tracking-[-0.01em] text-on-surface">
                  {ideas.reduce((s, i) => s + (i.relatedTo?.length ?? 0), 0)}
                </div>
                <div className="overline">Bağlantı</div>
              </div>
            </div>
          </div>
        </section>

        {/* Empty state — DB tamamen boşsa */}
        {isEmpty && (
          <section className="mt-2 rounded-[18px] border border-dashed border-outline-variant bg-white/60 p-12 text-center">
            <Icon name="rocket_launch" size={48} className="mx-auto text-primary/50" />
            <h3 className="mt-3 font-heading text-[20px] font-bold text-on-surface">
              Ekosistem henüz boş
            </h3>
            <p className="mt-1.5 text-[14px] text-on-surface-variant">
              {isAdmin
                ? "AI asistanına bir fikir veya araştırma paylaş — ilk düğümün burada beliriverecek."
                : "İçerikler hazırlanıyor. Yakında fikirler, araştırmalar ve projeler burada görünecek."}
            </p>
            {isAdmin && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))}
                className="mt-5 inline-flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
              >
                <Icon name="auto_awesome" size={16} />
                AI Asistanı ile Başla
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
