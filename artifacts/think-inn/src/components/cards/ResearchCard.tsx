import React from "react";
import { Research } from "@workspace/api-client-react";
import { ChevronUp, ChevronDown, User, Calendar } from "lucide-react";
import { CyberBadge } from "../ui/CyberBadge";
import { motion } from "framer-motion";
import { format } from "date-fns";

export function ResearchCard({ research, onVote }: { research: Research, onVote: (id: number, val: 1 | -1) => void }) {
  
  const hasImage = !!research.coverImageB64;
  const imageSrc = hasImage 
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}` 
    : `${import.meta.env.BASE_URL}images/neural-grid.png`;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-border flex flex-col group overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="h-40 w-full relative overflow-hidden bg-gray-100">
        {hasImage ? (
          <img 
            src={imageSrc} 
            alt={research.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-blue-50" />
        )}
        <div className="absolute top-3 right-3 flex gap-2">
          <CyberBadge variant="purple">{research.status}</CyberBadge>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-lg font-semibold text-[#1a1a2e] line-clamp-2">
            {research.title}
          </h3>
          <div className="flex flex-col items-center bg-gray-50 rounded-lg p-1 shrink-0">
            <button onClick={() => onVote(research.id, 1)} className="text-gray-400 hover:text-primary transition-colors p-1">
              <ChevronUp size={16} />
            </button>
            <span className="text-sm font-semibold text-[#1a1a2e]">{research.voteCount}</span>
            <button onClick={() => onVote(research.id, -1)} className="text-gray-400 hover:text-destructive transition-colors p-1">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="text-sm text-[#6b7280]">
          <p className="line-clamp-2">{research.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          {research.tags?.map(tag => (
            <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <div className="pt-4 border-t border-border flex justify-between items-center text-xs text-[#6b7280]">
          <div className="flex items-center gap-1.5">
            <User size={14} className="text-primary" />
            <span className="font-medium text-[#1a1a2e]">{research.authorName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            {format(new Date(research.createdAt), 'MMM dd, yyyy')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
