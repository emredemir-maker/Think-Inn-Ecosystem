import React, { useState } from "react";
import { useListResearch, useListIdeas, useVote } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import { LayoutGrid, FileText, Lightbulb, Share2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type TabType = "all" | "research" | "ideas" | "diagrams";

export function VitrinePanel() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  
  const { data: researchList, isLoading: isResearchLoading } = useListResearch();
  const { data: ideaList, isLoading: isIdeasLoading } = useListIdeas();
  
  const { mutate: submitVote } = useVote();
  const queryClient = useQueryClient();

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

  const isLoading = isResearchLoading || isIdeasLoading;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-8 gap-8 relative bg-[#f8f9fa]">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a2e] tracking-tight">
            Innovation Showcase
          </h1>
          <p className="text-[#6b7280] mt-1.5 font-medium">
            Discover, evaluate, and collaborate on corporate initiatives.
          </p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-full">
          <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} icon={<LayoutGrid size={16} />}>All</TabButton>
          <TabButton active={activeTab === "research"} onClick={() => setActiveTab("research")} icon={<FileText size={16} />}>Research</TabButton>
          <TabButton active={activeTab === "ideas"} onClick={() => setActiveTab("ideas")} icon={<Lightbulb size={16} />}>Ideas</TabButton>
          <TabButton active={activeTab === "diagrams"} onClick={() => setActiveTab("diagrams")} icon={<Share2 size={16} />}>Diagrams</TabButton>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-primary">
            <Loader2 className="animate-spin mb-4" size={32} />
            <span className="font-medium">Loading content...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {(activeTab === "all" || activeTab === "research") && researchList?.map(research => (
              <ResearchCard 
                key={`res-${research.id}`} 
                research={research} 
                onVote={(id, val) => handleVote("research", id, val)} 
              />
            ))}
            
            {(activeTab === "all" || activeTab === "ideas") && ideaList?.map(idea => (
              <IdeaCard 
                key={`idea-${idea.id}`} 
                idea={idea} 
                onVote={(id, val) => handleVote("idea", id, val)} 
              />
            ))}
            
            {activeTab === "diagrams" && (
              <div className="col-span-full py-16 text-center border border-dashed border-border bg-white rounded-2xl">
                <Share2 size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-[#1a1a2e]">Diagrams Module</h3>
                <p className="text-[#6b7280] mt-2">No active diagrams found. Ask the Assistant to generate one.</p>
              </div>
            )}

            {/* Empty State */}
            {(!researchList?.length && !ideaList?.length && activeTab === "all") && (
              <div className="col-span-full py-24 text-center border border-dashed border-border bg-white rounded-2xl">
                <p className="text-[#1a1a2e] font-semibold text-lg">No data available</p>
                <p className="text-[#6b7280] mt-2">Start a conversation with the Assistant to add new research or ideas.</p>
              </div>
            )}
          </div>
        )}
      </div>
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
