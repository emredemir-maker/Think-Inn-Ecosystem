import React from "react";
import { Idea } from "@workspace/api-client-react";
import { Users, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { CyberBadge } from "../ui/CyberBadge";
import { motion } from "framer-motion";

export function IdeaCard({ idea, onVote, onClick }: { idea: Idea, onVote: (id: number, val: 1 | -1) => void, onClick?: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "cyan";
      case "merged": return "purple";
      case "prototype": return "green";
      default: return "outline";
    }
  };

  const hasResearch = idea.researchIds && idea.researchIds.length > 0;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-border p-5 flex flex-col gap-4 group hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <CyberBadge variant={getStatusColor(idea.status)}>
              {idea.status}
            </CyberBadge>
            <span className="text-xs text-[#6b7280] font-medium">ID-{idea.id}</span>
          </div>
          <h3 className="text-lg font-semibold text-[#1a1a2e]">{idea.title}</h3>
        </div>
        <div className="flex flex-col items-center bg-gray-50 rounded-lg p-1 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => { e.stopPropagation(); onVote(idea.id, 1); }} className="text-gray-400 hover:text-primary transition-colors p-1">
            <ChevronUp size={16} />
          </button>
          <span className="text-sm font-semibold text-[#1a1a2e]">{idea.voteCount}</span>
          <button onClick={(e) => { e.stopPropagation(); onVote(idea.id, -1); }} className="text-gray-400 hover:text-destructive transition-colors p-1">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-[#6b7280] line-clamp-3">
        {idea.description}
      </p>

      <div className="flex flex-wrap gap-2">
        {idea.tags?.map(tag => (
          <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-2.5 py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs text-[#6b7280] block mb-1">Yazar</span>
          <div className="flex items-center gap-1.5 font-medium text-[#1a1a2e]">
            <Users size={14} className="text-primary" />
            {idea.authorName}
          </div>
        </div>
        <div>
          <span className="text-xs text-[#6b7280] block mb-1">Doğrulama</span>
          {hasResearch ? (
            <div className="flex items-center gap-1.5 text-green-600 font-medium">
              <CheckCircle2 size={14} />
              {idea.researchIds.length} Araştırma Bağlı
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertTriangle size={14} />
              Araştırma Gerekli
            </div>
          )}
        </div>
      </div>

      {idea.roadmap && idea.roadmap.length > 0 && !hasResearch && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm">
          <span className="text-amber-800 font-semibold mb-1.5 block">Yapılacaklar:</span>
          <ul className="list-disc pl-5 text-amber-700 space-y-1">
            {idea.roadmap.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}