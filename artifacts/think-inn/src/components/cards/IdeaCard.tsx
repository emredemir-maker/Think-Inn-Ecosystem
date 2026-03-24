import React from "react";
import { Idea } from "@workspace/api-client-react";
import { Network, Users, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { CyberBadge } from "../ui/CyberBadge";
import { CyberButton } from "../ui/CyberButton";
import { motion } from "framer-motion";

export function IdeaCard({ idea, onVote }: { idea: Idea, onVote: (id: number, val: 1 | -1) => void }) {
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="hud-panel hud-clip p-5 flex flex-col gap-4 group hover:border-primary/50 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <CyberBadge variant={getStatusColor(idea.status)}>
              {idea.status}
            </CyberBadge>
            <span className="text-xs text-muted-foreground font-mono">ID_{idea.id.toString().padStart(4, '0')}</span>
          </div>
          <h3 className="text-lg font-bold text-foreground group-hover:neon-text transition-all">{idea.title}</h3>
        </div>
        <div className="flex flex-col items-center bg-background/50 border border-primary/20 rounded px-2 py-1">
          <button onClick={() => onVote(idea.id, 1)} className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronUp size={16} />
          </button>
          <span className="font-display text-sm font-bold text-primary">{idea.voteCount}</span>
          <button onClick={() => onVote(idea.id, -1)} className="text-muted-foreground hover:text-destructive transition-colors">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3">
        {idea.description}
      </p>

      <div className="flex flex-wrap gap-2">
        {idea.tags?.map(tag => (
          <span key={tag} className="text-xs text-primary/70 bg-primary/5 px-1.5 py-0.5 border border-primary/10 rounded-sm">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-primary/10 grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground block mb-1">AUTHOR</span>
          <div className="flex items-center gap-1.5 text-foreground">
            <Users size={12} className="text-primary" />
            {idea.authorName}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground block mb-1">VALIDATION</span>
          {hasResearch ? (
            <div className="flex items-center gap-1.5 text-green-400">
              <CheckCircle2 size={12} />
              {idea.researchIds.length} Research Linked
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle size={12} />
              Requires Research
            </div>
          )}
        </div>
      </div>

      {idea.roadmap && idea.roadmap.length > 0 && !hasResearch && (
        <div className="mt-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-xs">
          <span className="text-destructive font-bold mb-1 block">ACTION REQUIRED:</span>
          <ul className="list-disc pl-4 text-muted-foreground space-y-1">
            {idea.roadmap.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
