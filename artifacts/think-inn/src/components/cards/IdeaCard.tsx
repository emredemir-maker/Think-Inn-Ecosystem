import React, { useState } from "react";
import { Idea } from "@workspace/api-client-react";
import { Users, ThumbsUp, CheckCircle2, AlertTriangle, Network, Lightbulb, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; gradient: string; dot: string; text: string }> = {
  active:    { label: "Aktif",    gradient: "from-emerald-500 to-teal-500",   dot: "bg-emerald-400", text: "text-emerald-700" },
  merged:    { label: "Birleşik", gradient: "from-violet-500 to-purple-600",  dot: "bg-violet-400",  text: "text-violet-700"  },
  prototype: { label: "Prototip", gradient: "from-amber-500 to-orange-500",   dot: "bg-amber-400",   text: "text-amber-700"  },
  draft:     { label: "Taslak",   gradient: "from-gray-400 to-slate-500",     dot: "bg-gray-400",    text: "text-gray-600"   },
  archived:  { label: "Arşiv",    gradient: "from-gray-300 to-gray-400",      dot: "bg-gray-300",    text: "text-gray-500"   },
};

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
  const [voted, setVoted] = useState(false);
  const status = STATUS_CONFIG[idea.status] ?? STATUS_CONFIG.draft;
  const hasResearch = idea.researchIds && idea.researchIds.length > 0;

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voted) { onVote(idea.id, -1); setVoted(false); }
    else { onVote(idea.id, 1); setVoted(true); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Top gradient accent line */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${status.gradient}`} />

      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/[0.02] group-hover:to-purple-500/[0.03] transition-all duration-500 pointer-events-none rounded-2xl" />

      <div className="p-5 flex flex-col gap-3.5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${status.gradient} shadow-sm`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{status.label}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">#{idea.id}</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight size={14} className="text-indigo-400" />
          </div>
        </div>

        {/* Icon + Title */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm">
            <Lightbulb size={14} className="text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
            {idea.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
          {idea.description}
        </p>

        {/* Tags */}
        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3.5 border-t border-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Users size={11} className="text-indigo-500" />
              </div>
              <span className="text-xs font-medium text-gray-600">{idea.authorName}</span>
            </div>
            {hasResearch ? (
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} className="fill-emerald-100" />
                <span>{idea.researchIds.length} araştırma</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-500 text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                <span>Araştırma yok</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {onShowCanvas && (
              <button
                onClick={e => { e.stopPropagation(); onShowCanvas(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all"
              >
                <Network size={11} />
                <span>Harita</span>
              </button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleVoteClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                voted
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 border-transparent text-white shadow-amber-200'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50'
              }`}
            >
              <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
              <span>{Math.max(0, idea.voteCount)}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
