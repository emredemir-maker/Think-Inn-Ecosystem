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
  const hasImage = !!research.coverImageB64;
  const imageSrc = hasImage
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
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
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-purple-100/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Cover image / placeholder */}
      <div className="h-40 w-full relative overflow-hidden">
        {imageSrc ? (
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <FileText size={64} className="text-indigo-600" />
            </div>
            {/* Decorative circles */}
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-indigo-200/40" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-purple-200/30" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/20" />
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

      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-violet-700 transition-colors">
          {research.title}
        </h3>

        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{research.summary}</p>

        {research.tags && research.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {research.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              <User size={11} className="text-violet-500" />
            </div>
            <span className="text-xs font-medium text-gray-600">{research.authorName}</span>
          </div>

          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {onShowCanvas && (
              <button
                onClick={e => { e.stopPropagation(); onShowCanvas(); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-500 hover:text-violet-700 hover:bg-violet-50 px-2 py-1 rounded-lg transition-all"
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
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 border-transparent text-white shadow-indigo-200'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50'
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
