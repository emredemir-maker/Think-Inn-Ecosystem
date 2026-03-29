import React, { useState } from "react";
import { Research } from "@workspace/api-client-react";
import { ThumbsUp, User, Calendar, Network, FileText, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function ResearchCard({
  research,
  onVote,
  onClick,
  onShowCanvas,
}: {
  research: Research;
  onVote: (id: number, val: 1 | -1) => void;
  onClick?: () => void;
  onShowCanvas?: () => void;
}) {
  const [voted, setVoted] = useState(false);
  // List endpoint now strips base64 for performance. Use dedicated cover endpoint.
  const hasImage = !!(research as any).hasCoverImage || !!research.coverImageB64;
  const imageSrc = research.coverImageB64
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : hasImage
      ? `/api/research/${research.id}/cover`
      : null;

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voted) { onVote(research.id, -1); setVoted(false); }
    else { onVote(research.id, 1); setVoted(true); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="group relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col hover:scale-[1.01]"
      style={{
        background: 'rgba(10,16,34,0.85)',
        borderColor: 'rgba(99,102,241,0.18)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Cover image / placeholder */}
      <div className="h-40 w-full relative overflow-hidden">
        {imageSrc ? (
          <>
            <img
              src={imageSrc}
              alt={research.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const placeholder = target.parentElement?.querySelector('[data-placeholder]') as HTMLElement;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
            <div
              data-placeholder=""
              className="hidden w-full h-full absolute inset-0 items-center justify-center bg-gradient-to-br from-[#0d1535] via-[#0f1840] to-[#130c30]"
            >
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-indigo-500/20" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-violet-500/15" />
              <FileText size={32} className="text-indigo-400/30" />
            </div>
          </>
        ) : (
          <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#0d1535] via-[#0f1840] to-[#130c30]">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <FileText size={64} className="text-indigo-400" />
            </div>
            {/* Decorative circles */}
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-indigo-500/20" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-violet-500/15" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-cyan-400/10" />
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-violet-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-lg">
            {research.status}
          </span>
        </div>

        {/* Hover arrow */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-1">
            <ArrowUpRight size={13} className="text-white" />
          </div>
        </div>

        {/* Date bottom overlay */}
        <div className="absolute bottom-2 right-3 text-[10px] text-white/80 font-medium flex items-center gap-1">
          <Calendar size={10} />
          {format(new Date(research.createdAt), 'dd MMM yyyy', { locale: tr })}
        </div>
      </div>

      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-violet-500/0 group-hover:from-indigo-500/[0.08] group-hover:to-violet-500/[0.06] transition-all duration-500 pointer-events-none rounded-2xl" />

      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="text-sm font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
          {research.title}
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{research.summary}</p>

        {research.tags && research.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {research.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-auto pt-3 flex justify-between items-center"
          style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <User size={11} className="text-violet-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">{research.authorName}</span>
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {onShowCanvas && (
              <button
                onClick={e => { e.stopPropagation(); onShowCanvas(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-2 py-1 rounded-lg transition-all"
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
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 border-transparent text-white'
                  : 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400 hover:border-indigo-400/40 hover:bg-indigo-500/20'
              }`}
            >
              <ThumbsUp size={11} className={voted ? 'fill-white' : ''} />
              <span>{Math.max(0, research.voteCount)}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
