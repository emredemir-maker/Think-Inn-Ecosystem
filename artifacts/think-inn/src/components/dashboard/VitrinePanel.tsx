import React, { useState, useMemo } from "react";
import { useListResearch, useListIdeas, useVote, Research, Idea } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import {
  FileText, Lightbulb, Share2, Loader2, Search,
  Building2, BarChart3, Map, Sparkles, Filter,
  X, ChevronRight, Command, Users, TrendingUp
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { RelationGraph } from "../graph/RelationGraph";

type QuickFilter = "Tümü" | "Araştırma" | "Fikir" | "Mimari" | "Bu hafta";
type ViewMode = "list" | "graph" | "global-map";

const QUICK_FILTERS: QuickFilter[] = ["Tümü", "Araştırma", "Fikir", "Mimari", "Bu hafta"];

export function VitrinePanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("Tümü");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [canvasItem, setCanvasItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [detailItem, setDetailItem] = useState<{ item: Research | Idea; type: 'research' | 'idea' } | null>(null);

  const { data: researchList, isLoading: isResearchLoading } = useListResearch();
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas();
  const { mutate: submitVote } = useVote();
  const queryClient = useQueryClient();

  const handleVote = (targetType: "research" | "idea", targetId: number, value: 1 | -1) => {
    submitVote(
      { data: { targetType, targetId, voterName: "CurrentUser", value } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/${targetType === 'research' ? 'research' : 'ideas'}`] }) }
    );
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
  const isMapMode = viewMode === 'graph' || viewMode === 'global-map';
  const totalResults = filteredResearch.length + filteredIdeas.length;
  const showResearch = activeFilter !== "Fikir" && activeFilter !== "Mimari";
  const showIdeas    = activeFilter !== "Araştırma" && activeFilter !== "Mimari";
  const showArchitecture = activeFilter === "Mimari" || activeFilter === "Tümü";

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
            <button
              onClick={openGlobalMap}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
            >
              <Map size={14} /> Genel Harita
            </button>
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

          {/* Quick filters */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <Filter size={11} className="text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-1 flex-wrap">
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
            {(searchQuery || activeFilter !== "Tümü") && (
              <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
                {activeFilter === "Mimari" ? "Mimari Yapı" : `${totalResults} sonuç`}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="w-full h-48 flex flex-col items-center justify-center text-indigo-600">
              <Loader2 className="animate-spin mb-3" size={24} />
              <span className="text-sm font-medium text-gray-500">Yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* Stats summary (shown when no query and filter is "Tümü") */}
              {!searchQuery && activeFilter === "Tümü" && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: FileText,   label: "Araştırma",       val: researchList?.length ?? 0, color: "indigo" },
                    { icon: Lightbulb,  label: "Fikir",            val: ideaList?.length ?? 0,     color: "amber"  },
                    { icon: TrendingUp, label: "Toplam Oy",        val: [...(researchList ?? []), ...(ideaList ?? [])].reduce((s, i) => s + (i.voteCount ?? 0), 0), color: "green" },
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {filteredResearch.map(r => (
                      <ResearchCard
                        key={`res-${r.id}`}
                        research={r as Research}
                        onVote={(id, val) => handleVote("research", id, val)}
                        onClick={() => handleCardClick(r as Research, 'research')}
                        onShowCanvas={() => handleShowCanvas(r as Research, 'research')}
                      />
                    ))}
                  </div>
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {filteredIdeas.map(i => (
                      <IdeaCard
                        key={`idea-${i.id}`}
                        idea={i as Idea}
                        onVote={(id, val) => handleVote("idea", id, val)}
                        onClick={() => handleCardClick(i as Idea, 'idea')}
                        onShowCanvas={() => handleShowCanvas(i as Idea, 'idea')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Architecture section (placeholder) */}
              {activeFilter === "Mimari" && (
                <EmptySection
                  icon={<Building2 size={36} className="text-gray-300" />}
                  title="Mimari Yapı"
                  desc="Mimari şemalar henüz eklenmemiş. Asistandan oluşturmasını isteyin."
                />
              )}

              {/* Empty results */}
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

              {/* Partial empty */}
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
    </div>
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
