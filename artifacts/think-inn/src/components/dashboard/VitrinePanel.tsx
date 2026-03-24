import React, { useState, useMemo } from "react";
import { useListResearch, useListIdeas, useVote, Research, Idea } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import {
  FileText, Lightbulb, Share2, Loader2, Search,
  Building2, BarChart3, Map, ExternalLink
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { RelationGraph } from "../graph/RelationGraph";

type ContentTab = "research" | "ideas" | "architecture" | "analyses";
type ViewMode = "list" | "graph" | "global-map";

export function VitrinePanel() {
  const [activeTab, setActiveTab] = useState<ContentTab>("research");
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleCardClick = (item: Research | Idea, type: 'research' | 'idea') => {
    setDetailItem({ item, type });
  };

  const handleShowCanvas = (item: Research | Idea, type: 'research' | 'idea') => {
    setCanvasItem({ id: item.id, type });
    setViewMode('graph');
  };

  const handleNodeClick = (id: number, type: 'research' | 'idea') => {
    const item = type === 'research' ? researchList?.find(r => r.id === id) : ideaList?.find(i => i.id === id);
    if (item) setDetailItem({ item, type });
  };

  const backToList = () => {
    setViewMode('list');
    setCanvasItem(null);
  };

  const openGlobalMap = () => setViewMode('global-map');

  const filteredResearch = useMemo(() => {
    if (!researchList) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return researchList;
    return researchList.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.summary?.toLowerCase().includes(q) ||
      r.authorName?.toLowerCase().includes(q) ||
      r.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [researchList, searchQuery]);

  const filteredIdeas = useMemo(() => {
    if (!ideaList) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return ideaList;
    return ideaList.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.authorName?.toLowerCase().includes(q) ||
      i.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [ideaList, searchQuery]);

  const isLoading = isResearchLoading || isIdeasLoading;
  const isMapMode = viewMode === 'graph' || viewMode === 'global-map';

  const TABS: { id: ContentTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'research',     label: 'Araştırma',    icon: <FileText size={14} />,   count: researchList?.length },
    { id: 'ideas',        label: 'Fikir',         icon: <Lightbulb size={14} />,  count: ideaList?.length },
    { id: 'architecture', label: 'Mimari Yapı',   icon: <Building2 size={14} /> },
    { id: 'analyses',     label: 'Analizler',     icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f8f9fa]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e] tracking-tight">İnovasyon Vitrini</h1>
            <p className="text-[#6b7280] mt-0.5 text-xs">Keşfedin, değerlendirin ve iş birliği yapın.</p>
          </div>

          <div className="flex items-center gap-2">
            {!isMapMode && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 w-40 placeholder:text-gray-400"
                />
              </div>
            )}
            <button
              onClick={openGlobalMap}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                viewMode === 'global-map'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
              }`}
            >
              <Map size={14} /> Genel Harita
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {!isMapMode && (
          <div className="flex items-center gap-0 border-b border-gray-200">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}

      {/* Graph modes (focused or global) */}
      {viewMode === 'graph' && canvasItem ? (
        <RelationGraph
          selectedId={canvasItem.id}
          selectedType={canvasItem.type}
          allResearch={researchList || []}
          allIdeas={ideaList || []}
          onBack={backToList}
          onNodeClick={handleNodeClick}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : viewMode === 'global-map' ? (
        <RelationGraph
          globalMode
          allResearch={researchList || []}
          allIdeas={ideaList || []}
          onBack={backToList}
          onNodeClick={handleNodeClick}
          onRelationChange={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
            queryClient.invalidateQueries({ queryKey: ['/api/research'] });
          }}
        />
      ) : (

        /* List mode */
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="w-full h-64 flex flex-col items-center justify-center text-indigo-600">
              <Loader2 className="animate-spin mb-3" size={28} />
              <span className="text-sm font-medium text-gray-500">Yükleniyor...</span>
            </div>
          ) : activeTab === 'research' ? (
            <ListContent
              items={filteredResearch}
              emptyMsg={searchQuery ? "Araştırma bulunamadı." : "Henüz araştırma eklenmemiş."}
              renderItem={r => (
                <ResearchCard
                  key={`res-${r.id}`}
                  research={r as Research}
                  onVote={(id, val) => handleVote("research", id, val)}
                  onClick={() => handleCardClick(r as Research, 'research')}
                  onShowCanvas={() => handleShowCanvas(r as Research, 'research')}
                />
              )}
            />
          ) : activeTab === 'ideas' ? (
            <ListContent
              items={filteredIdeas}
              emptyMsg={searchQuery ? "Fikir bulunamadı." : "Henüz fikir eklenmemiş."}
              renderItem={i => (
                <IdeaCard
                  key={`idea-${i.id}`}
                  idea={i as Idea}
                  onVote={(id, val) => handleVote("idea", id, val)}
                  onClick={() => handleCardClick(i as Idea, 'idea')}
                  onShowCanvas={() => handleShowCanvas(i as Idea, 'idea')}
                />
              )}
            />
          ) : activeTab === 'architecture' ? (
            <EmptyTab
              icon={<Building2 size={40} className="text-gray-300" />}
              title="Mimari Yapı"
              desc="Mimari şemalar henüz eklenmemiş. Asistandan oluşturmasını isteyin."
            />
          ) : (
            <EmptyTab
              icon={<BarChart3 size={40} className="text-gray-300" />}
              title="Analizler"
              desc="Analiz belgeleri henüz eklenmemiş. Asistandan oluşturmasını isteyin."
            />
          )}
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

function ListContent<T>({
  items,
  emptyMsg,
  renderItem,
}: {
  items: T[];
  emptyMsg: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      {items.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-gray-200 bg-white rounded-2xl">
          <p className="text-gray-400 font-medium text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function EmptyTab({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="py-16 px-8 text-center border border-dashed border-gray-200 bg-white rounded-2xl w-full max-w-md">
        <div className="flex justify-center mb-4">{icon}</div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{desc}</p>
      </div>
    </div>
  );
}
