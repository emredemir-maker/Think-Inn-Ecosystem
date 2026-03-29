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

type TabId = "discover" | "research" | "ideas" | "projects";
type ViewMode = "list" | "graph" | "global-map";
type LayoutMode = "grid" | "list";

const TABS: { id: TabId; label: string; icon: React.ElementType; accent: string; glow: string }[] = [
  { id: "discover",  label: "Keşfet",        icon: Sparkles,  accent: "#22d3ee", glow: "rgba(34,211,238,0.3)" },
  { id: "research",  label: "Araştırmalar",   icon: FileText,  accent: "#818cf8", glow: "rgba(99,102,241,0.3)" },
  { id: "ideas",     label: "Fikirler",       icon: Lightbulb, accent: "#fbbf24", glow: "rgba(251,191,36,0.3)" },
  { id: "projects",  label: "Projeler",       icon: Building2, accent: "#a78bfa", glow: "rgba(167,139,250,0.3)" },
];

/* ── Animated Background Orbs ──────────────────────────────────────── */
function AnimatedHero() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#060b18] via-[#0b1230] to-[#10082a]" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 400, height: 400, top: -100, right: -80, background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 300, height: 300, bottom: -60, left: '10%', background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 200, height: 200, top: '40%', left: '40%', background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            left: `${5 + (i * 4.7) % 90}%`,
            top: `${10 + (i * 7.3) % 80}%`,
            background: i % 2 === 0 ? 'rgba(34,211,238,0.6)' : 'rgba(99,102,241,0.6)',
          }}
          animate={{
            y: [-8, 8, -8],
            opacity: [0.3, 0.9, 0.3],
          }}
          transition={{
            duration: 4 + (i % 4),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        />
      ))}

      {/* Scan line */}
      <motion.div
        className="absolute inset-x-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4) 30%, rgba(99,102,241,0.7) 50%, rgba(34,211,238,0.4) 70%, transparent)' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
      />
    </div>
  );
}

/* ── Featured Card (mini version for discover) ─────────────────────── */
function FeaturedResearchCard({ research, onClick }: { research: Research; onClick: () => void }) {
  const hasImage = !!(research as any).hasCoverImage || !!research.coverImageB64;
  const imageSrc = research.coverImageB64
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : hasImage ? `/api/research/${research.id}/cover` : null;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0"
      style={{
        width: 220,
        background: 'rgba(10,16,34,0.9)',
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Image */}
      <div className="h-28 relative overflow-hidden bg-gradient-to-br from-[#0d1535] to-[#130c30]">
        {imageSrc && (
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover" loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-bold text-white uppercase tracking-wider bg-indigo-600/90 px-2 py-0.5 rounded-full">
            {research.status}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-white/80">
          <ThumbsUp size={9} />
          <span>{Math.max(0, research.voteCount)}</span>
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug mb-1">{research.title}</p>
        <p className="text-[10px] text-slate-500 truncate">{research.authorName}</p>
      </div>
    </motion.div>
  );
}

function FeaturedIdeaCard({ idea, onClick }: { idea: Idea; onClick: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0"
      style={{
        width: 220,
        background: 'rgba(10,16,34,0.9)',
        border: '1px solid rgba(251,191,36,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="h-28 relative overflow-hidden bg-gradient-to-br from-[#1a1205] to-[#120a00] flex items-center justify-center">
        <Lightbulb size={40} className="text-amber-400/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/20">
          <Star size={8} className="fill-amber-400" />
          <span>{Math.max(0, idea.voteCount)}</span>
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug mb-1">{idea.title}</p>
        <p className="text-[10px] text-slate-500 truncate">{idea.authorName}</p>
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canvasItem, setCanvasItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [detailItem, setDetailItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [projectIdeaId, setProjectIdeaId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'research' | 'idea'; title: string } | null>(null);

  // Poll research until all cover images are generated
  const [researchPollingEnabled, setResearchPollingEnabled] = useState(false);
  const { data: researchList, isLoading: isResearchLoading } = useListResearch({
    query: { refetchInterval: researchPollingEnabled ? 4000 : false }
  });

  const hasMissingImages = Array.isArray(researchList) && researchList.some(r => !(r as any).hasCoverImage && !(r as any).coverImageB64);
  React.useEffect(() => {
    setResearchPollingEnabled(hasMissingImages);
  }, [hasMissingImages]);

  const [pollingEnabled, setPollingEnabled] = useState(false);
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas({
    query: { refetchInterval: pollingEnabled ? 3000 : false }
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
    if (!q) return researchList;
    return researchList.filter(r =>
      r.title.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q) ||
      r.authorName?.toLowerCase().includes(q) || r.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [researchList, searchQuery]);

  const filteredIdeas = useMemo(() => {
    if (!Array.isArray(ideaList)) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return ideaList;
    return ideaList.filter(i =>
      i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) ||
      i.authorName?.toLowerCase().includes(q) || i.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [ideaList, searchQuery]);

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

        {/* ── Tab Navigation Header ─────────────────────────────── */}
        <div
          className="shrink-0 relative"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.2)' }}
        >
          {/* Subtle bg */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#060b18] to-transparent pointer-events-none" />

          <div className="relative flex items-center justify-end px-4 pt-2 pb-0">
            {/* Right controls */}
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setIsSuperAdmin(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all backdrop-blur-sm ${
                  isSuperAdmin
                    ? 'bg-red-500/20 text-red-200 border-red-400/40'
                    : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {isSuperAdmin ? <ShieldOff size={11} /> : <Shield size={11} />}
                Admin
              </button>
              <button
                onClick={openGlobalMap}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 backdrop-blur-sm text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all"
              >
                <Globe size={12} /> Harita
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="relative flex items-end px-4 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all rounded-t-xl"
                  style={{
                    color: isActive ? tab.accent : 'rgba(148,163,184,0.6)',
                    background: isActive ? 'rgba(10,16,34,0.9)' : 'transparent',
                    borderTop: isActive ? `1px solid rgba(99,102,241,0.25)` : '1px solid transparent',
                    borderLeft: isActive ? `1px solid rgba(99,102,241,0.25)` : '1px solid transparent',
                    borderRight: isActive ? `1px solid rgba(99,102,241,0.25)` : '1px solid transparent',
                  }}
                >
                  <Icon size={12} />
                  <span className="tracking-wider uppercase">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 inset-x-0 h-0.5"
                      style={{ background: `linear-gradient(90deg, transparent, ${tab.accent}, transparent)` }}
                    />
                  )}
                  {/* Count badges */}
                  {tab.id === 'research' && (researchList?.length ?? 0) > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                      {researchList!.length}
                    </span>
                  )}
                  {tab.id === 'ideas' && (ideaList?.length ?? 0) > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      {ideaList!.length}
                    </span>
                  )}
                  {tab.id === 'projects' && projectIdeas.length > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
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
                  {/* Pre-title */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-2 mb-3"
                  >
                    <div className="w-px h-4 bg-cyan-400/50" />
                    <span className="text-[10px] font-bold text-cyan-400/70 tracking-[0.25em] uppercase font-mono">
                      İnovasyon Platformu
                    </span>
                  </motion.div>

                  {/* Main title */}
                  <motion.h1
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-3xl font-black text-white mb-2 leading-tight"
                    style={{ textShadow: '0 0 40px rgba(99,102,241,0.4)' }}
                  >
                    Fikirleri Geleceğe<br />
                    <span style={{ background: 'linear-gradient(90deg, #818cf8, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Dönüştürüyoruz
                    </span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-sm text-slate-400 mb-5 leading-relaxed max-w-md"
                  >
                    Araştırma, fikir ve proje kartlarını keşfedin. AI asistanıyla inovasyon sürecinizi hızlandırın.
                  </motion.p>

                  {/* Stats row */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-4 flex-wrap"
                  >
                    {[
                      { icon: FileText,   val: researchList?.length ?? 0, label: "Araştırma", color: "#818cf8" },
                      { icon: Lightbulb,  val: ideaList?.length ?? 0,     label: "Fikir",      color: "#fbbf24" },
                      { icon: TrendingUp, val: totalVotes,                label: "Toplam Oy", color: "#22d3ee" },
                      { icon: Building2,  val: projectIdeas.length,       label: "Proje",      color: "#a78bfa" },
                    ].map(({ icon: Icon, val, label, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <Icon size={13} style={{ color }} />
                        <span className="text-lg font-black" style={{ color, textShadow: `0 0 12px ${color}` }}>{val}</span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{label}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Bottom gradient fade */}
                <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#060b18] to-transparent z-10 pointer-events-none" />
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
                        iconBg="from-amber-500 to-orange-500"
                        label="En Beğenilen Fikirler"
                        count={topIdeas.length}
                        countColor={{ bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' }}
                        lineColor="rgba(251,191,36,0.3)"
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
                        iconBg="from-violet-500 to-indigo-600"
                        label="Son Araştırmalar"
                        count={latestResearch.length}
                        countColor={{ bg: 'rgba(99,102,241,0.1)', text: '#818cf8', border: 'rgba(99,102,241,0.2)' }}
                        lineColor="rgba(99,102,241,0.3)"
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
                        iconBg="from-violet-500 to-purple-600"
                        label="Projeler"
                        count={projectIdeas.length}
                        countColor={{ bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', border: 'rgba(139,92,246,0.2)' }}
                        lineColor="rgba(139,92,246,0.3)"
                        onSeeAll={() => setActiveTab('projects')}
                      />
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        onClick={() => setActiveTab('projects')}
                        className="w-full rounded-2xl p-5 flex items-center gap-4 transition-all"
                        style={{
                          background: 'rgba(10,16,34,0.7)',
                          border: '1px solid rgba(139,92,246,0.2)',
                        }}
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center border border-violet-500/20">
                          <Building2 size={22} className="text-violet-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-slate-200 mb-0.5">{projectIdeas.length} Aktif Proje</p>
                          <p className="text-xs text-slate-500">Mimari analize dönüşmüş fikirler</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-600" />
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Empty state */}
                  {!isLoading && topIdeas.length === 0 && latestResearch.length === 0 && (
                    <div className="py-20 flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        <Sparkles size={28} className="text-indigo-400" />
                      </motion.div>
                      <p className="text-slate-400 font-semibold text-sm">Henüz içerik eklenmemiş</p>
                      <p className="text-slate-600 text-xs">AI asistanına bir araştırma veya fikir anlatın.</p>
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
              {/* Search + layout controls */}
              <div className="shrink-0 px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                <div
                  className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-all`}
                  style={{
                    background: 'rgba(10,16,34,0.8)',
                    border: searchFocused ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(99,102,241,0.2)',
                    boxShadow: searchFocused ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
                  }}
                >
                  <Search size={13} className={searchFocused ? 'text-cyan-400' : 'text-slate-500'} />
                  <input
                    className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none"
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
                    <button onClick={() => setSearchQuery("")} className="text-slate-500 hover:text-slate-300">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {activeTab !== 'projects' && (
                  <div
                    className="flex items-center rounded-lg p-0.5 flex-shrink-0"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.3)' }}
                  >
                    <button
                      onClick={() => setLayoutMode("grid")}
                      className="p-1.5 rounded transition-all"
                      style={layoutMode === "grid" ? { background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' } : { color: 'rgba(148,163,184,0.5)' }}
                    >
                      <LayoutGrid size={12} />
                    </button>
                    <button
                      onClick={() => setLayoutMode("list")}
                      className="p-1.5 rounded transition-all"
                      style={layoutMode === "list" ? { background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' } : { color: 'rgba(148,163,184,0.5)' }}
                    >
                      <LayoutList size={12} />
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
                        icon={<FileText size={28} className="text-indigo-400/40" />}
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
                        icon={<Lightbulb size={28} className="text-amber-400/40" />}
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
                        icon={<Building2 size={28} className="text-violet-400/40" />}
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

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
            style={{ background: 'rgba(10,16,34,0.95)', border: '1px solid rgba(239,68,68,0.3)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">Sil: {deleteConfirm.type === 'research' ? 'Araştırma' : 'Fikir'}</h3>
                <p className="text-xs text-slate-500">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              <span className="font-semibold text-slate-200">"{deleteConfirm.title}"</span> başlıklı içeriği kalıcı olarak silmek istiyor musunuz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-400 font-medium transition-colors hover:bg-slate-800/50"
                style={{ border: '1px solid rgba(99,102,241,0.2)' }}
              >
                Vazgeç
              </button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
                Evet, Sil
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ── Section Header ─────────────────────────────────────────────────── */
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
      <span className="text-[9px] font-bold text-indigo-500/50 font-mono tracking-widest">{number}</span>
      <div className={`w-5 h-5 rounded-lg bg-gradient-to-br ${iconBg} flex items-center justify-center`}>{icon}</div>
      <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">{label}</span>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
        style={{ background: countColor.bg, color: countColor.text, border: `1px solid ${countColor.border}` }}
      >
        {String(count).padStart(2, '0')}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${lineColor}, transparent)` }} />
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
        >
          Tümü <ArrowRight size={9} />
        </button>
      )}
    </div>
  );
}

/* ── Skeleton Section ───────────────────────────────────────────────── */
function SkeletonSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg animate-pulse" style={{ background: 'rgba(99,102,241,0.15)' }} />
        <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'rgba(99,102,241,0.15)' }} />
        <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.1)' }} />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border overflow-hidden flex-shrink-0" style={{ width: 220, background: 'rgba(10,16,34,0.85)', borderColor: 'rgba(99,102,241,0.12)' }}>
            <div className="h-28 relative overflow-hidden" style={{ background: 'rgba(13,21,53,0.8)' }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.07) 50%, transparent 100%)', animation: 'shimmer 2s infinite', backgroundSize: '200% 100%' }} />
            </div>
            <div className="p-3 space-y-2">
              <div className="h-2.5 rounded animate-pulse w-3/4" style={{ background: 'rgba(99,102,241,0.12)' }} />
              <div className="h-2 rounded animate-pulse w-1/2" style={{ background: 'rgba(99,102,241,0.08)' }} />
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
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 shadow-sm transition-all opacity-0 group-hover/del:opacity-100"
          style={{ background: 'rgba(10,16,34,0.9)' }}
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
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl transition-all"
      style={{
        background: 'rgba(10,16,34,0.85)',
        border: open ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(99,102,241,0.15)',
        boxShadow: open ? '0 0 20px rgba(99,102,241,0.1)' : 'none',
      }}
    >
      <div className="w-full px-4 py-3 flex items-center gap-4 cursor-pointer select-none" onClick={() => setOpen(v => !v)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <FileText size={14} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{research.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500 flex-shrink-0">{research.authorName}</span>
            {research.createdAt && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-600 flex items-center gap-1 flex-shrink-0">
                  <Calendar size={9} />
                  {format(new Date(research.createdAt), 'dd MMM yyyy', { locale: tr })}
                </span>
              </>
            )}
            {research.tags?.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{t}</span>
            ))}
          </div>
        </div>
        <button
          onClick={handleVote}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all shadow-sm flex-shrink-0 ${
            voted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:border-indigo-400/40 hover:bg-indigo-500/20'
          }`}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, research.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown size={14} className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
              {research.summary && <p className="text-sm text-slate-400 mt-3 mb-3 leading-relaxed">{research.summary}</p>}
              {research.tags && research.tags.length > 3 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {research.tags.map(t => <span key={t} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-medium">{t}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={onDetail} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">Tam Detay</button>
                {onShowCanvas && (
                  <button onClick={onShowCanvas} className="flex items-center gap-1 text-xs px-3 py-1.5 text-indigo-400 rounded-lg font-medium hover:bg-indigo-500/10 transition-colors" style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
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
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl transition-all"
      style={{
        background: 'rgba(10,16,34,0.85)',
        border: open ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(99,102,241,0.15)',
        boxShadow: open ? '0 0 20px rgba(251,191,36,0.05)' : 'none',
      }}
    >
      <div className="w-full px-4 py-3 flex items-center gap-4 cursor-pointer select-none" onClick={() => setOpen(v => !v)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
          <Lightbulb size={14} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{idea.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500 flex-shrink-0">{idea.authorName}</span>
            {hasResearch ? (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 size={9} />{idea.researchIds.length} Araştırma
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/15 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 flex-shrink-0">
                <AlertTriangle size={9} />Araştırmasız
              </span>
            )}
            {idea.tags?.slice(0, 2).map(t => (
              <span key={t} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{t}</span>
            ))}
          </div>
        </div>
        <button
          onClick={handleVote}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all shadow-sm flex-shrink-0 ${
            voted ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:border-amber-400/40 hover:bg-amber-500/20'
          }`}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, idea.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown size={14} className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
              {idea.description && <p className="text-sm text-slate-400 mt-3 mb-3 leading-relaxed line-clamp-4">{idea.description}</p>}
              {idea.collaborators && idea.collaborators.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-500">
                  <Users size={11} className="text-indigo-400" />
                  <span className="font-medium">Ekip:</span>
                  {idea.collaborators.join(', ')}
                </div>
              )}
              {idea.tags && idea.tags.length > 2 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {idea.tags.map(t => <span key={t} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-medium">{t}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={onDetail} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors">Tam Detay</button>
                {onShowCanvas && (
                  <button onClick={onShowCanvas} className="flex items-center gap-1 text-xs px-3 py-1.5 text-amber-400 rounded-lg font-medium hover:bg-amber-500/10 transition-colors" style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
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

/* ── Empty Section ──────────────────────────────────────────────────── */
function EmptySection({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="py-14 px-8 text-center border border-dashed rounded-2xl w-full"
      style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(10,16,34,0.4)' }}
    >
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: 'rgba(10,16,34,0.7)', border: '1px solid rgba(99,102,241,0.15)' }}>
          {icon}
        </div>
      </div>
      <h3 className="text-sm font-bold text-slate-400 mb-1.5">{title}</h3>
      <p className="text-slate-600 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
