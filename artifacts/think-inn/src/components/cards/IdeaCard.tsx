import React from "react";
import { Idea } from "@workspace/api-client-react";
import { Users, ThumbsUp, ThumbsDown, CheckCircle2, AlertTriangle, Network } from "lucide-react";
import { CyberBadge } from "../ui/CyberBadge";
import { motion } from "framer-motion";

export function IdeaCard({
  idea,
  onVote,
  onClick,
  onShowCanvas,
}: {
  idea: Idea;
  onVote: (id: number, val: 1 | -1) => void;
  onClick?: () => void;
  onShowCanvas?: () => void;
}) {
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
      className="bg-white rounded-xl shadow-sm border border-border p-4 flex flex-col gap-3 group hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex gap-2 items-center">
            <CyberBadge variant={getStatusColor(idea.status)}>{idea.status}</CyberBadge>
            <span className="text-xs text-[#6b7280] font-medium">ID-{idea.id}</span>
          </div>
          <h3 className="text-base font-semibold text-[#1a1a2e]">{idea.title}</h3>
        </div>
      </div>

      <p className="text-xs text-[#6b7280] line-clamp-3">{idea.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {idea.tags?.map((tag) => (
          <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-border flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-[#1a1a2e]">
            <Users size={13} className="text-primary" />
            <span className="text-xs">{idea.authorName}</span>
          </div>
          {hasResearch ? (
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
              <CheckCircle2 size={11} />
              {idea.researchIds.length}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-500 text-xs">
              <AlertTriangle size={11} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {onShowCanvas && (
            <button
              onClick={e => { e.stopPropagation(); onShowCanvas(); }}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
            >
              <Network size={12} />
              <span>Harita</span>
            </button>
          )}
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            <button
              onClick={e => { e.stopPropagation(); onVote(idea.id, 1); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm"
            >
              <ThumbsUp size={12} />
              <span>{idea.voteCount}</span>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onVote(idea.id, -1); }}
              className="p-1 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Beğenme"
            >
              <ThumbsDown size={12} />
            </button>
          </div>
        </div>
      </div>

      {idea.roadmap && idea.roadmap.length > 0 && !hasResearch && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs">
          <span className="text-amber-800 font-semibold mb-1 block">Yapılacaklar:</span>
          <ul className="list-disc pl-4 text-amber-700 space-y-0.5">
            {idea.roadmap.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
