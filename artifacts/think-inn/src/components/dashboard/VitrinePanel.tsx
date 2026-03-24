import React, { useState, useMemo } from "react";
import { useListResearch, useListIdeas, useVote, Research, Idea } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import { LayoutGrid, FileText, Lightbulb, Share2, Loader2, Search, BookOpen, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { RelationGraph } from "../graph/RelationGraph";

type TabType = "all" | "research" | "ideas" | "diagrams";

export function VitrinePanel() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: researchList, isLoading: isResearchLoading } = useListResearch();
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas();

  const { mutate: submitVote } = useVote();
  const queryClient = useQueryClient();

  const [canvasItem, setCanvasItem] = useState<{ id: number; type: 'research' | 'idea' } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [detailItem, setDetailItem] = useState<{ item: Research | Idea; type: 'research' | 'idea' } | null>(null);

  const handleVote = (targetType: "research" | "idea", targetId: number, value: 1 | -1) => {
    submitVote(
      { data: { targetType, targetId, voterName: "CurrentUser", value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/${targetType === 'research' ? 'research' : 'ideas'}`] });
        }
      }
    );
  };

  // Card body click → only open detail modal (stay in list view)
  const handleCardClick = (item: Research | Idea, type: 'research' | 'idea') => {
    setDetailItem({ item, type });
  };

  // "Harita" button → switch to canvas/graph view
  const handleShowCanvas = (item: Research | Idea, type: 'research' | 'idea') => {
    setCanvasItem({ id: item.id, type });
    setViewMode('graph');
  };

  // Clicking a node in graph → open its detail modal
  const handleNodeClick = (id: number, type: 'research' | 'idea') => {
    const item = type === 'research'
      ? researchList?.find(r => r.id === id)
      : ideaList?.find(i => i.id === id);
    if (item) setDetailItem({ item, type });
  };

  const isLoading = isResearchLoading || isIdeasLoading;

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

  const backToList = () => {
    setViewMode('list');
    setCanvasItem(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f8f9fa]">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e] tracking-tight">İnovasyon Vitrini</h1>
            <p className="text-[#6b7280] mt-0.5 text-sm">Keşfedin, değerlendirin ve iş birliği yapın.</p>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === 'list' && (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm bg-white border border-border rounded-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-48 placeholder:text-gray-400"
                />
              </div>
            )}

            <div className="flex bg-gray-100 p-1 rounded-full">
              <TabButton active={activeTab === "all"} onClick={() => { setActiveTab("all"); backToList(); }} icon={<LayoutGrid size={15} />}>Tümü</TabButton>
              <TabButton active={activeTab === "research"} onClick={() => { setActiveTab("research"); backToList(); }} icon={<FileText size={15} />}>Araştırmalar</TabButton>
              <TabButton active={activeTab === "ideas"} onClick={() => { setActiveTab("ideas"); backToList(); }} icon={<Lightbulb size={15} />}>Fikirler</TabButton>
              <TabButton active={activeTab === "diagrams"} onClick={() => { setActiveTab("diagrams"); backToList(); }} icon={<Share2 size={15} />}>Diyagramlar</TabButton>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
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
      ) : (
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="w-full h-64 flex flex-col items-center justify-center text-primary">
              <Loader2 className="animate-spin mb-4" size={32} />
              <span className="font-medium">İçerik yükleniyor...</span>
            </div>
          ) : activeTab === "diagrams" ? (
            <div className="p-8">
              <div className="py-16 text-center border border-dashed border-border bg-white rounded-2xl">
                <Share2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-[#1a1a2e]">Diyagramlar</h3>
                <p className="text-[#6b7280] mt-2">Diyagram bulunamadı. Asistandan oluşturmasını isteyin.</p>
              </div>
            </div>
          ) : activeTab === "all" ? (
            <div className="h-full flex gap-0 overflow-hidden">
              {/* Bilgi Bankası */}
              <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
                <div className="px-6 py-3 bg-white border-b border-border shrink-0 flex items-center gap-2">
                  <BookOpen size={14} className="text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Bilgi Bankası</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{filteredResearch.length} araştırma</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {filteredResearch.length === 0 ? (
                    <EmptyState message={searchQuery ? "Araştırma bulunamadı." : "Henüz araştırma eklenmemiş."} />
                  ) : filteredResearch.map(research => (
                    <ResearchCard
                      key={`res-${research.id}`}
                      research={research}
                      onVote={(id, val) => handleVote("research", id, val)}
                      onClick={() => handleCardClick(research, 'research')}
                      onShowCanvas={() => handleShowCanvas(research, 'research')}
                    />
                  ))}
                </div>
              </div>

              {/* Fikir Havuzu */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-3 bg-white border-b border-border shrink-0 flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Fikir Havuzu</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{filteredIdeas.length} fikir</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {filteredIdeas.length === 0 ? (
                    <EmptyState message={searchQuery ? "Fikir bulunamadı." : "Henüz fikir eklenmemiş."} />
                  ) : filteredIdeas.map(idea => (
                    <IdeaCard
                      key={`idea-${idea.id}`}
                      idea={idea}
                      onVote={(id, val) => handleVote("idea", id, val)}
                      onClick={() => handleCardClick(idea, 'idea')}
                      onShowCanvas={() => handleShowCanvas(idea, 'idea')}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                {activeTab === "research" && (
                  filteredResearch.length === 0
                    ? <div className="col-span-full"><EmptyState message={searchQuery ? "Araştırma bulunamadı." : "Henüz araştırma eklenmemiş."} /></div>
                    : filteredResearch.map(research => (
                      <ResearchCard
                        key={`res-${research.id}`}
                        research={research}
                        onVote={(id, val) => handleVote("research", id, val)}
                        onClick={() => handleCardClick(research, 'research')}
                        onShowCanvas={() => handleShowCanvas(research, 'research')}
                      />
                    ))
                )}
                {activeTab === "ideas" && (
                  filteredIdeas.length === 0
                    ? <div className="col-span-full"><EmptyState message={searchQuery ? "Fikir bulunamadı." : "Henüz fikir eklenmemiş."} /></div>
                    : filteredIdeas.map(idea => (
                      <IdeaCard
                        key={`idea-${idea.id}`}
                        idea={idea}
                        onVote={(id, val) => handleVote("idea", id, val)}
                        onClick={() => handleCardClick(idea, 'idea')}
                        onShowCanvas={() => handleShowCanvas(idea, 'idea')}
                      />
                    ))
                )}
              </div>
            </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center border border-dashed border-border bg-white rounded-2xl">
      <p className="text-[#6b7280] font-medium">{message}</p>
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-all ${active
        ? "bg-white text-primary shadow-sm"
        : "text-[#6b7280] hover:text-[#1a1a2e] hover:bg-gray-200/50"
        }`}
    >
      {icon}
      {children}
    </button>
  );
}
