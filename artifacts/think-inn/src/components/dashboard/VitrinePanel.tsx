import React, { useState, useMemo, useEffect } from "react";
import {
  useListResearch, useListIdeas, useVote,
  useDeleteResearch, useDeleteIdea,
  Research, Idea
} from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import {
  FileText, Lightbulb, Search,
  Building2, Sparkles,
  X, TrendingUp, LayoutGrid, LayoutList,
  Network, ChevronDown,
  CheckCircle2, AlertTriangle, Calendar,
  Users, Shield, ShieldOff, Trash2,
  ThumbsUp, ArrowRight, Zap, Star, ChevronRight,
  Globe
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { ProjectAnalysisModal } from "../modals/ProjectAnalysisModal";
import { ProjectCard } from "../cards/ProjectCard";
import { RelationGraph } from "../graph/RelationGraph";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { API_ORIGIN } from "@/lib/api-config";

type TabId = "discover" | "research" | "ideas" | "projects";
type ViewMode = "list" | "graph" | "global-map";
type LayoutMode = "grid" | "list";

const TABS: { id: TabId; label: string; icon: import('lucide-react').LucideIcon; accent: string; glow: string }[] = [
  { id: "discover",  label: "Keşfet",        icon: Sparkles,  accent: "#22d3ee", glow: "rgba(34,211,238,0.3)" },
  { id: "research",  label: "Araştırmalar",   icon: FileText,  accent: "#818cf8", glow: "rgba(99,102,241,0.3)" },
  { id: "ideas",     label: "Fikirler",       icon: Lightbulb, accent: "#fbbf24", glow: "rgba(251,191,36,0.3)" },
  { id: "projects",  label: "Projeler",       icon: Building2, accent: "#a78bfa", glow: "rgba(167,139,250,0.3)" },
];

/* ── Hero arka planı — light Material-You — dot grid + ambient gradients ── */
function AnimatedHero() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Light base */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-low to-surface-container" />

      {/* Dot grid (network-canvas utility) */}
      <div className="absolute inset-0 hexagon-bg opacity-60" />

      {/* Soft ambient color glows */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 360,
          height: 360,
          top: -80,
          right: -40,
          background: 'radial-gradient(circle, var(--color-primary-fixed) 0%, transparent 70%)',
          opacity: 0.55,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 280,
          height: 280,
          bottom: -60,
          left: '5%',
          background: 'radial-gradient(circle, var(--color-tertiary-fixed) 0%, transparent 70%)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

/* ── Featured Card (mini version for discover) — Material You light ─── */
function FeaturedResearchCard({ research, onClick }: { research: Research; onClick: () => void }) {
  const hasImage = !!(research as any).hasCoverImage || !!research.coverImageB64;
  const imageSrc = research.coverImageB64
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : hasImage ? `${API_ORIGIN}/api/research/${research.id}/cover` : null;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group/card relative w-[220px] flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Cover */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary-container/30 to-tertiary-fixed/30">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={research.title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {!imageSrc && (
          <div className="flex h-full w-full items-center justify-center">
            <FileText size={32} className="text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-on-surface/40 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-primary shadow-sm">
            {research.status}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-on-surface/70 px-1.5 py-0.5 text-[10px] font-bold text-surface backdrop-blur-sm">
          <ThumbsUp size={9} />
          <span>{Math.max(0, research.voteCount)}</span>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-body-sm font-bold leading-snug text-on-surface mb-1">{research.title}</p>
        <p className="truncate text-[10px] font-medium text-on-surface-variant">{research.authorName}</p>
      </div>
    </motion.div>
  );
}

function FeaturedIdeaCard({ idea, onClick }: { idea: Idea; onClick: () => void }) {
  // SKOR — gerçek veri (mock yok): voteCount + bağlantılar
  const score =
    (idea.voteCount ?? 0) +
    (idea.relatedTo?.length ?? 0) +
    (idea.researchIds?.length ?? 0);

  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group/card relative w-[220px] flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-all hover:border-tertiary-fixed-dim/60 hover:shadow-md"
    >
      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-tertiary-fixed/40 via-primary-container/20 to-surface-container">
        {/* Decorative dots */}
        <div className="hexagon-bg absolute inset-0 opacity-40" />

        {/* Idea hex icon */}
        <div
          className="flex h-12 w-10 flex-col items-center justify-center bg-gradient-to-br from-tertiary-fixed-dim to-primary text-white shadow-sm"
          style={{
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
          }}
        >
          <Lightbulb size={16} />
        </div>

        {/* Score chip */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary backdrop-blur-sm">
          <Star size={8} />
          <span>{score}</span>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-body-sm font-bold leading-snug text-on-surface mb-1">{idea.title}</p>
        <p className="truncate text-[10px] font-medium text-on-surface-variant">{idea.authorName}</p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export function VitrinePanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("discover");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canvasItem, setCanvasItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [detailItem, setDetailItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [projectIdeaId, setProjectIdeaId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'research' | 'idea'; title: string } | null>(null);

  // Poll research until all cover images are generated
  const [researchPollingEnabled, setResearchPollingEnabled] = useState(false);
  const { data: researchList, isLoading: isResearchLoading } = useListResearch({
    query: { refetchInterval: researchPollingEnabled ? 4000 : false } as any
  });

  const hasMissingImages = Array.isArray(researchList) && researchList.some(r => !(r as any).hasCoverImage && !(r as any).coverImageB64);
  React.useEffect(() => {
    setResearchPollingEnabled(hasMissingImages);
  }, [hasMissingImages]);

  const [pollingEnabled, setPollingEnabled] = useState(false);
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas({
    query: { refetchInterval: pollingEnabled ? 3000 : false } as any
  });

  useEffect(() => {
    if (detailItem?.type !== 'idea') { setPollingEnabled(false); return; }
    const idea = ideaList?.find(i => i.id === detailItem.id);
    const hasEval = !!(idea && (idea as any).evaluatedAt);
    setPollingEnabled(!hasEval);
  }, [detailItem, ideaList]);

  const { mutate: submitVote } = useVote();
  const { mutate: deleteResearch } = useDeleteResearch();
  const { mutate: deleteIdea } = useDeleteIdea();
  const queryClient = useQueryClient();

  const liveDetailItem = useMemo(() => {
    if (!detailItem) return null;
    if (detailItem.type === 'research') {
      const item = researchList?.find(r => r.id === detailItem.id);
      return item ? { item, type: 'research' as const } : null;
    } else {
      const item = ideaList?.find(i => i.id === detailItem.id);
      return item ? { item, type: 'idea' as const } : null;
    }
  }, [detailItem, researchList, ideaList]);

  // Reset category filter when switching tabs
  React.useEffect(() => { setActiveCat(null); }, [activeTab]);

  const handleVote = (targetType: "research" | "idea", targetId: number, value: 1 | -1) => {
    submitVote(
      { data: { targetType, targetId, voterName: "CurrentUser", value } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/${targetType === 'research' ? 'research' : 'ideas'}`] }) }
    );
  };

  const handleDelete = (id: number, type: 'research' | 'idea', title: string) => {
    setDeleteConfirm({ id, type, title });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${type === 'research' ? 'research' : 'ideas'}`] });
      setDeleteConfirm(null);
    };
    if (type === 'research') deleteResearch({ id }, { onSuccess });
    else deleteIdea({ id }, { onSuccess });
  };

  const handleCardClick = (item: Research | Idea, type: 'research' | 'idea') => setDetailItem({ id: item.id, type });
  const handleShowCanvas = (item: Research | Idea, type: 'research' | 'idea') => {
    setCanvasItem({ id: item.id, type });
    setViewMode('graph');
  };
  const handleNodeClick = (id: number, type: 'research' | 'idea') => setDetailItem({ id, type });
  const backToList = () => { setViewMode('list'); setCanvasItem(null); };
  const openGlobalMap = () => setViewMode('global-map');

  const oneWeekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; }, []);

  const filteredResearch = useMemo(() => {
    if (!Array.isArray(researchList)) return [];
    const q = searchQuery.toLowerCase();
    return researchList.filter(r => {
      if (activeCat && (r as any).category !== activeCat) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q) ||
        r.authorName?.toLowerCase().includes(q) || r.tags?.some(t => t.toLowerCase().includes(q));
    });
  }, [researchList, searchQuery, activeCat]);

  const filteredIdeas = useMemo(() => {
    if (!Array.isArray(ideaList)) return [];
    const q = searchQuery.toLowerCase();
    return ideaList.filter(i => {
      if (activeCat && (i as any).category !== activeCat) return false;
      if (!q) return true;
      return i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) ||
        i.authorName?.toLowerCase().includes(q) || i.tags?.some(t => t.toLowerCase().includes(q));
    });
  }, [ideaList, searchQuery, activeCat]);

  const projectIdeas = useMemo(() => {
    if (!Array.isArray(ideaList)) return [];
    const q = searchQuery.toLowerCase();
    return ideaList.filter(i => {
      if (!(i as any).architecturalAnalysis) return false;
      if (q) return i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
      return true;
    });
  }, [ideaList, searchQuery]);

  // Featured: top voted ideas + latest research
  const topIdeas = useMemo(() =>
    [...(ideaList ?? [])].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)).slice(0, 6),
    [ideaList]
  );
  const latestResearch = useMemo(() => (researchList ?? []).slice(0, 6), [researchList]);

  const totalVotes = useMemo(() =>
    [...(researchList ?? []), ...(ideaList ?? [])].reduce((s, i) => s + (i.voteCount ?? 0), 0),
    [researchList, ideaList]
  );

  const isLoading = isResearchLoading || isIdeasLoading;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-transparent">

      {/* ── Graph / Map modes ─────────────────────────────────────── */}
      {viewMode === 'graph' && canvasItem ? (
        <RelationGraph
          selectedId={canvasItem.id} selectedType={canvasItem.type}
          allResearch={researchList || []} allIdeas={ideaList || []}
          onBack={backToList} onNodeClick={handleNodeClick}
          onOpenProject={(ideaId) => setProjectIdeaId(ideaId)}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : viewMode === 'global-map' ? (
        <RelationGraph
          globalMode allResearch={researchList || []} allIdeas={ideaList || []}
          onBack={backToList} onNodeClick={handleNodeClick}
          onOpenProject={(ideaId) => setProjectIdeaId(ideaId)}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : (

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Tab Navigation Header — Material-You light ────────── */}
        <div className="shrink-0 relative border-b border-outline-variant/40 bg-surface-container-lowest">
          <div className="relative flex items-center justify-end px-4 pt-2 pb-0">
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setIsSuperAdmin(v => !v)}
                className={[
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md font-label-md font-semibold transition-all',
                  isSuperAdmin
                    ? 'bg-error/10 text-error border border-error/30'
                    : 'bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container-high',
                ].join(' ')}
              >
                {isSuperAdmin ? <ShieldOff size={11} /> : <Shield size={11} />}
                Admin
              </button>
              <button
                onClick={openGlobalMap}
                className="flex items-center gap-1.5 rounded-full bg-primary-container/10 px-3 py-1.5 text-label-md font-label-md font-semibold text-primary border border-primary/20 transition-all hover:bg-primary-container/20"
              >
                <Globe size={12} /> Harita
              </button>
            </div>
          </div>

          {/* Tabs — chip stili (mockup'taki gibi) */}
          <div className="relative flex items-end px-4 gap-2 pb-3">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'relative flex items-center gap-2 rounded-full px-4 py-2 text-label-md font-label-md font-bold transition-all',
                    isActive
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-primary',
                  ].join(' ')}
                >
                  <Icon size={14} />
                  <span className="tracking-wider uppercase">{tab.label}</span>
                  {tab.id === 'research' && (researchList?.length ?? 0) > 0 && (
                    <span className={[
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-primary-container/15 text-primary',
                    ].join(' ')}>
                      {researchList!.length}
                    </span>
                  )}
                  {tab.id === 'ideas' && (ideaList?.length ?? 0) > 0 && (
                    <span className={[
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
                    ].join(' ')}>
                      {ideaList!.length}
                    </span>
                  )}
                  {tab.id === 'projects' && projectIdeas.length > 0 && (
                    <span className={[
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-secondary-fixed text-on-secondary-fixed-variant',
                    ].join(' ')}>
                      {projectIdeas.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'discover' ? (

            /* ── DISCOVER TAB ─────────────────────────────────── */
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto"
            >
              {/* Hero Section */}
              <div className="relative min-h-[240px] flex flex-col justify-end overflow-hidden">
                <AnimatedHero />

                <div className="relative z-10 px-6 pt-10 pb-6">
                  {/* Pre-title chip */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 rounded-full bg-primary-container/10 px-3 py-1 mb-3 border border-primary/15"
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>auto_awesome</span>
                    <span className="font-label-md text-label-md font-bold text-primary tracking-widest uppercase">
                      AI Innovation Studio
                    </span>
                  </motion.div>

                  {/* Main title — responsive, hece kırılmaz */}
                  <motion.h1
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="font-display-lg text-headline-md sm:text-headline-lg xl:text-display-lg text-on-surface mb-2 leading-tight whitespace-nowrap"
                  >
                    Hoş Geldin,{" "}
                    <span className="bg-gradient-to-r from-primary to-tertiary bg-clip-text text-transparent">
                      İnovatör
                    </span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="font-body-md text-body-sm sm:text-body-md text-on-surface-variant mb-5 leading-relaxed max-w-xl"
                  >
                    Eko-sisteminde {ideaList?.length ?? 0} fikir, {researchList?.length ?? 0} araştırma
                    ve {projectIdeas.length} proje var. AI asistanıyla yeni inovasyonlar başlatabilirsin.
                  </motion.p>

                  {/* Stats row — Material-You light chips */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 flex-wrap"
                  >
                    {[
                      { icon: FileText,   val: researchList?.length ?? 0, label: "Araştırma", tone: 'bg-primary/10 text-primary' },
                      { icon: Lightbulb,  val: ideaList?.length ?? 0,     label: "Fikir",      tone: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
                      { icon: TrendingUp, val: totalVotes,                label: "Toplam Oy", tone: 'bg-tertiary-fixed-dim/20 text-tertiary' },
                      { icon: Building2,  val: projectIdeas.length,       label: "Proje",      tone: 'bg-secondary-container text-on-secondary-container' },
                    ].map(({ icon: Icon, val, label, tone }) => (
                      <div key={label} className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${tone}`}>
                        <Icon size={13} />
                        <span className="text-body-md font-bold">{val}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>

              {isLoading ? (
                <div className="px-5 py-8 space-y-6">
                  <SkeletonSection />
                </div>
              ) : (
                <div className="px-5 pb-8 space-y-8">

                  {/* Top voted ideas */}
                  {topIdeas.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <SectionHeader
                        number="01"
                        icon={<Star size={11} className="text-white" />}
                        iconBg="from-tertiary-fixed-dim to-primary"
                        label="En Beğenilen Fikirler"
                        count={topIdeas.length}
                        countColor={{ bg: 'rgba(0,76,197,0.08)', text: '#004cc5', border: 'rgba(0,76,197,0.2)' }}
                        lineColor="rgba(0,76,197,0.25)"
                        onSeeAll={() => setActiveTab('ideas')}
                      />
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {topIdeas.map((idea, i) => (
                          <motion.div
                            key={idea.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * i }}
                          >
                            <FeaturedIdeaCard
                              idea={idea as Idea}
                              onClick={() => handleCardClick(idea as Idea, 'idea')}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Latest research */}
                  {latestResearch.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <SectionHeader
                        number="02"
                        icon={<Zap size={11} className="text-white" />}
                        iconBg="from-primary to-primary-fixed-dim"
                        label="Son Araştırmalar"
                        count={latestResearch.length}
                        countColor={{ bg: 'rgba(57,216,247,0.15)', text: '#1463f3', border: 'rgba(20,99,243,0.25)' }}
                        lineColor="rgba(57,216,247,0.4)"
                        onSeeAll={() => setActiveTab('research')}
                      />
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {latestResearch.map((r, i) => (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * i }}
                          >
                            <FeaturedResearchCard
                              research={r as Research}
                              onClick={() => handleCardClick(r as Research, 'research')}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Projects teaser */}
                  {projectIdeas.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <SectionHeader
                        number="03"
                        icon={<Building2 size={11} className="text-white" />}
                        iconBg="from-primary-container to-primary"
                        label="Projeler"
                        count={projectIdeas.length}
                        countColor={{ bg: 'rgba(0,76,197,0.08)', text: '#004cc5', border: 'rgba(0,76,197,0.2)' }}
                        lineColor="rgba(0,76,197,0.25)"
                        onSeeAll={() => setActiveTab('projects')}
                      />
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        onClick={() => setActiveTab('projects')}
                        className="flex w-full items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 transition-all hover:border-primary/40 hover:bg-surface-container-low hover:shadow-md"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary-container/20">
                          <Building2 size={22} className="text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-body-md font-bold text-on-surface mb-0.5">
                            {projectIdeas.length} Aktif Proje
                          </p>
                          <p className="text-body-sm text-on-surface-variant">
                            Mimari analize dönüşmüş fikirler
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-on-surface-variant" />
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Empty state */}
                  {!isLoading && topIdeas.length === 0 && latestResearch.length === 0 && (
                    <div className="py-20 flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary-container/15"
                      >
                        <Sparkles size={28} className="text-primary" />
                      </motion.div>
                      <p className="text-body-md font-bold text-on-surface">Henüz içerik eklenmemiş</p>
                      <p className="text-body-sm text-on-surface-variant">AI asistanına bir araştırma veya fikir anlatın.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

          ) : (

            /* ── CONTENT TABS (Research / Ideas / Projects) ─────── */
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Category filter chips — Material You */}
              {(activeTab === 'ideas' || activeTab === 'research') && (() => {
                const cats = activeTab === 'ideas'
                  ? [...new Set((ideaList ?? []).map(i => (i as any).category).filter(Boolean))]
                  : [...new Set((researchList ?? []).map(r => (r as any).category).filter(Boolean))];
                if (cats.length === 0) return null;
                return (
                  <div className="shrink-0 px-5 pt-3 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-wrap">
                    <button
                      onClick={() => setActiveCat(null)}
                      className={[
                        'rounded-full px-3 py-1 text-label-md font-label-md font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0',
                        activeCat === null
                          ? 'bg-primary text-on-primary border border-primary shadow-sm'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-high',
                      ].join(' ')}
                    >Tümü</button>
                    {cats.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCat(activeCat === cat ? null : cat)}
                        className={[
                          'rounded-full px-3 py-1 text-label-md font-label-md font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0',
                          activeCat === cat
                            ? 'bg-primary text-on-primary border border-primary shadow-sm'
                            : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-high',
                        ].join(' ')}
                      >{cat}</button>
                    ))}
                  </div>
                );
              })()}

              {/* Search + layout controls — Material You */}
              <div className="shrink-0 flex items-center gap-3 border-b border-outline-variant/30 px-5 py-3 bg-surface-container-lowest">
                <div
                  className={[
                    'flex-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-all bg-surface-container-low',
                    searchFocused
                      ? 'border border-primary ring-2 ring-primary/15'
                      : 'border border-outline-variant/40',
                  ].join(' ')}
                >
                  <Search size={14} className={searchFocused ? 'text-primary' : 'text-on-surface-variant'} />
                  <input
                    className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none"
                    placeholder={
                      activeTab === 'research' ? "Araştırma ara..." :
                      activeTab === 'ideas' ? "Fikir ara..." : "Proje ara..."
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {activeTab !== 'projects' && (
                  <div className="flex items-center rounded-lg p-0.5 flex-shrink-0 bg-surface-container-low border border-outline-variant/40">
                    <button
                      onClick={() => setLayoutMode("grid")}
                      className={[
                        'p-1.5 rounded-md transition-all',
                        layoutMode === "grid"
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container-high',
                      ].join(' ')}
                    >
                      <LayoutGrid size={13} />
                    </button>
                    <button
                      onClick={() => setLayoutMode("list")}
                      className={[
                        'p-1.5 rounded-md transition-all',
                        layoutMode === "list"
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:bg-surface-container-high',
                      ].join(' ')}
                    >
                      <LayoutList size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
                {isLoading ? (
                  <SkeletonSection />
                ) : activeTab === 'research' ? (
                  <>
                    {filteredResearch.length > 0 ? (
                      layoutMode === "grid" ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                          {filteredResearch.map(r => (
                            <DeletableWrapper key={`res-${r.id}`} isSuperAdmin={isSuperAdmin} onDelete={() => handleDelete(r.id, 'research', r.title)}>
                              <ResearchCard
                                research={r as Research}
                                onVote={(id, val) => handleVote("research", id, val)}
                                onClick={() => handleCardClick(r as Research, 'research')}
                                onShowCanvas={() => handleShowCanvas(r as Research, 'research')}
                              />
                            </DeletableWrapper>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredResearch.map(r => (
                            <AccordionResearchRow
                              key={`res-row-${r.id}`}
                              research={r as Research}
                              onVote={(id, val) => handleVote("research", id, val)}
                              onDetail={() => handleCardClick(r as Research, 'research')}
                              onShowCanvas={() => handleShowCanvas(r as Research, 'research')}
                              isSuperAdmin={isSuperAdmin}
                              onDelete={() => handleDelete(r.id, 'research', r.title)}
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      <EmptySection
                        icon={<FileText size={28} className="text-primary/60" />}
                        title="Araştırma bulunamadı"
                        desc={searchQuery ? "Farklı bir arama terimi deneyin." : "Henüz araştırma eklenmemiş."}
                      />
                    )}
                  </>
                ) : activeTab === 'ideas' ? (
                  <>
                    {filteredIdeas.length > 0 ? (
                      layoutMode === "grid" ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                          {filteredIdeas.map(i => (
                            <DeletableWrapper key={`idea-${i.id}`} isSuperAdmin={isSuperAdmin} onDelete={() => handleDelete(i.id, 'idea', i.title)}>
                              <IdeaCard
                                idea={i as Idea}
                                onVote={(id, val) => handleVote("idea", id, val)}
                                onClick={() => handleCardClick(i as Idea, 'idea')}
                                onShowCanvas={() => handleShowCanvas(i as Idea, 'idea')}
                                onOpenProject={() => setProjectIdeaId(i.id)}
                              />
                            </DeletableWrapper>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredIdeas.map(i => (
                            <AccordionIdeaRow
                              key={`idea-row-${i.id}`}
                              idea={i as Idea}
                              onVote={(id, val) => handleVote("idea", id, val)}
                              onDetail={() => handleCardClick(i as Idea, 'idea')}
                              onShowCanvas={() => handleShowCanvas(i as Idea, 'idea')}
                              isSuperAdmin={isSuperAdmin}
                              onDelete={() => handleDelete(i.id, 'idea', i.title)}
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      <EmptySection
                        icon={<Lightbulb size={28} className="text-tertiary/70" />}
                        title="Fikir bulunamadı"
                        desc={searchQuery ? "Farklı bir arama terimi deneyin." : "Henüz fikir eklenmemiş."}
                      />
                    )}
                  </>
                ) : /* projects */ (
                  <>
                    {projectIdeas.length > 0 ? (
                      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {projectIdeas.map(i => (
                          <ProjectCard
                            key={`project-${i.id}`}
                            idea={i as Idea}
                            onClick={() => setProjectIdeaId(i.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptySection
                        icon={<Building2 size={28} className="text-primary-container/80" />}
                        title="Henüz proje kartı yok"
                        desc="Bir fikir kartında 'Analiz Oluştur'a tıklayın."
                      />
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {liveDetailItem && (
        <CardDetailModal
          item={liveDetailItem.item}
          type={liveDetailItem.type}
          allResearch={researchList || []}
          onClose={() => setDetailItem(null)}
          onOpenProject={(ideaId) => { setDetailItem(null); setProjectIdeaId(ideaId); }}
        />
      )}

      {projectIdeaId && (() => {
        const idea = ideaList?.find(i => i.id === projectIdeaId);
        return idea ? (
          <ProjectAnalysisModal idea={idea as Idea} onClose={() => setProjectIdeaId(null)} />
        ) : null;
      })()}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Delete Confirm — Material You */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 w-full max-w-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-error/30 bg-error-container/30">
                <Trash2 size={18} className="text-error" />
              </div>
              <div>
                <h3 className="font-headline-sm text-body-md font-bold text-on-surface">
                  Sil: {deleteConfirm.type === 'research' ? 'Araştırma' : 'Fikir'}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Bu işlem geri alınamaz
                </p>
              </div>
            </div>
            <p className="mb-5 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              <span className="font-bold text-on-surface">"{deleteConfirm.title}"</span> başlıklı içeriği kalıcı olarak silmek istiyor musunuz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full border border-outline-variant/40 bg-surface-container-low px-4 py-2 text-label-md font-label-md font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-full bg-error px-4 py-2 text-label-md font-label-md font-bold text-on-error shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Evet, Sil
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ── Section Header — Material You ──────────────────────────────────── */
function SectionHeader({
  number, icon, iconBg, label, count, countColor, lineColor, onSeeAll
}: {
  number: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  count: number;
  countColor: { bg: string; text: string; border: string };
  lineColor: string;
  onSeeAll?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-label-md text-label-md font-bold text-outline tracking-widest">
        {number}
      </span>
      <div className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${iconBg} shadow-sm`}>
        {icon}
      </div>
      <span className="font-label-md text-label-md font-bold tracking-wider uppercase text-on-surface">
        {label}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ background: countColor.bg, color: countColor.text, border: `1px solid ${countColor.border}` }}
      >
        {String(count).padStart(2, '0')}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: `linear-gradient(90deg, ${lineColor}, transparent)` }}
      />
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-label-md font-label-md font-bold text-primary hover:bg-primary-container/15 transition-colors"
        >
          Tümü <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

/* ── Skeleton Section — Material You light ──────────────────────────── */
function SkeletonSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-lg animate-pulse bg-surface-container-high" />
        <div className="h-3 w-24 rounded animate-pulse bg-surface-container-high" />
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[220px] flex-shrink-0 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest"
          >
            <div className="relative h-28 overflow-hidden bg-surface-container">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0,76,197,0.08) 50%, transparent 100%)',
                  animation: 'shimmer 2s infinite',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
            <div className="p-3 space-y-2">
              <div className="h-2.5 w-3/4 rounded animate-pulse bg-surface-container-high" />
              <div className="h-2 w-1/2 rounded animate-pulse bg-surface-container" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Deletable Card Wrapper ─────────────────────────────────────────── */
function DeletableWrapper({ children, isSuperAdmin, onDelete }: {
  children: React.ReactNode;
  isSuperAdmin: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="relative group/del">
      {children}
      {isSuperAdmin && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 z-10 rounded-full border border-error/30 bg-surface-container-lowest/95 p-1.5 text-error shadow-sm backdrop-blur-sm opacity-0 transition-all hover:bg-error-container/40 group-hover/del:opacity-100"
          title="Sil"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Accordion Rows ─────────────────────────────────────────────────── */
function AccordionResearchRow({ research, onVote, onDetail, onShowCanvas, isSuperAdmin, onDelete }: {
  research: Research;
  onVote: (id: number, val: 1 | -1) => void;
  onDetail?: () => void;
  onShowCanvas?: () => void;
  isSuperAdmin?: boolean;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(false);

  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voted) { onVote(research.id, -1); setVoted(false); }
    else { onVote(research.id, 1); setVoted(true); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        'rounded-2xl bg-surface-container-lowest transition-all',
        open
          ? 'border border-primary/40 shadow-md'
          : 'border border-outline-variant/40 hover:border-primary/30 hover:shadow-sm',
      ].join(' ')}
    >
      <div
        className="flex w-full cursor-pointer select-none items-center gap-4 px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-container/20 border border-primary/15">
          <FileText size={15} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-bold text-on-surface">{research.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="flex-shrink-0 text-body-sm font-medium text-on-surface-variant">{research.authorName}</span>
            {research.createdAt && (
              <>
                <span className="text-outline">·</span>
                <span className="flex flex-shrink-0 items-center gap-1 text-body-sm text-on-surface-variant">
                  <Calendar size={10} />
                  {format(new Date(research.createdAt), 'dd MMM yyyy', { locale: tr })}
                </span>
              </>
            )}
            {research.tags?.slice(0, 3).map(t => (
              <span
                key={t}
                className="flex-shrink-0 rounded-full border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleVote}
          className={[
            'flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md font-label-md font-bold transition-all',
            voted
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-primary-container/15 text-primary border border-primary/20 hover:bg-primary-container/25',
          ].join(' ')}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, research.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="flex-shrink-0 rounded-lg p-1.5 text-error transition-colors hover:bg-error-container/30"
          >
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-outline-variant/30 px-4 pb-4 pt-3">
              {research.summary && (
                <p className="mb-3 text-body-sm leading-relaxed text-on-surface-variant">
                  {research.summary}
                </p>
              )}
              {research.tags && research.tags.length > 3 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {research.tags.map(t => (
                    <span
                      key={t}
                      className="rounded-full border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onDetail}
                  className="rounded-full bg-primary px-4 py-1.5 text-label-md font-label-md font-bold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-95"
                >
                  Tam Detay
                </button>
                {onShowCanvas && (
                  <button
                    onClick={onShowCanvas}
                    className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary-container/15 px-4 py-1.5 text-label-md font-label-md font-bold text-primary transition-all hover:bg-primary-container/25"
                  >
                    <Network size={11} /> Harita
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AccordionIdeaRow({ idea, onVote, onDetail, onShowCanvas, isSuperAdmin, onDelete }: {
  idea: Idea;
  onVote: (id: number, val: 1 | -1) => void;
  onDetail?: () => void;
  onShowCanvas?: () => void;
  isSuperAdmin?: boolean;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(false);
  const hasResearch = idea.researchIds && idea.researchIds.length > 0;

  const handleVote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voted) { onVote(idea.id, -1); setVoted(false); }
    else { onVote(idea.id, 1); setVoted(true); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        'rounded-2xl bg-surface-container-lowest transition-all',
        open
          ? 'border border-tertiary-fixed-dim/60 shadow-md'
          : 'border border-outline-variant/40 hover:border-tertiary-fixed-dim/40 hover:shadow-sm',
      ].join(' ')}
    >
      <div
        className="flex w-full cursor-pointer select-none items-center gap-4 px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed/40">
          <Lightbulb size={15} className="text-tertiary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-bold text-on-surface">{idea.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="flex-shrink-0 text-body-sm font-medium text-on-surface-variant">{idea.authorName}</span>
            {hasResearch ? (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary-container/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <CheckCircle2 size={9} />
                {idea.researchIds.length} Araştırma
              </span>
            ) : (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-error/30 bg-error-container/30 px-2 py-0.5 text-[10px] font-bold text-error">
                <AlertTriangle size={9} />
                Araştırmasız
              </span>
            )}
            {idea.tags?.slice(0, 2).map(t => (
              <span
                key={t}
                className="flex-shrink-0 rounded-full border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleVote}
          className={[
            'flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md font-label-md font-bold transition-all',
            voted
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-primary-container/15 text-primary border border-primary/20 hover:bg-primary-container/25',
          ].join(' ')}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, idea.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="flex-shrink-0 rounded-lg p-1.5 text-error transition-colors hover:bg-error-container/30"
          >
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-on-surface-variant transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-outline-variant/30 px-4 pb-4 pt-3">
              {idea.description && (
                <p className="mb-3 line-clamp-4 text-body-sm leading-relaxed text-on-surface-variant">
                  {idea.description}
                </p>
              )}
              {idea.collaborators && idea.collaborators.length > 0 && (
                <div className="mb-3 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                  <Users size={12} className="text-primary" />
                  <span className="font-bold">Ekip:</span>
                  {idea.collaborators.join(', ')}
                </div>
              )}
              {idea.tags && idea.tags.length > 2 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {idea.tags.map(t => (
                    <span
                      key={t}
                      className="rounded-full border border-outline-variant/40 bg-surface-container-low px-2 py-0.5 text-[10px] font-bold text-on-surface-variant"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onDetail}
                  className="rounded-full bg-primary px-4 py-1.5 text-label-md font-label-md font-bold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-95"
                >
                  Tam Detay
                </button>
                {onShowCanvas && (
                  <button
                    onClick={onShowCanvas}
                    className="flex items-center gap-1 rounded-full border border-tertiary-fixed-dim/40 bg-tertiary-fixed/30 px-4 py-1.5 text-label-md font-label-md font-bold text-tertiary transition-all hover:bg-tertiary-fixed/50"
                  >
                    <Network size={11} /> Harita
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Empty Section — Material You ───────────────────────────────────── */
function EmptySection({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="w-full rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/40 px-8 py-14 text-center">
      <div className="mb-4 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="font-headline-sm text-body-md font-bold text-on-surface mb-1.5">{title}</h3>
      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{desc}</p>
    </div>
  );
}
