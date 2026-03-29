import React from "react";
import { Idea } from "@workspace/api-client-react";
import { Users, GitBranch, CheckCircle2, Code2, Layers, ArrowUpRight, Calendar, Network } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

type ArchAnalysis = {
  functionalAnalysis: string;
  technicalAnalysis: string;
  architecturalPlan: string;
  generatedAt: string;
  flowDiagram?: { nodes: unknown[]; edges: unknown[] };
};

type AnalysisSection = {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  borderColor: string;
  labelColor: string;
  preview: string | undefined;
};

const STATUS_GRADIENT: Record<string, string> = {
  active:    "from-indigo-500 to-purple-600",
  merged:    "from-violet-500 to-purple-700",
  prototype: "from-amber-500 to-orange-600",
  draft:     "from-gray-600 to-slate-700",
  archived:  "from-gray-700 to-gray-800",
};

export function ProjectCard({
  idea,
  onClick,
}: {
  idea: Idea;
  onClick?: () => void;
}) {
  const analysis = (idea as Record<string, unknown>).architecturalAnalysis as ArchAnalysis | null;
  if (!analysis) return null;

  const gradient = STATUS_GRADIENT[idea.status] ?? STATUS_GRADIENT.draft;
  const generatedDate = analysis.generatedAt
    ? format(new Date(analysis.generatedAt), "dd MMM yyyy", { locale: tr })
    : null;
  const flowNodeCount = analysis.flowDiagram?.nodes?.length ?? 0;
  const flowEdgeCount = analysis.flowDiagram?.edges?.length ?? 0;

  const sections: AnalysisSection[] = [
    {
      icon: <CheckCircle2 size={11} />,
      label: "Fonksiyonel",
      bgColor: "rgba(52,211,153,0.1)",
      borderColor: "rgba(52,211,153,0.2)",
      labelColor: "text-emerald-400",
      preview: analysis.functionalAnalysis?.slice(0, 200),
    },
    {
      icon: <Code2 size={11} />,
      label: "Teknik",
      bgColor: "rgba(34,211,238,0.1)",
      borderColor: "rgba(34,211,238,0.2)",
      labelColor: "text-cyan-400",
      preview: analysis.technicalAnalysis?.slice(0, 200),
    },
    {
      icon: <GitBranch size={11} />,
      label: "Mimari Plan",
      bgColor: "rgba(167,139,250,0.1)",
      borderColor: "rgba(167,139,250,0.2)",
      labelColor: "text-violet-400",
      preview: analysis.architecturalPlan?.slice(0, 200),
    },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      onClick={onClick}
      className="group relative rounded-2xl cursor-pointer overflow-hidden flex flex-col"
      style={{
        background: "rgba(10,16,34,0.9)",
        border: "1px solid rgba(139,92,246,0.25)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Hover glow border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          border: "1px solid rgba(139,92,246,0.55)",
          boxShadow: "0 0 20px rgba(139,92,246,0.15)",
        }}
      />

      {/* Header section with gradient */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(139,92,246,0.25)",
        }}
      >
        {/* Violet accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, rgba(139,92,246,0.8), rgba(99,102,241,0.6), transparent)`,
          }}
        />

        {/* Status gradient bar */}
        <div className={`relative h-20 bg-gradient-to-br ${gradient} overflow-hidden`}>
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 50%, white 1px, transparent 1px), radial-gradient(circle at 75% 25%, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />

          {/* Badge + flow info row */}
          <div className="absolute bottom-2 left-4 right-4 flex items-end justify-between">
            {/* PROJE KARTI badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(139,92,246,0.25)",
                border: "1px solid rgba(139,92,246,0.4)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Layers size={11} className="text-violet-300" />
              <span className="text-[10px] font-bold text-violet-200 uppercase tracking-wider">
                Proje Kartı
              </span>
            </div>

            {flowNodeCount > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Network size={10} className="text-white/70" />
                <span className="text-[10px] text-white/80 font-medium">
                  {flowNodeCount} düğüm · {flowEdgeCount} bağlantı
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + open icon */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors flex-1">
            {idea.title}
          </h3>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
            <ArrowUpRight size={14} className="text-violet-400" />
          </div>
        </div>

        {/* Analysis section pills */}
        <div className="space-y-1.5">
          {sections.map((s) => (
            <div
              key={s.label}
              className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
              style={{
                background: s.bgColor,
                border: `1px solid ${s.borderColor}`,
              }}
            >
              <div className={`shrink-0 mt-0.5 ${s.labelColor}`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${s.labelColor}`}>
                  {s.label}
                </span>
                {s.preview && (
                  <p className="text-[10px] leading-relaxed text-slate-300 line-clamp-3">
                    {s.preview}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Flow diagram info row */}
        {flowNodeCount > 0 && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            <Network size={11} className="text-violet-400 shrink-0" />
            <span className="text-[10px] text-violet-400 font-semibold">
              İnteraktif Mimari Şema:
            </span>
            <span className="text-[10px] text-slate-400">
              {flowNodeCount} bileşen, {flowEdgeCount} bağlantı
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-auto pt-3 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
            >
              <Users size={10} className="text-violet-400" />
            </div>
            <span className="text-xs text-slate-400 font-medium">{idea.authorName}</span>
          </div>
          {generatedDate && (
            <div className="flex items-center gap-1 text-slate-400">
              <Calendar size={10} />
              <span className="text-[10px]">{generatedDate}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
