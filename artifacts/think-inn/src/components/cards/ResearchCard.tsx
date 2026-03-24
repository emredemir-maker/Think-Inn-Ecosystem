import React from "react";
import { Research } from "@workspace/api-client-react";
import { ChevronUp, ChevronDown, User, Calendar, Network } from "lucide-react";
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
  const hasImage = !!research.coverImageB64;
  const imageSrc = hasImage
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : null;

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
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-base font-semibold text-[#1a1a2e] line-clamp-2">
            {research.title}
          </h3>
          <div
            className="flex flex-col items-center bg-gray-50 rounded-lg p-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onVote(research.id, 1); }}
              className="text-gray-400 hover:text-primary transition-colors p-1"
            >
              <ChevronUp size={15} />
            </button>
            <span className="text-sm font-semibold text-[#1a1a2e]">{research.voteCount}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onVote(research.id, -1); }}
              className="text-gray-400 hover:text-destructive transition-colors p-1"
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>

        <p className="text-xs text-[#6b7280] line-clamp-2">{research.summary}</p>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {research.tags?.map((tag) => (
            <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="pt-3 border-t border-border flex justify-between items-center text-xs text-[#6b7280]">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-primary" />
            <span className="font-medium text-[#1a1a2e]">{research.authorName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {format(new Date(research.createdAt), 'dd MMM yyyy', { locale: tr })}
            </span>
            {onShowCanvas && (
              <button
                onClick={(e) => { e.stopPropagation(); onShowCanvas(); }}
                className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
                title="Canvasta Göster"
              >
                <Network size={13} />
                <span>Harita</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
