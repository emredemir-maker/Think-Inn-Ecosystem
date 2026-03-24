import React from "react";
import { Research } from "@workspace/api-client-react";
import { ChevronUp, ChevronDown, FileText, User, Calendar, MessageSquare } from "lucide-react";
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="hud-panel hud-clip-reverse flex flex-col group overflow-hidden"
    >
      <div className="h-40 w-full relative overflow-hidden bg-background border-b border-primary/20">
        <img 
          src={imageSrc} 
          alt={research.title} 
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          style={!hasImage ? { filter: 'hue-rotate(90deg)' } : {}}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        <div className="absolute top-2 right-2 flex gap-2">
          <CyberBadge variant="purple">{research.status}</CyberBadge>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex justify-between items-start gap-4">
          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {research.title}
          </h3>
          <div className="flex flex-col items-center bg-background/80 border border-primary/20 rounded px-2 py-1 shrink-0">
            <button onClick={() => onVote(research.id, 1)} className="text-muted-foreground hover:text-primary transition-colors">
              <ChevronUp size={16} />
            </button>
            <span className="font-display text-sm font-bold text-primary">{research.voteCount}</span>
            <button onClick={() => onVote(research.id, -1)} className="text-muted-foreground hover:text-destructive transition-colors">
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong className="text-primary/70">[ ÖZET ]</strong>
            <p className="line-clamp-2 mt-1">{research.summary}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          {research.tags?.map(tag => (
            <span key={tag} className="text-[10px] text-accent font-mono bg-accent/5 px-1.5 py-0.5 border border-accent/20">
              {tag}
            </span>
          ))}
        </div>

        <div className="pt-3 border-t border-primary/10 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <User size={12} className="text-primary" />
            {research.authorName}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-primary" />
            {format(new Date(research.createdAt), 'dd.MM.yyyy')}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
