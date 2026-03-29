import React, { useState } from "react";
import { Idea } from "@workspace/api-client-react";
import { Users, ThumbsUp, CheckCircle2, AlertTriangle, Network, Lightbulb, ArrowUpRight, LayoutTemplate } from "lucide-react";
import { motion } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; gradient: string; dot: string; text: string }> = {
  active:    { label: "Aktif",    gradient: "from-emerald-500 to-teal-500",   dot: "bg-emerald-400", text: "text-emerald-400" },
  merged:    { label: "Birleşik", gradient: "from-violet-500 to-purple-600",  dot: "bg-violet-400",  text: "text-violet-400"  },
  prototype: { label: "Prototip", gradient: "from-amber-500 to-orange-500",   dot: "bg-amber-400",   text: "text-amber-400"   },
  draft:     { label: "Taslak",   gradient: "from-gray-400 to-slate-500",     dot: "bg-gray-400",    text: "text-slate-400"   },
  archived:  { label: "Arşiv",    gradient: "from-gray-300 to-gray-400",      dot: "bg-gray-300",    text: "text-slate-500"   },
};

export function IdeaCard({
  idea,
  onVote,
  onClick,
  onShowCanvas,
  onOpenProject,
}: {
  idea: Idea;
  onVote: (id: number, val: 1 | -1) => void;
  onClick?: () => void;
  onShowCanvas?: () => void;
  onOpenProject?: () => void;
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
      className="group relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
      style={{
        background: 'rgba(10,16,34,0.85)',
        borderColor: 'rgba(99,102,241,0.18)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Top gradient accent line */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${status.gradient}`} />

      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/[0.08] group-hover:to-purple-500/[0.06] transition-all duration-500 pointer-events-none rounded-2xl" />

      <div className="p-5 flex flex-col gap-3.5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${status.gradient} shadow-sm`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{status.label}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">#{idea.id}</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight size={14} className="text-indigo-400" />
          </div>
        </div>

        {/* Icon + Title */}
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <Lightbulb size={14} className="text-indigo-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">
            {idea.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
          {idea.description}
        </p>

        {/* Tags */}
        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-auto pt-3.5 flex justify-between items-center"
          style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Users size={11} className="text-indigo-500" />
              </div>
              <span className="text-xs font-medium text-slate-400">{idea.authorName}</span>
            </div>
            {hasResearch ? (
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} className="fill-emerald-400/20" />
                <span>{idea.researchIds.length} araştırma</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />
                <span>Araştırma yok</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {/* Project card button — only shown when analysis exists */}
            {onOpenProject && !!(idea as any).architecturalAnalysis && (
              <button
                onClick={e => { e.stopPropagation(); onOpenProject(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-2 py-1 rounded-lg transition-all border border-violet-500/20"
                title="Proje Kartını Görüntüle"
              >
                <LayoutTemplate size={11} />
                <span>Proje</span>
              </button>
            )}
            {onShowCanvas && (
              <button
                onClick={e => { e.stopPropagation(); onShowCanvas(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 py-1 rounded-lg transition-all"
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
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 border-transparent text-white'
                  : 'bg-amber-500/15 border-amber-500/20 text-amber-400 hover:border-amber-400/40 hover:bg-amber-500/20'
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
