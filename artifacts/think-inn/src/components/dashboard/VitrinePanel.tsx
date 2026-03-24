import React, { useState } from "react";
import { useListResearch, useListIdeas, useVote } from "@workspace/api-client-react";
import { ResearchCard } from "../cards/ResearchCard";
import { IdeaCard } from "../cards/IdeaCard";
import { CyberButton } from "../ui/CyberButton";
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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6 relative">
      {/* Vitrine Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-primary/20 pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent neon-text">
            İNOVASYON VİTRİNİ
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Ecosystem Data Stream / Live
          </p>
        </div>
        
        <div className="flex bg-card border border-primary/20 hud-clip p-1 gap-1">
          <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} icon={<LayoutGrid size={14} />}>TÜMÜ</TabButton>
          <TabButton active={activeTab === "research"} onClick={() => setActiveTab("research")} icon={<FileText size={14} />}>ARAŞTIRMALAR</TabButton>
          <TabButton active={activeTab === "ideas"} onClick={() => setActiveTab("ideas")} icon={<Lightbulb size={14} />}>FİKİRLER</TabButton>
          <TabButton active={activeTab === "diagrams"} onClick={() => setActiveTab("diagrams")} icon={<Share2 size={14} />}>DİYAGRAMLAR</TabButton>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {isLoading ? (
          <div className="w-full h-64 flex flex-col items-center justify-center text-primary">
            <Loader2 className="animate-spin mb-4" size={32} />
            <span className="font-display tracking-widest text-sm animate-pulse">FETCHING DATA...</span>
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
              <div className="col-span-full py-12 text-center border border-dashed border-primary/20 bg-primary/5 hud-clip">
                <Share2 size={48} className="mx-auto text-primary/30 mb-4" />
                <h3 className="text-lg font-display text-primary/70">DİYAGRAM MODÜLÜ</h3>
                <p className="text-sm text-muted-foreground">Aktif bir diyagram bulunamadı. Orkestratörden oluşturmasını isteyin.</p>
              </div>
            )}

            {/* Empty State */}
            {(!researchList?.length && !ideaList?.length && activeTab === "all") && (
              <div className="col-span-full py-20 text-center border border-dashed border-primary/30 bg-background/50 hud-clip">
                <p className="text-primary font-display tracking-widest text-lg">VERİ BULUNAMADI</p>
                <p className="text-muted-foreground text-sm mt-2">Sisteme yeni bir araştırma veya fikir eklemek için Orkestratör ile sohbete başlayın.</p>
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
      className={`flex items-center gap-2 px-4 py-2 text-xs font-display tracking-wider transition-all hud-clip ${
        active 
          ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_10px_rgba(0,255,255,0.2)]" 
          : "text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
