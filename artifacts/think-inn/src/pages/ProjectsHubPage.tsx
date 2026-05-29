import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useListIdeas, type Idea } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";

/* Proje satırı tıklanınca tam-sayfa detay aç — PROJE yüzü (analiz, sistem şeması, proje aşamaları) */
function openProject(id: number) {
  window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: "idea", id, view: "project" } }));
}

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

/* projectStatus / status → aşama pill (referans: discovery/architecture/build/launch) */
function stageOf(idea: Idea): { cls: string; label: string; progress: number } {
  const ps = (idea as any).projectStatus as string | null;
  const st = idea.status as string;
  // Önce projectStatus, yoksa status
  switch (ps) {
    case "fikir":
      return { cls: "discovery", label: "Keşif", progress: 12 };
    case "planlama":
      return { cls: "architecture", label: "Mimari", progress: 35 };
    case "gelistirme":
      return { cls: "build", label: "Build", progress: 65 };
    case "test":
      return { cls: "build", label: "Test", progress: 85 };
    case "tamamlandi":
      return { cls: "launch", label: "Launch", progress: 100 };
    case "beklemede":
      return { cls: "discovery", label: "Beklemede", progress: 20 };
  }
  // projectStatus yoksa idea.status'tan türet
  switch (st) {
    case "merged":
      return { cls: "launch", label: "Launch", progress: 96 };
    case "prototype":
      return { cls: "build", label: "Prototip", progress: 64 };
    case "archived":
      return { cls: "discovery", label: "Arşiv", progress: 100 };
    case "active":
      return { cls: "architecture", label: "Mimari", progress: 42 };
    default:
      return { cls: "discovery", label: "Keşif", progress: 18 };
  }
}

const AV_COLORS = ["#1463F3", "#18C9E8", "#7A5CFF", "#20C997", "#F59E0B"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TeamStack({ idea }: { idea: Idea }) {
  // Gerçek ekip: projectTeam → yoksa collaborators → yoksa authorName
  const team: string[] =
    ((idea as any).projectTeam as Array<{ name: string }> | undefined)?.map((t) => t.name) ??
    [];
  const names = team.length > 0 ? team : idea.collaborators?.length ? idea.collaborators : [idea.authorName];
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  return (
    <div className="team-stack">
      {shown.map((n, idx) => (
        <div key={idx} className="av" style={{ background: AV_COLORS[idx % AV_COLORS.length] }} title={n}>
          {initials(n)}
        </div>
      ))}
      {extra > 0 && <div className="av more">+{extra}</div>}
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "Tümü" },
  { id: "mine", label: "Benim" },
  { id: "critical", label: "Kritik" },
  { id: "launch", label: "Lansman" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function ProjectsHubPage() {
  const { data: ideaList, isLoading } = useListIdeas();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = !!user;
  const ideas = ideaList ?? [];

  const [filter, setFilter] = useState<FilterId>("all");

  // Sadece mimari analize sahip fikirler = projeler
  const projects = useMemo(
    () => ideas.filter((i) => !!(i as any).architecturalAnalysis),
    [ideas]
  );

  const rows = useMemo(() => {
    const withStage = projects.map((p) => ({ idea: p as Idea, stage: stageOf(p as Idea) }));
    const filtered = withStage.filter(({ stage }) => {
      if (filter === "all") return true;
      if (filter === "launch") return stage.cls === "launch";
      if (filter === "critical") return stage.progress < 30; // erken/riskli
      if (filter === "mine") return true; // kullanıcı eşleştirmesi ileride
      return true;
    });
    return filtered.sort((a, b) => b.stage.progress - a.stage.progress);
  }, [projects, filter]);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-10 pb-16 pt-7">
        {/* Page head */}
        <div className="page-head">
          <div className="l">
            <span className="eyebrow">Proje Portföyü</span>
            <h1>Projeler</h1>
            <p>Mimari analizden lansmana kadar tüm aktif projeler. Her satır AI tarafından hesaplanmış olgunluk ve aşama bilgisini içerir.</p>
          </div>
          {isAdmin && (
            <div className="page-actions">
              <button className="icon-btn" aria-label="Görünüm">
                <Icon name="grid_view" size={18} />
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))}
                className="flex items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
              >
                <Icon name="add" size={16} />
                Yeni Proje
              </button>
            </div>
          )}
        </div>

        {/* Filter row */}
        {projects.length > 0 && (
          <div className="filter-row">
            <div className="filter-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={"filter-chip" + (filter === f.id ? " active" : "")}
                >
                  {f.label}
                  {f.id === "all" && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {projects.length}</span>}
                </button>
              ))}
            </div>
            <button className="sort-pill">
              <Icon name="swap_vert" size={14} className="text-on-surface-variant" />
              Sırala: <b className="ml-1 text-on-surface">İlerleme ↓</b>
            </button>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="projects-table">
            <div className="pt-head">
              <div>Proje</div><div>Aşama</div><div>Ekip</div><div>İlerleme</div>
              <div style={{ textAlign: "right" }}>Detay</div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="pt-row animate-pulse" style={{ height: 64 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="hub-empty">
            <div className="ico">
              <Icon name="account_tree" size={26} />
            </div>
            <div className="t">{projects.length === 0 ? "Henüz proje yok" : "Bu filtrede proje yok"}</div>
            <div className="p">
              {projects.length === 0
                ? "Bir fikir kartında 'Derin Analiz Başlat'a tıkla — AI mimari analizi üretip projeye dönüştürür."
                : "Farklı bir filtre dene."}
            </div>
          </div>
        ) : (
          <div className="projects-table">
            <div className="pt-head">
              <div>Proje</div>
              <div>Aşama</div>
              <div>Ekip</div>
              <div>İlerleme</div>
              <div style={{ textAlign: "right" }}>Detay</div>
            </div>
            {rows.map(({ idea, stage }) => (
              <div key={idea.id} className="pt-row" onClick={() => openProject(idea.id)}>
                <div className="pt-name">
                  {idea.title}
                  <span className="sub">{idea.description?.slice(0, 60)}</span>
                </div>
                <div>
                  <span className={"pt-stage-pill " + stage.cls}>{stage.label}</span>
                </div>
                <TeamStack idea={idea} />
                <div className="pt-progress">
                  <div className="pbar">
                    <span style={{ width: stage.progress + "%" }} />
                  </div>
                  <span className="v">{stage.progress}%</span>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    className="icon-btn"
                    aria-label="Fizibilite Raporu"
                    title="Fizibilite Raporu"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/feasibility?id=${idea.id}`);
                    }}
                  >
                    <Icon name="fact_check" size={15} className="text-primary" />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Proje Detayını Aç"
                    title="Proje Detayı"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProject(idea.id);
                    }}
                  >
                    <Icon name="arrow_outward" size={15} className="text-primary" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
