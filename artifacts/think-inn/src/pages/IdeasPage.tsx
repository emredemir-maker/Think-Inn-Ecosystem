import { useMemo, useState } from "react";
import { useListIdeas, type Idea } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";

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
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

/* Gerçek maturity skoru (0-100) — mock yok.
 * evaluationScores varsa 5 eksenin ortalaması × 10.
 * yoksa bağlantı yoğunluğundan türetilir. */
function maturityOf(idea: Idea): number {
  const ev = (idea as any).evaluationScores as
    | {
        commercialFeasibility: number;
        marketNeed: number;
        technicalDifficulty: number;
        trendAlignment: number;
        riskGovernance: number;
      }
    | null;
  if (ev) {
    const avg =
      (ev.commercialFeasibility +
        ev.marketNeed +
        ev.technicalDifficulty +
        ev.trendAlignment +
        ev.riskGovernance) /
      5;
    return Math.round(avg * 10);
  }
  const votes = idea.voteCount ?? 0;
  const rels = idea.relatedTo?.length ?? 0;
  const research = idea.researchIds?.length ?? 0;
  return Math.min(95, votes * 5 + rels * 10 + research * 10);
}

const FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "mature", label: "Olgun (75%+)" },
  { id: "rising", label: "Yükselen" },
  { id: "new", label: "Yeni" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function IdeasPage() {
  const { data: ideaList, isLoading } = useListIdeas();
  const { user } = useAuth();
  const isAdmin = !!user;
  // Tüm fikirler görünür (projeleşenler dahil — hiçbir şey kaybolmaz). Projeleşmiş bir kayıt
  // Fikirler'de FİKİR kartı (skor + kullanım akışı), Projeler'de PROJE kartı olarak açılır.
  const ideas = ideaList ?? [];

  const [filter, setFilter] = useState<FilterId>("all");

  // maturity'e göre azalan sırala + filtrele
  const items = useMemo(() => {
    const withScore = ideas.map((i) => ({ idea: i, maturity: maturityOf(i as Idea) }));
    const filtered = withScore.filter(({ maturity }) => {
      if (filter === "all") return true;
      if (filter === "mature") return maturity >= 75;
      if (filter === "rising") return maturity >= 50 && maturity < 75;
      return maturity < 50;
    });
    return filtered.sort((a, b) => b.maturity - a.maturity);
  }, [ideas, filter]);

  const openCard = (id: number) => {
    window.dispatchEvent(
      // Fikirler'den açılır → her zaman FİKİR yüzü (analiz olsa bile proje kartına geçmez)
      new CustomEvent("think-inn:open-card", { detail: { type: "idea", id, view: "idea" } })
    );
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-10 pb-16 pt-7">
        {/* Page head */}
        <div className="page-head">
          <div className="l">
            <span className="eyebrow">Fikir Kütüphanesi</span>
            <h1>Fikirler</h1>
            <p>Çalışanların paylaştığı, AI'ın yapılandırdığı tüm fikirler. Olgunlaştıkça projeye dönüşür.</p>
          </div>
          {isAdmin && (
            <div className="page-actions">
              <button className="icon-btn" aria-label="Filtre">
                <Icon name="tune" size={18} />
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))
                }
                className="flex items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
              >
                <Icon name="add" size={16} />
                Yeni Fikir
              </button>
            </div>
          )}
        </div>

        {/* Filter row */}
        <div className="filter-row">
          <div className="filter-chips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={"filter-chip" + (filter === f.id ? " active" : "")}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="sort-pill">
            <Icon name="swap_vert" size={14} className="text-on-surface-variant" />
            Sırala: <b className="ml-1 text-on-surface">Olgunluk ↓</b>
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="ideas-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="idea animate-pulse" style={{ background: "#F4F7FE" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="hub-empty">
            <div className="ico">
              <Icon name="lightbulb" size={26} />
            </div>
            <div className="t">{ideas.length === 0 ? "Henüz fikir yok" : "Bu filtrede fikir yok"}</div>
            <div className="p">
              {ideas.length === 0
                ? "AI asistanına bir fikir anlat — yapılandırıp burada kart olarak gösterir."
                : "Farklı bir olgunluk filtresi dene."}
            </div>
          </div>
        ) : (
          <div className="ideas-grid">
            {items.map(({ idea, maturity }) => {
              const isProject = !!(idea as any).architecturalAnalysis;
              const kind = isProject ? "project" : "idea";
              const kindLabel = isProject ? "PROJE" : "FİKİR";
              const links = (idea.relatedTo?.length ?? 0) + (idea.researchIds?.length ?? 0);
              return (
                <article
                  key={idea.id}
                  className={"idea " + (isProject ? "project-t" : "idea-t")}
                  onClick={() => openCard(idea.id)}
                >
                  <div className="stripe" />
                  <div className="idea-row1">
                    <span className={"tag-pill " + (isProject ? "project-t" : "idea-t")}>
                      {kindLabel}
                    </span>
                    <div className="score-circle" style={{ ["--p" as any]: `${maturity}%` }}>
                      <span className="v">{maturity}</span>
                    </div>
                  </div>
                  <h3 className="idea-title">{idea.title}</h3>
                  <p className="idea-body">{idea.description}</p>
                  <div className="idea-foot">
                    <div className="tags">
                      {(idea.tags ?? []).slice(0, 2).map((t) => (
                        <span key={t} className={"tag-pill " + kind + "-t"}>
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span className="link-meta">
                      <Icon name="link" size={12} />
                      {links}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
