import React, { useState, useMemo } from "react";
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
  ThumbsUp, ThumbsDown
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
  const [detailItem, setDetailItem] = useState<{ item: Research | Idea; type: 'research' | 'idea' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; type: 'research' | 'idea'; title: string } | null>(null);

  const { data: researchList, isLoading: isResearchLoading } = useListResearch();
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas();
  const { mutate: submitVote } = useVote();
  const { mutate: deleteResearch } = useDeleteResearch();
  const { mutate: deleteIdea } = useDeleteIdea();
  const queryClient = useQueryClient();

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

  const handleCardClick = (item: Research | Idea, type: 'research' | 'idea') => setDetailItem({ item, type });
  const handleShowCanvas = (item: Research | Idea, type: 'research' | 'idea') => {
    setCanvasItem({ id: item.id, type });
    setViewMode('graph');
  };
  const handleNodeClick = (id: number, type: 'research' | 'idea') => {
    const item = type === 'research' ? researchList?.find(r => r.id === id) : ideaList?.find(i => i.id === id);
    if (item) setDetailItem({ item, type });
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
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f8f9fa]">

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

      /* ── Komuta Merkezi list mode ─────────────────────────────── */
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Command bar */}
        <div className="px-6 pt-5 pb-3 shrink-0">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a2e] tracking-tight">İnovasyon Vitrini</h1>
              <p className="text-[#6b7280] mt-0.5 text-xs">Keşfedin, değerlendirin ve iş birliği yapın.</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Superadmin toggle */}
              <button
                onClick={() => setIsSuperAdmin(v => !v)}
                title={isSuperAdmin ? "Süper Admin modundan çık" : "Süper Admin modu"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isSuperAdmin
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                }`}
              >
                {isSuperAdmin ? <ShieldOff size={12} /> : <Shield size={12} />}
                {isSuperAdmin ? 'Admin Modu' : 'Admin'}
              </button>
              <button
                onClick={openGlobalMap}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
              >
                <Map size={14} /> Genel Harita
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className={`relative transition-all duration-150 ${searchFocused ? 'scale-[1.005]' : ''}`}>
            <div className={`flex items-center gap-3 bg-white rounded-2xl border px-4 py-2.5 transition-all ${searchFocused ? 'border-indigo-400 shadow-md shadow-indigo-100/60' : 'border-gray-200 shadow-sm'}`}>
              <Search size={16} className={`flex-shrink-0 transition-colors ${searchFocused ? 'text-indigo-500' : 'text-gray-400'}`} />
              <input
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
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
                <div className="flex items-center gap-0.5 text-[10px] text-gray-300 font-mono border border-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                  <Command size={9} />K
                </div>
              )}
            </div>
          </div>

          {/* Quick filters + layout toggle */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <Filter size={11} className="text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {QUICK_FILTERS.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    activeFilter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {(searchQuery || activeFilter !== "Tümü") && activeFilter !== "Mimari" && (
              <span className="text-xs text-gray-400 flex-shrink-0">{totalResults} sonuç</span>
            )}
            {/* Layout toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 ml-1 flex-shrink-0">
              <button
                onClick={() => setLayoutMode("grid")}
                className={`p-1 rounded transition-all ${layoutMode === "grid" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                title="Kart Görünümü"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setLayoutMode("list")}
                className={`p-1 rounded transition-all ${layoutMode === "list" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                title="Liste Görünümü"
              >
                <LayoutList size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="w-full h-48 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin mb-3 text-indigo-600" size={24} />
              <span className="text-sm font-medium text-gray-500">Yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Stats summary */}
              {!searchQuery && activeFilter === "Tümü" && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: FileText,   label: "Araştırma", val: researchList?.length ?? 0, color: "indigo" },
                    { icon: Lightbulb,  label: "Fikir",     val: ideaList?.length ?? 0,     color: "amber"  },
                    { icon: TrendingUp, label: "Toplam Oy", val: [...(researchList ?? []), ...(ideaList ?? [])].reduce((s, i) => s + (i.voteCount ?? 0), 0), color: "green" },
                  ].map(({ icon: Icon, label, val, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color}-50`}>
                        <Icon size={15} className={`text-${color}-600`} />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900 leading-none">{val}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Research section */}
              {showResearch && filteredResearch.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={12} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Araştırmalar</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{filteredResearch.length}</span>
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
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={12} className="text-amber-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fikirler</span>
                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">{filteredIdeas.length}</span>
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
                  icon={<Building2 size={36} className="text-gray-300" />}
                  title="Mimari Yapı"
                  desc="Mimari şemalar henüz eklenmemiş. Asistandan oluşturmasını isteyin."
                />
              )}

              {/* Empty states */}
              {activeFilter !== "Mimari" && showResearch && showIdeas && filteredResearch.length === 0 && filteredIdeas.length === 0 && (
                <div className="py-14 text-center border border-dashed border-gray-200 bg-white rounded-2xl">
                  <Sparkles size={28} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium text-sm mb-1">
                    {searchQuery ? `"${searchQuery}" için sonuç bulunamadı.` : "Henüz içerik eklenmemiş."}
                  </p>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-xs text-indigo-500 hover:text-indigo-700 mt-1 font-medium">
                      Aramayı temizle
                    </button>
                  )}
                </div>
              )}
              {showResearch && !showIdeas && filteredResearch.length === 0 && activeFilter !== "Mimari" && (
                <div className="py-10 text-center border border-dashed border-gray-200 bg-white rounded-2xl">
                  <p className="text-gray-400 text-sm">{searchQuery ? "Araştırma bulunamadı." : "Henüz araştırma eklenmemiş."}</p>
                </div>
              )}
              {showIdeas && !showResearch && filteredIdeas.length === 0 && activeFilter !== "Mimari" && (
                <div className="py-10 text-center border border-dashed border-gray-200 bg-white rounded-2xl">
                  <p className="text-gray-400 text-sm">{searchQuery ? "Fikir bulunamadı." : "Henüz fikir eklenmemiş."}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <CardDetailModal
          item={detailItem.item}
          type={detailItem.type}
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
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); onVote(research.id, 1); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
          >
            <ThumbsUp size={11} />
            <span>{research.voteCount}</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onVote(research.id, -1); }}
            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <ThumbsDown size={11} />
          </button>
        </div>
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
  const hasResearch = idea.researchIds && idea.researchIds.length > 0;

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
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); onVote(idea.id, 1); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm"
          >
            <ThumbsUp size={11} />
            <span>{idea.voteCount}</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onVote(idea.id, -1); }}
            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
          >
            <ThumbsDown size={11} />
          </button>
        </div>
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

function EmptySection({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="py-14 px-8 text-center border border-dashed border-gray-200 bg-white rounded-2xl w-full">
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-600 mb-1">{title}</h3>
      <p className="text-gray-400 text-xs">{desc}</p>
    </div>
  );
}
