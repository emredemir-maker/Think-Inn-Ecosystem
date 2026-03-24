import React, { useState } from "react";
import { Research } from "@workspace/api-client-react";
import { ThumbsUp, User, Calendar, Network } from "lucide-react";
import { CyberBadge } from "../ui/CyberBadge";
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
    if (voted) {
      onVote(research.id, -1);
      setVoted(false);
    } else {
      onVote(research.id, 1);
      setVoted(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-border flex flex-col group overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="h-36 w-full relative overflow-hidden bg-gray-100">
        {imageSrc ? (
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-blue-50" />
        )}
        <div className="absolute top-3 right-3">
          <CyberBadge variant="purple">{research.status}</CyberBadge>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="text-base font-semibold text-[#1a1a2e] line-clamp-2">
          {research.title}
        </h3>

        <p className="text-xs text-[#6b7280] line-clamp-2">{research.summary}</p>

        <div className="flex flex-wrap gap-1.5">
          {research.tags?.map((tag) => (
            <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-3 border-t border-border flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
            <User size={13} className="text-primary" />
            <span className="font-medium text-[#1a1a2e]">{research.authorName}</span>
            <span className="text-gray-300">·</span>
            <Calendar size={11} />
            <span>{format(new Date(research.createdAt), 'dd MMM', { locale: tr })}</span>
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
            <button
              onClick={handleVoteClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
                voted
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <ThumbsUp size={12} className={voted ? 'fill-white' : ''} />
              <span>{Math.max(0, research.voteCount)}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
