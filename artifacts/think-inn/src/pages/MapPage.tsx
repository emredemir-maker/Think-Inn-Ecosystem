import { useMemo } from "react";
import { useLocation } from "wouter";
// @ts-ignore — .js util, tip tanımı yok
import { buildGraph } from "@/utils/buildGraph";
// @ts-ignore — .jsx bileşen, tip tanımı yok
import MindMap from "@/components/mindmap/MindMap";
import { useListResearch, useListIdeas } from "@workspace/api-client-react";
import sampleData from "@/data/sample.json";

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

/* MapPage — /map. Saf canvas 3B bilgi grafı (MindMap). Gerçek DB'den 3 katman türetir. */
export default function MapPage() {
  const [, navigate] = useLocation();
  const { data: researchList } = useListResearch();
  const { data: ideaList } = useListIdeas();

  // ── Gerçek veriden 3 katman + köprü tabloları türet ──────────────────────
  const graphData = useMemo(() => {
    const research = researchList ?? [];
    const ideas = ideaList ?? [];

    // DB tamamen boşsa → örnek veriyle göster (showcase fallback, mock değil sadece demo)
    if (research.length === 0 && ideas.length === 0) {
      return buildGraph(sampleData);
    }

    // Katmanlar: araştırma | fikir (tümü) | proje (mimari analize sahip fikirler)
    const researches = research.map((r: any) => ({
      id: r.id,
      title: r.title,
      source: r.authorName,
      category: r.category,
      summary: r.summary,
    }));

    const ideasLayer = ideas.map((i: any) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      description: i.description,
      tags: i.tags,
    }));

    const matured = ideas.filter((i: any) => !!i.architecturalAnalysis);
    const projects = matured.map((i: any) => ({
      id: i.id,
      title: i.title,
      stage: i.projectStatus ?? i.status,
      description: i.description,
      status: i.status,
    }));
    const maturedIds = new Set(matured.map((i: any) => i.id));

    // ideaResearch köprüsü — her fikrin researchIds'i (research → idea), gerçek
    const ideaResearch: Array<{ ideaId: number; researchId: number }> = [];
    for (const i of ideas) {
      for (const rid of (i as any).researchIds ?? []) {
        ideaResearch.push({ ideaId: i.id, researchId: rid });
      }
    }

    // projectIdea köprüsü — matured fikir kendi proje düğümüne (idea → project),
    // ayrıca relatedTo ile bir fikre bağlı matured fikirler de o projeye bağlanır.
    const projectIdea: Array<{ projectId: number; ideaId: number }> = [];
    for (const i of matured) {
      projectIdea.push({ projectId: i.id, ideaId: i.id }); // proje ← kendi fikri
    }
    for (const i of ideas) {
      for (const rel of (i as any).relatedTo ?? []) {
        if (maturedIds.has(rel)) projectIdea.push({ projectId: rel, ideaId: i.id });
      }
    }

    return buildGraph({ researches, ideas: ideasLayer, projects, ideaResearch, projectIdea });
  }, [researchList, ideaList]);

  const usingSample =
    (researchList?.length ?? 0) === 0 && (ideaList?.length ?? 0) === 0;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Page header — BİLGİ GRAFİ (kompakt: harita alanına yer açmak için tek satır + küçük font) */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-5 pb-2 pt-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="eyebrow hidden sm:inline">Bilgi Grafı</span>
          <h1 className="font-display text-[20px] font-bold leading-tight tracking-[-0.01em] text-on-surface">
            Ekosistem Haritası
          </h1>
          <span className="hidden truncate text-[12px] leading-[1.4] text-on-surface-variant md:inline">
            Araştırmalar → Fikirler → Projeler
          </span>
          {usingSample && (
            <span className="shrink-0 rounded-full bg-risk/15 px-2 py-0.5 text-[10px] font-bold text-[#8A5A00]">
              örnek veri
            </span>
          )}
        </div>
        {/* Aksiyonlar — zoom +/− · tam ekran · geri */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="icon-btn"
            title="Yakınlaştır"
            aria-label="Yakınlaştır"
            onClick={() => window.dispatchEvent(new CustomEvent("think-inn:map-zoom", { detail: { delta: 0.2 } }))}
          >
            <Icon name="zoom_in" size={18} />
          </button>
          <button
            className="icon-btn"
            title="Uzaklaştır"
            aria-label="Uzaklaştır"
            onClick={() => window.dispatchEvent(new CustomEvent("think-inn:map-zoom", { detail: { delta: -0.2 } }))}
          >
            <Icon name="zoom_out" size={18} />
          </button>
          <button
            className="icon-btn"
            title="Tam ekran"
            aria-label="Tam ekran"
            onClick={() => window.dispatchEvent(new CustomEvent("think-inn:map-fullscreen"))}
          >
            <Icon name="fullscreen" size={18} />
          </button>
          <button
            className="icon-btn"
            title="Dashboard'a dön"
            aria-label="Geri"
            onClick={() => navigate("/")}
          >
            <Icon name="arrow_back" size={18} />
          </button>
        </div>
      </header>

      {/* 3D Mind map — kalan tüm alan (yan/alt boşluklar daraltıldı → daha geniş kullanım) */}
      <div className="relative mx-4 mb-4 flex-1 overflow-hidden rounded-[16px] border border-outline-variant">
        <MindMap data={graphData} />
      </div>
    </div>
  );
}
