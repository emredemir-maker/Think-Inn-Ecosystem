import React, { useState, useMemo, useEffect } from "react";
import {
  useListResearch, useListIdeas, useVote,
  useDeleteResearch, useDeleteIdea,
  Research, Idea
} from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import {
  FileText, Lightbulb, Loader2, Search,
  Building2, Map, Sparkles, Filter,
  X, Command, TrendingUp, LayoutGrid, LayoutList,
  Network, ChevronDown,
  CheckCircle2, AlertTriangle, Calendar,
  Users, Shield, ShieldOff, Trash2,
  ThumbsUp
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { RelationGraph } from "../graph/RelationGraph";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type QuickFilter = "Tümü" | "Araştırma" | "Fikir" | "Mimari" | "Bu hafta";
type ViewMode = "list" | "graph" | "global-map";
type LayoutMode = "grid" | "list";

const QUICK_FILTERS: QuickFilter[] = ["Tümü", "Araştırma", "Fikir", "Mimari", "Bu hafta"];

export function VitrinePanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("Tümü");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canvasItem, setCanvasItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [detailItem, setDetailItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'research' | 'idea'; title: string } | null>(null);

  const { data: researchList, isLoading: isResearchLoading } = useListResearch();

  const [pollingEnabled, setPollingEnabled] = useState(false);

  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas({
    query: { refetchInterval: pollingEnabled ? 3000 : false }
  });

  // Poll only when modal is open for an idea that hasn't been evaluated yet
  useEffect(() => {
    if (detailItem?.type !== 'idea') { setPollingEnabled(false); return; }
    const idea = ideaList?.find(i => i.id === detailItem.id);
    // evaluatedAt is returned from API but not in generated TS type — use cast
    const hasEval = !!(idea && (idea as any).evaluatedAt);
    setPollingEnabled(!hasEval);
  }, [detailItem, ideaList]);
  const { mutate: submitVote } = useVote();
  const { mutate: deleteResearch } = useDeleteResearch();
  const { mutate: deleteIdea } = useDeleteIdea();
  const queryClient = useQueryClient();

  // Derive the live modal item from fresh query data (not stale state snapshot)
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
  const handleNodeClick = (id: number, type: 'research' | 'idea') => {
    setDetailItem({ id, type });
  };
  const backToList = () => { setViewMode('list'); setCanvasItem(null); };
  const openGlobalMap = () => setViewMode('global-map');

  const oneWeekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; }, []);

  const filteredResearch = useMemo(() => {
    if (!researchList) return [];
    let list = researchList;
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(r =>
      r.title.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q) ||
      r.authorName?.toLowerCase().includes(q) || r.tags?.some(t => t.toLowerCase().includes(q))
    );
    if (activeFilter === "Bu hafta") list = list.filter(r => new Date(r.createdAt) >= oneWeekAgo);
    return list;
  }, [researchList, searchQuery, activeFilter, oneWeekAgo]);

  const filteredIdeas = useMemo(() => {
    if (!ideaList) return [];
    let list = ideaList;
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter(i =>
      i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) ||
      i.authorName?.toLowerCase().includes(q) || i.tags?.some(t => t.toLowerCase().includes(q))
    );
    if (activeFilter === "Bu hafta") list = list.filter(i => new Date(i.createdAt) >= oneWeekAgo);
    return list;
  }, [ideaList, searchQuery, activeFilter, oneWeekAgo]);

  const isLoading = isResearchLoading || isIdeasLoading;
  const totalResults = filteredResearch.length + filteredIdeas.length;
  const showResearch = activeFilter !== "Fikir" && activeFilter !== "Mimari";
  const showIdeas    = activeFilter !== "Araştırma" && activeFilter !== "Mimari";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f4f6fb]">

      {/* ── Graph / Map modes ─────────────────────────────────────── */}
      {viewMode === 'graph' && canvasItem ? (
        <RelationGraph
          selectedId={canvasItem.id} selectedType={canvasItem.type}
          allResearch={researchList || []} allIdeas={ideaList || []}
          onBack={backToList} onNodeClick={handleNodeClick}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : viewMode === 'global-map' ? (
        <RelationGraph
          globalMode allResearch={researchList || []} allIdeas={ideaList || []}
          onBack={backToList} onNodeClick={handleNodeClick}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : (

      /* ── List mode ─────────────────────────────────────────────── */
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Hero Banner ──────────────────────────────────────────── */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Background gradient + pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800" />
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                                radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
          {/* Glowing orbs */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-purple-500/30 blur-3xl" />
          <div className="absolute -bottom-8 left-1/4 w-36 h-36 rounded-full bg-indigo-400/20 blur-2xl" />

          <div className="relative px-6 pt-5 pb-4">
            {/* Title + controls row */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl font-extrabold text-white tracking-tight"
                >
                  İnovasyon Vitrini
                </motion.h1>
                <p className="text-indigo-200 mt-0.5 text-xs font-medium">
                  Keşfedin, değerlendirin ve iş birliği yapın
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSuperAdmin(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all backdrop-blur-sm ${
                    isSuperAdmin
                      ? 'bg-red-500/20 text-red-200 border-red-400/40 hover:bg-red-500/30'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {isSuperAdmin ? <ShieldOff size={12} /> : <Shield size={12} />}
                  {isSuperAdmin ? 'Admin' : 'Admin'}
                </button>
                <button
                  onClick={openGlobalMap}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/25 hover:bg-white/25 transition-all"
                >
                  <Map size={13} /> Genel Harita
                </button>
              </div>
            </div>

            {/* Stats row */}
            {!searchQuery && activeFilter === "Tümü" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-3 mb-4"
              >
                {[
                  { icon: FileText,   label: "Araştırma", val: researchList?.length ?? 0,     from: "from-blue-400",   to: "to-indigo-500" },
                  { icon: Lightbulb,  label: "Fikir",     val: ideaList?.length ?? 0,         from: "from-amber-400",  to: "to-orange-500" },
                  { icon: TrendingUp, label: "Toplam Oy", val: [...(researchList ?? []), ...(ideaList ?? [])].reduce((s, i) => s + (i.voteCount ?? 0), 0), from: "from-emerald-400", to: "to-teal-500" },
                ].map(({ icon: Icon, label, val, from, to }) => (
                  <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 px-4 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${from} ${to} shadow-lg`}>
                      <Icon size={15} className="text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white leading-none">{val}</div>
                      <div className="text-[10px] text-indigo-200 mt-0.5 font-medium">{label}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Search bar */}
            <div className={`relative transition-all duration-200 ${searchFocused ? 'scale-[1.01]' : ''}`}>
              <div className={`flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl border px-4 py-2.5 transition-all shadow-lg ${
                searchFocused ? 'border-white shadow-white/20' : 'border-white/50'
              }`}>
                <Search size={15} className={`flex-shrink-0 transition-colors ${searchFocused ? 'text-indigo-600' : 'text-gray-400'}`} />
                <input
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none font-medium"
                  placeholder="Araştırma, fikir veya konu ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {searchQuery ? (
                  <button onClick={() => setSearchQuery("")} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={14} />
                  </button>
                ) : (
                  <div className="flex items-center gap-0.5 text-[10px] text-gray-300 font-mono border border-gray-200 px-1.5 py-0.5 rounded flex-shrink-0">
                    <Command size={9} />K
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter chips + layout toggle */}
          <div className="relative flex items-center gap-1.5 px-6 pb-3">
            <Filter size={11} className="text-indigo-300 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {QUICK_FILTERS.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${
                    activeFilter === f
                      ? 'bg-white text-indigo-700 shadow-md shadow-indigo-900/20'
                      : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white border border-white/20'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {(searchQuery || activeFilter !== "Tümü") && activeFilter !== "Mimari" && (
              <span className="text-xs text-indigo-200 flex-shrink-0 font-medium">{totalResults} sonuç</span>
            )}
            <div className="flex items-center bg-white/10 border border-white/20 rounded-lg p-0.5 ml-1 flex-shrink-0 backdrop-blur-sm">
              <button
                onClick={() => setLayoutMode("grid")}
                className={`p-1 rounded transition-all ${layoutMode === "grid" ? "bg-white text-indigo-700 shadow-sm" : "text-white/60 hover:text-white"}`}
                title="Kart Görünümü"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setLayoutMode("list")}
                className={`p-1 rounded transition-all ${layoutMode === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-white/60 hover:text-white"}`}
                title="Liste Görünümü"
              >
                <LayoutList size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {isLoading ? (
            <div className="w-full h-48 flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-100" />
                <Loader2 className="animate-spin text-indigo-600 absolute inset-0 m-auto" size={20} />
              </div>
              <span className="text-sm font-medium text-gray-400">Yükleniyor...</span>
            </div>
          ) : (
            <>

              {/* Research section */}
              {showResearch && filteredResearch.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                      <FileText size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">Araştırmalar</span>
                    <span className="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{filteredResearch.length}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-100 to-transparent" />
                  </div>

                  {layoutMode === "grid" ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {filteredResearch.map(r => (
                        <DeletableWrapper
                          key={`res-${r.id}`}
                          isSuperAdmin={isSuperAdmin}
                          onDelete={() => handleDelete(r.id, 'research', r.title)}
                        >
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
                  )}
                </div>
              )}

              {/* Ideas section */}
              {showIdeas && filteredIdeas.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                      <Lightbulb size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">Fikirler</span>
                    <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{filteredIdeas.length}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-100 to-transparent" />
                  </div>

                  {layoutMode === "grid" ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {filteredIdeas.map(i => (
                        <DeletableWrapper
                          key={`idea-${i.id}`}
                          isSuperAdmin={isSuperAdmin}
                          onDelete={() => handleDelete(i.id, 'idea', i.title)}
                        >
                          <IdeaCard
                            idea={i as Idea}
                            onVote={(id, val) => handleVote("idea", id, val)}
                            onClick={() => handleCardClick(i as Idea, 'idea')}
                            onShowCanvas={() => handleShowCanvas(i as Idea, 'idea')}
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
                  )}
                </div>
              )}

              {/* Architecture placeholder */}
              {activeFilter === "Mimari" && (
                <EmptySection
                  icon={<Building2 size={36} className="text-indigo-300" />}
                  title="Mimari Yapı"
                  desc="Mimari şemalar henüz eklenmemiş. Asistandan oluşturmasını isteyin."
                  gradient="from-indigo-50 to-blue-50"
                />
              )}

              {/* Empty states */}
              {activeFilter !== "Mimari" && showResearch && showIdeas && filteredResearch.length === 0 && filteredIdeas.length === 0 && (
                <div className="py-16 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <Sparkles size={28} className="text-indigo-400" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-400"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600 font-semibold text-sm mb-1">
                      {searchQuery ? `"${searchQuery}" için sonuç bulunamadı` : "Henüz içerik eklenmemiş"}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {searchQuery ? "Farklı bir arama terimi deneyin." : "Asistana bir araştırma veya fikir anlatın."}
                    </p>
                  </div>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 px-4 py-1.5 rounded-full transition-colors">
                      Aramayı temizle
                    </button>
                  )}
                </div>
              )}
              {showResearch && !showIdeas && filteredResearch.length === 0 && activeFilter !== "Mimari" && (
                <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                  <FileText size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">{searchQuery ? "Araştırma bulunamadı." : "Henüz araştırma eklenmemiş."}</p>
                </div>
              )}
              {showIdeas && !showResearch && filteredIdeas.length === 0 && activeFilter !== "Mimari" && (
                <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                  <Lightbulb size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">{searchQuery ? "Fikir bulunamadı." : "Henüz fikir eklenmemiş."}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Detail Modal — liveDetailItem is derived from the live query so it auto-updates */}
      {liveDetailItem && (
        <CardDetailModal
          item={liveDetailItem.item}
          type={liveDetailItem.type}
          allResearch={researchList || []}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl border border-red-100 p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Sil: {deleteConfirm.type === 'research' ? 'Araştırma' : 'Fikir'}</h3>
                <p className="text-xs text-gray-400">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-semibold text-gray-800">"{deleteConfirm.title}"</span> başlıklı içeriği kalıcı olarak silmek istiyor musunuz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
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

/* ── Deletable Card Wrapper (grid mode) ──────────────────────────── */

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
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/90 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 shadow-sm transition-all opacity-0 group-hover/del:opacity-100"
          title="Sil"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Accordion List Rows ──────────────────────────────────────────── */

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
      className={`bg-white rounded-xl border shadow-sm transition-all ${open ? 'border-indigo-200 shadow-md' : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'}`}
    >
      {/* Header row */}
      <div
        className="w-full px-4 py-3 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{research.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 flex-shrink-0">{research.authorName}</span>
            {research.createdAt && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                  <Calendar size={9} />
                  {format(new Date(research.createdAt), 'dd MMM yyyy', { locale: tr })}
                </span>
              </>
            )}
            {research.tags?.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{t}</span>
            ))}
          </div>
        </div>
        {/* Vote */}
        <button
          onClick={handleVote}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all shadow-sm flex-shrink-0 ${
            voted
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, research.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Sil"
          >
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown size={14} className={`text-gray-300 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-gray-50">
              {research.summary && (
                <p className="text-sm text-gray-600 mt-3 mb-3 leading-relaxed">{research.summary}</p>
              )}
              {research.tags && research.tags.length > 3 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {research.tags.map(t => (
                    <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onDetail}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Tam Detay
                </button>
                {onShowCanvas && (
                  <button
                    onClick={onShowCanvas}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
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
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border shadow-sm transition-all ${open ? 'border-amber-200 shadow-md' : 'border-gray-100 hover:border-amber-200 hover:shadow-md'}`}
    >
      {/* Header row */}
      <div
        className="w-full px-4 py-3 flex items-center gap-4 cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={14} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{idea.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 flex-shrink-0">{idea.authorName}</span>
            {hasResearch ? (
              <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 size={9} />{idea.researchIds.length} Araştırma
              </span>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 flex-shrink-0">
                <AlertTriangle size={9} />Araştırmasız
              </span>
            )}
            {idea.tags?.slice(0, 2).map(t => (
              <span key={t} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{t}</span>
            ))}
          </div>
        </div>
        {/* Vote */}
        <button
          onClick={handleVote}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all shadow-sm flex-shrink-0 ${
            voted
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
          }`}
        >
          <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
          <span>{Math.max(0, idea.voteCount)}</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(); }}
            className="flex-shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Sil"
          >
            <Trash2 size={13} />
          </button>
        )}
        <ChevronDown size={14} className={`text-gray-300 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-gray-50">
              {idea.description && (
                <p className="text-sm text-gray-600 mt-3 mb-3 leading-relaxed line-clamp-4">{idea.description}</p>
              )}
              {idea.collaborators && idea.collaborators.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-500">
                  <Users size={11} className="text-indigo-400" />
                  <span className="font-medium">Ekip:</span>
                  {idea.collaborators.join(', ')}
                </div>
              )}
              {idea.tags && idea.tags.length > 2 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {idea.tags.map(t => (
                    <span key={t} className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-medium">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onDetail}
                  className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  Tam Detay
                </button>
                {onShowCanvas && (
                  <button
                    onClick={onShowCanvas}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-amber-200 text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors"
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

function EmptySection({ icon, title, desc, gradient = "from-gray-50 to-slate-50" }: {
  icon: React.ReactNode; title: string; desc: string; gradient?: string;
}) {
  return (
    <div className={`py-14 px-8 text-center border border-dashed border-gray-200 bg-gradient-to-br ${gradient} rounded-2xl w-full`}>
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-sm font-bold text-gray-700 mb-1.5">{title}</h3>
      <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
