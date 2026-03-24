import React, { useState } from "react";
import { useListResearch, useListIdeas, useVote, Research, Idea } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import { LayoutGrid, FileText, Lightbulb, Share2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CardDetailModal } from "../modals/CardDetailModal";
import { RelationGraph } from "../graph/RelationGraph";

type TabType = "all" | "research" | "ideas" | "diagrams";

export function VitrinePanel() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  
  const { data: researchList, isLoading: isResearchLoading } = useListResearch();
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas();
  
  const { mutate: submitVote } = useVote();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<{ id: number, type: 'research' | 'idea' } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [detailItem, setDetailItem] = useState<{ item: Research | Idea, type: 'research' | 'idea' } | null>(null);

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

  const handleCardClick = (item: Research | Idea, type: 'research' | 'idea') => {
    setSelectedItem({ id: item.id, type });
    setViewMode('graph');
    setDetailItem({ item, type });
  };

  const handleNodeClick = (id: number, type: 'research' | 'idea') => {
    const item = type === 'research' 
      ? researchList?.find(r => r.id === id)
      : ideaList?.find(i => i.id === id);
    
    if (item) {
      setSelectedItem({ id, type });
      setDetailItem({ item, type });
    }
  };

  const isLoading = isResearchLoading || isIdeasLoading;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-8 gap-8 relative bg-[#f8f9fa]">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 shrink-0 relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a2e] tracking-tight">
            İnovasyon Vitrini
          </h1>
          <p className="text-[#6b7280] mt-1.5 font-medium">
            Keşfedin, değerlendirin ve iş birliği yapın.
          </p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-full">
          <TabButton active={activeTab === "all"} onClick={() => { setActiveTab("all"); setViewMode('list'); }} icon={<LayoutGrid size={16} />}>Tümü</TabButton>
          <TabButton active={activeTab === "research"} onClick={() => { setActiveTab("research"); setViewMode('list'); }} icon={<FileText size={16} />}>Araştırmalar</TabButton>
          <TabButton active={activeTab === "ideas"} onClick={() => { setActiveTab("ideas"); setViewMode('list'); }} icon={<Lightbulb size={16} />}>Fikirler</TabButton>
          <TabButton active={activeTab === "diagrams"} onClick={() => { setActiveTab("diagrams"); setViewMode('list'); }} icon={<Share2 size={16} />}>Diyagramlar</TabButton>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === 'graph' && selectedItem ? (
        <RelationGraph 
          selectedId={selectedItem.id}
          selectedType={selectedItem.type}
          allResearch={researchList || []}
          allIdeas={ideaList || []}
          onBack={() => setViewMode('list')}
          onNodeClick={handleNodeClick}
        />
      ) : (
        <div className="flex-1 overflow-y-auto pb-8 z-10 relative">
          {isLoading ? (
            <div className="w-full h-64 flex flex-col items-center justify-center text-primary">
              <Loader2 className="animate-spin mb-4" size={32} />
              <span className="font-medium">İçerik yükleniyor...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
              {(activeTab === "all" || activeTab === "research") && researchList?.map(research => (
                <ResearchCard 
                  key={`res-${research.id}`} 
                  research={research} 
                  onVote={(id, val) => handleVote("research", id, val)} 
                  onClick={() => handleCardClick(research, 'research')}
                />
              ))}
              
              {(activeTab === "all" || activeTab === "ideas") && ideaList?.map(idea => (
                <IdeaCard 
                  key={`idea-${idea.id}`} 
                  idea={idea} 
                  onVote={(id, val) => handleVote("idea", id, val)} 
                  onClick={() => handleCardClick(idea, 'idea')}
                />
              ))}
              
              {activeTab === "diagrams" && (
                <div className="col-span-full py-16 text-center border border-dashed border-border bg-white rounded-2xl">
                  <Share2 size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-[#1a1a2e]">Diyagramlar</h3>
                  <p className="text-[#6b7280] mt-2">Diyagram bulunamadı. Asistandan oluşturmasını isteyin.</p>
                </div>
              )}

              {/* Empty State */}
              {(!researchList?.length && !ideaList?.length && activeTab === "all") && (
                <div className="col-span-full py-24 text-center border border-dashed border-border bg-white rounded-2xl">
                  <p className="text-[#1a1a2e] font-semibold text-lg">Veri bulunamadı</p>
                  <p className="text-[#6b7280] mt-2">Asistanla konuşun.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
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

function TabButton({ active, onClick, children, icon }: { active: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-full transition-all ${
        active 
          ? "bg-white text-primary shadow-sm" 
          : "text-[#6b7280] hover:text-[#1a1a2e] hover:bg-gray-200/50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}