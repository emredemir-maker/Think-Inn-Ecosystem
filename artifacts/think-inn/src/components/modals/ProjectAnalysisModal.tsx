import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Layers, CheckCircle2, Code2, GitBranch, Lightbulb,
  Tag, Users, ChevronRight, Monitor, Server, Database,
  Globe, Workflow, UserCircle2, Boxes, ArrowRight, ArrowLeft, Search,
} from 'lucide-react';
import { Idea } from '@workspace/api-client-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ReactFlow, Background, Controls, MiniMap,
  Node, Edge, MarkerType, Handle, Position,
  useNodesState, useEdgesState, BackgroundVariant,
  getBezierPath, EdgeLabelRenderer, BaseEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Node type configs (dark-glass) ──────────────────────────────────────────
const NODE_STYLES: Record<string, {
  gradient: string; accentColor: string; iconColor: string;
  icon: React.ReactNode; bgColor: string; borderColor: string;
  textColor: string; badgeBg: string; badgeText: string;
}> = {
  user:     { gradient: 'from-violet-500 to-purple-600',  accentColor: '#8b5cf6', iconColor: '#a78bfa', icon: <UserCircle2 size={14} />,  bgColor: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.3)',  textColor: '#c4b5fd', badgeBg: 'rgba(139,92,246,0.12)', badgeText: '#a78bfa' },
  frontend: { gradient: 'from-blue-500 to-indigo-600',    accentColor: '#6366f1', iconColor: '#818cf8', icon: <Monitor size={14} />,      bgColor: 'rgba(99,102,241,0.08)',  borderColor: 'rgba(99,102,241,0.3)',  textColor: '#a5b4fc', badgeBg: 'rgba(99,102,241,0.12)',  badgeText: '#818cf8' },
  backend:  { gradient: 'from-emerald-500 to-teal-600',   accentColor: '#10b981', iconColor: '#34d399', icon: <Server size={14} />,       bgColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', textColor: '#6ee7b7', badgeBg: 'rgba(16,185,129,0.12)', badgeText: '#34d399' },
  database: { gradient: 'from-amber-500 to-orange-600',   accentColor: '#f59e0b', iconColor: '#fbbf24', icon: <Database size={14} />,     bgColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', textColor: '#fcd34d', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#fbbf24' },
  external: { gradient: 'from-rose-500 to-pink-600',      accentColor: '#f43f5e', iconColor: '#fb7185', icon: <Globe size={14} />,        bgColor: 'rgba(244,63,94,0.08)',  borderColor: 'rgba(244,63,94,0.3)',  textColor: '#fda4af', badgeBg: 'rgba(244,63,94,0.12)',  badgeText: '#fb7185' },
  process:  { gradient: 'from-cyan-500 to-sky-600',       accentColor: '#06b6d4', iconColor: '#22d3ee', icon: <Workflow size={14} />,     bgColor: 'rgba(6,182,212,0.08)',  borderColor: 'rgba(6,182,212,0.3)', textColor: '#67e8f9', badgeBg: 'rgba(6,182,212,0.12)',  badgeText: '#22d3ee' },
  default:  { gradient: 'from-slate-400 to-slate-600',    accentColor: '#64748b', iconColor: '#94a3b8', icon: <Boxes size={14} />,        bgColor: 'rgba(100,116,139,0.08)', borderColor: 'rgba(100,116,139,0.25)', textColor: '#cbd5e1', badgeBg: 'rgba(100,116,139,0.1)', badgeText: '#94a3b8' },
};

const LAYER_LABELS: Record<string, string> = {
  user: 'Kullanıcı', frontend: 'Arayüz', backend: 'Uygulama',
  database: 'Veri', external: 'Harici', process: 'Süreç',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowNodeData = { id: string; label: string; type: string; description?: string; layer?: string };
type FlowEdgeData = { from: string; to: string; label?: string; animated?: boolean };
type FlowDiagramData = { nodes: FlowNodeData[]; edges: FlowEdgeData[] };
type ArchAnalysis = {
  functionalAnalysis: string;
  technicalAnalysis: string;
  architecturalPlan: string;
  generatedAt: string;
  flowDiagram?: FlowDiagramData;
};
type Section = 'overview' | 'functional' | 'technical' | 'architectural';

// ─── Custom Node (dark glass) ─────────────────────────────────────────────────
function ArchNode({ data, selected }: { data: FlowNodeData; selected?: boolean }) {
  const s = NODE_STYLES[data.type] ?? NODE_STYLES.default;
  return (
    <div
      className="relative min-w-[140px] max-w-[180px] rounded-xl overflow-hidden transition-all"
      style={{
        background: 'rgba(7,11,26,0.9)',
        backdropFilter: 'blur(12px)',
        border: `1.5px solid ${selected ? s.accentColor : s.borderColor}`,
        boxShadow: selected
          ? `0 0 0 2px ${s.accentColor}40, 0 8px 24px rgba(0,0,0,0.5)`
          : `0 4px 16px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Top accent line */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${s.gradient}`} />
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: s.bgColor, color: s.iconColor }}
          >
            {s.icon}
          </div>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: s.badgeBg, color: s.badgeText }}
          >
            {LAYER_LABELS[data.layer ?? data.type] ?? data.type}
          </span>
        </div>
        <p className="text-xs font-bold leading-tight mb-1" style={{ color: s.textColor }}>{data.label}</p>
        {data.description && (
          <p className="text-[10px] leading-snug line-clamp-2" style={{ color: 'rgba(148,163,184,0.7)' }}>{data.description}</p>
        )}
      </div>
      <Handle type="target" position={Position.Left}   style={{ width: 8, height: 8, background: s.accentColor, border: `2px solid rgba(7,11,26,0.9)` }} />
      <Handle type="source" position={Position.Right}  style={{ width: 8, height: 8, background: s.accentColor, border: `2px solid rgba(7,11,26,0.9)` }} />
      <Handle type="target" position={Position.Top}    style={{ width: 8, height: 8, background: s.accentColor, border: `2px solid rgba(7,11,26,0.9)` }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 8, height: 8, background: s.accentColor, border: `2px solid rgba(7,11,26,0.9)` }} />
    </div>
  );
}

// ─── Custom Edge ───────────────────────────────────────────────────────────────
function ArchEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: any) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: 'rgba(99,102,241,0.6)', strokeWidth: 1.5 }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', position: 'absolute', background: 'rgba(7,11,26,0.9)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', backdropFilter: 'blur(8px)' }}
            className="px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { arch: ArchNode };
const edgeTypes = { arch: ArchEdge };

// ─── Layout helper ────────────────────────────────────────────────────────────
const LAYER_ORDER = ['user', 'frontend', 'backend', 'database', 'external', 'process'];

function buildFlowGraph(rawNodes: FlowNodeData[], rawEdges: FlowEdgeData[]): { nodes: Node[]; edges: Edge[] } {
  const byLayer: Record<string, FlowNodeData[]> = {};
  rawNodes.forEach(n => {
    const layer = n.layer ?? n.type ?? 'process';
    if (!byLayer[layer]) byLayer[layer] = [];
    byLayer[layer].push(n);
  });

  const allLayers = [...new Set([...LAYER_ORDER, ...Object.keys(byLayer)])].filter(l => byLayer[l]);
  const COL_WIDTH = 220;
  const ROW_HEIGHT = 130;

  const nodes: Node[] = [];
  allLayers.forEach((layer, colIdx) => {
    const items = byLayer[layer] ?? [];
    items.forEach((item, rowIdx) => {
      nodes.push({
        id: item.id,
        type: 'arch',
        position: { x: colIdx * COL_WIDTH, y: rowIdx * ROW_HEIGHT + (colIdx % 2 === 1 ? 55 : 0) },
        data: { label: item.label, type: item.type, description: item.description, layer: item.layer ?? layer },
      });
    });
  });

  const edges: Edge[] = rawEdges.map((e, i) => ({
    id: `e-${i}`,
    source: e.from,
    target: e.to,
    type: 'arch',
    animated: e.animated ?? false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
    data: { label: e.label },
  }));

  return { nodes, edges };
}

// ─── Node Detail Panel (dark glass) ──────────────────────────────────────────
function NodeDetailPanel({
  node, allEdges, allNodes, onClose, onJumpToPlan,
}: {
  node: FlowNodeData;
  allEdges: FlowEdgeData[];
  allNodes: FlowNodeData[];
  onClose: () => void;
  onJumpToPlan: (term: string) => void;
}) {
  const s = NODE_STYLES[node.type] ?? NODE_STYLES.default;
  const incoming = allEdges.filter(e => e.to === node.id);
  const outgoing = allEdges.filter(e => e.from === node.id);
  const findNode = (id: string) => allNodes.find(n => n.id === id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 18, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 18, scale: 0.95 }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      className="absolute right-3 top-3 z-10 w-72 rounded-2xl overflow-hidden"
      style={{ background: 'rgba(7,11,26,0.97)', backdropFilter: 'blur(16px)', border: `1px solid ${s.borderColor}`, boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px ${s.accentColor}20` }}
      onClick={e => e.stopPropagation()}
    >
      <div className={`h-0.5 bg-gradient-to-r ${s.gradient}`} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: s.bgColor, color: s.iconColor, border: `1px solid ${s.borderColor}` }}
            >
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-snug" style={{ color: s.textColor }}>{node.label}</p>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                style={{ background: s.badgeBg, color: s.badgeText }}
              >
                {LAYER_LABELS[node.layer ?? node.type] ?? node.type}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Description */}
        {node.description && (
          <p
            className="text-[11px] leading-relaxed rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', color: 'rgb(148,163,184)' }}
          >
            {node.description}
          </p>
        )}

        {/* Connections */}
        {(incoming.length > 0 || outgoing.length > 0) && (
          <div className="space-y-2.5 pt-2" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
            {incoming.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'rgb(100,116,139)' }}>
                  <ArrowLeft size={9} /> Gelen bağlantılar
                </p>
                <div className="space-y-1">
                  {incoming.map((e, i) => {
                    const src = findNode(e.from);
                    const srcS = NODE_STYLES[src?.type ?? 'default'] ?? NODE_STYLES.default;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: 'rgb(148,163,184)' }}>
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${srcS.gradient} shrink-0`} />
                        <span className="font-medium truncate">{src?.label ?? e.from}</span>
                        {e.label && (
                          <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{e.label}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {outgoing.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: 'rgb(100,116,139)' }}>
                  <ArrowRight size={9} /> Giden bağlantılar
                </p>
                <div className="space-y-1">
                  {outgoing.map((e, i) => {
                    const tgt = findNode(e.to);
                    const tgtS = NODE_STYLES[tgt?.type ?? 'default'] ?? NODE_STYLES.default;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: 'rgb(148,163,184)' }}>
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${tgtS.gradient} shrink-0`} />
                        <span className="font-medium truncate">{tgt?.label ?? e.to}</span>
                        {e.label && (
                          <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{e.label}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Jump to plan */}
        <button
          onClick={() => { onClose(); onJumpToPlan(node.label); }}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-2 rounded-xl transition-all"
          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
        >
          <Search size={11} />
          Mimari Planda Görüntüle
        </button>
      </div>
    </motion.div>
  );
}

// ─── Architecture Flow ────────────────────────────────────────────────────────
function ArchitectureFlow({ flowDiagram, onJumpToPlan }: { flowDiagram: FlowDiagramData; onJumpToPlan: (term: string) => void }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildFlowGraph(flowDiagram.nodes, flowDiagram.edges),
    [flowDiagram]
  );
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedFlowNode, setSelectedFlowNode] = useState<FlowNodeData | null>(null);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const raw = flowDiagram.nodes.find(n => n.id === node.id);
    if (!raw) return;
    setSelectedFlowNode(prev => prev?.id === raw.id ? null : raw);
  }, [flowDiagram.nodes]);

  const handlePaneClick = useCallback(() => setSelectedFlowNode(null), []);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height: 460, border: '1px solid rgba(99,102,241,0.2)' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesFocusable
        style={{ background: '#060b18' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(99,102,241,0.2)" />
        <Controls
          style={{
            background: 'rgba(7,11,26,0.9)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12,
            backdropFilter: 'blur(8px)',
          }}
        />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor={n => {
            const t = (n.data as any)?.type as string;
            const map: Record<string, string> = { user: '#8b5cf6', frontend: '#6366f1', backend: '#10b981', database: '#f59e0b', external: '#f43f5e', process: '#06b6d4' };
            return map[t] ?? '#475569';
          }}
          maskColor="rgba(6,11,24,0.7)"
          style={{ background: 'rgba(7,11,26,0.9)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}
        />
      </ReactFlow>

      {/* Click hint */}
      {!selectedFlowNode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: 'rgba(7,11,26,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] font-medium text-indigo-400">Detay için bir bileşene tıklayın</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedFlowNode && (
          <NodeDetailPanel
            node={selectedFlowNode}
            allEdges={flowDiagram.edges}
            allNodes={flowDiagram.nodes}
            onClose={() => setSelectedFlowNode(null)}
            onJumpToPlan={onJumpToPlan}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DOM-based text highlighter ───────────────────────────────────────────────
function highlightAndScrollTo(container: HTMLElement, term: string) {
  container.querySelectorAll('mark.auto-hl').forEach(m => {
    const parent = m.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(m.textContent ?? ''), m);
      parent.normalize();
    }
  });
  if (!term.trim()) return;

  const termLower = term.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let firstMark: HTMLElement | null = null;
  let node: Text | null;
  const toProcess: { node: Text; idx: number }[] = [];

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? '';
    const idx = text.toLowerCase().indexOf(termLower);
    if (idx >= 0) toProcess.push({ node, idx });
  }

  toProcess.forEach(({ node, idx }) => {
    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + term.length);
      const mark = document.createElement('mark');
      mark.className = 'auto-hl rounded px-0.5 font-semibold';
      mark.style.cssText = 'background:rgba(99,102,241,0.3);color:#c7d2fe;';
      range.surroundContents(mark);
      if (!firstMark) firstMark = mark;
    } catch {
      // skip crossing element boundaries
    }
  });

  if (firstMark) (firstMark as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Markdown renderer (dark prose) ──────────────────────────────────────────
function RichContent({ content, highlight, contentRef }: {
  content: string;
  highlight?: string;
  contentRef?: React.RefObject<HTMLDivElement>;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = contentRef ?? innerRef;

  useEffect(() => {
    if (!highlight || !ref.current) return;
    const t = setTimeout(() => highlightAndScrollTo(ref.current!, highlight), 80);
    return () => clearTimeout(t);
  }, [highlight, ref]);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={`
      prose prose-sm max-w-none
      prose-headings:text-slate-100 prose-headings:font-bold prose-headings:tracking-tight
      prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2
      prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-indigo-300
      prose-h4:text-xs prose-h4:mt-3 prose-h4:mb-1 prose-h4:text-slate-500 prose-h4:uppercase prose-h4:tracking-wider
      prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2
      prose-strong:text-slate-100 prose-strong:font-semibold
      prose-ul:my-3 prose-li:my-1 prose-li:text-slate-300
      prose-ol:my-3 prose-ol:text-slate-300
      prose-code:text-cyan-300 prose-code:bg-cyan-900/25 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
      prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-pre:rounded-2xl prose-pre:p-5
      prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:rounded-r-xl prose-blockquote:text-slate-400 prose-blockquote:not-italic
      prose-table:text-xs prose-th:text-indigo-300 prose-td:text-slate-400
      prose-hr:border-slate-700
      prose-a:text-cyan-400
    `}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ─── Sections config (dark accents) ──────────────────────────────────────────
const SECTIONS: {
  id: Section; label: string; sublabel: string;
  icon: React.ReactNode; accent: string; accentDim: string;
}[] = [
  { id: 'overview',      label: 'Genel Bakış',       sublabel: 'Proje özeti',      icon: <Lightbulb size={14} />,    accent: '#fbbf24', accentDim: 'rgba(251,191,36,0.15)' },
  { id: 'functional',   label: 'Fonksiyonel Analiz', sublabel: 'Ne yapıyor?',      icon: <CheckCircle2 size={14} />, accent: '#34d399', accentDim: 'rgba(52,211,153,0.15)' },
  { id: 'technical',    label: 'Teknik Analiz',      sublabel: 'Nasıl yapılıyor?', icon: <Code2 size={14} />,        accent: '#22d3ee', accentDim: 'rgba(34,211,238,0.15)' },
  { id: 'architectural',label: 'Mimari Plan',         sublabel: 'Sistem şeması',    icon: <GitBranch size={14} />,    accent: '#a78bfa', accentDim: 'rgba(167,139,250,0.15)' },
];

// ─── Overview Section ─────────────────────────────────────────────────────────
function OverviewSection({ idea, analysis, onNavigate }: { idea: Idea; analysis: ArchAnalysis | null; onNavigate: (s: Section) => void }) {
  const stats = [
    { label: 'Araştırma',    value: (idea.researchIds || []).length, accent: '#34d399', dim: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)' },
    { label: 'Zorunlu Konu', value: ((idea as any).neededResearchTopics || []).length, accent: '#f87171', dim: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
    { label: 'Durum',        value: idea.status, accent: '#818cf8', dim: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(c => (
          <div
            key={c.label}
            className="flex flex-col gap-1.5 px-4 py-4 rounded-xl"
            style={{ background: c.dim, border: `1px solid ${c.border}` }}
          >
            <p className="text-2xl font-extrabold leading-none font-mono" style={{ color: c.accent }}>{c.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: c.accent, opacity: 0.6 }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
          <Lightbulb size={11} /> Fikir Açıklaması
        </p>
        <p className="text-sm text-slate-300 leading-relaxed">{idea.description}</p>
      </div>

      {/* Tags */}
      {(idea.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(idea.tags || []).map(tag => (
            <span
              key={tag}
              className="text-xs font-medium px-3 py-1.5 rounded-full font-mono"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.12)' }} />
        <span className="text-[9px] font-bold tracking-widest uppercase font-mono" style={{ color: 'rgba(99,102,241,0.4)' }}>Analiz Bölümleri</span>
        <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.12)' }} />
      </div>

      {/* Section nav cards */}
      <div className="space-y-2.5">
        {SECTIONS.slice(1).map(nc => (
          <button
            key={nc.id}
            onClick={() => onNavigate(nc.id)}
            className="w-full text-left flex items-start gap-4 p-4 rounded-xl transition-all group"
            style={{ background: nc.accentDim, border: `1px solid ${nc.accent}25` }}
          >
            <div
              className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${nc.accent}18`, color: nc.accent }}
            >
              {nc.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold mb-1" style={{ color: nc.accent }}>{nc.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {nc.id === 'functional'    && (analysis?.functionalAnalysis?.slice(0, 160) || 'Analiz bekleniyor...')}
                {nc.id === 'technical'     && (analysis?.technicalAnalysis?.slice(0, 160)  || 'Analiz bekleniyor...')}
                {nc.id === 'architectural' && (analysis?.architecturalPlan?.slice(0, 160)  || 'Analiz bekleniyor...')}
              </p>
            </div>
            <ChevronRight size={14} className="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" style={{ color: nc.accent, opacity: 0.5 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function ProjectAnalysisModal({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const analysis = (idea as any).architecturalAnalysis as ArchAnalysis | null;
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [archHighlight, setArchHighlight] = useState<string>('');
  const archContentRef = useRef<HTMLDivElement>(null);

  const handleJumpToPlan = useCallback((term: string) => {
    setArchHighlight('');
    setActiveSection('architectural');
    requestAnimationFrame(() => setArchHighlight(term));
  }, []);

  useEffect(() => {
    if (activeSection !== 'architectural') setArchHighlight('');
  }, [activeSection]);

  const generatedDate = analysis?.generatedAt
    ? format(new Date(analysis.generatedAt), 'dd MMM yyyy, HH:mm', { locale: tr })
    : null;

  const currentSection = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="relative w-full max-w-6xl flex flex-col overflow-hidden rounded-2xl z-10"
          style={{
            height: '92vh',
            background: 'rgba(7,11,26,0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 32px 96px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Top accent line */}
          <div className="h-0.5 w-full shrink-0" style={{ background: 'linear-gradient(90deg,#6366f1,#a78bfa,#22d3ee)' }} />

          {/* ── Header ───────────────────────────────────────────────── */}
          <div
            className="relative shrink-0 px-7 py-5 overflow-hidden"
            style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}
          >
            {/* Subtle glow orbs */}
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%)' }} />
            <div className="absolute -bottom-8 left-1/3 w-36 h-36 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(167,139,250,0.08),transparent 70%)' }} />

            <div className="relative flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] font-mono">Proje Kartı</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-[9px] text-slate-600 font-mono">#{idea.id}</span>
                  {generatedDate && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-[9px] text-slate-600 font-mono">Analiz: {generatedDate}</span>
                    </>
                  )}
                </div>
                <h1 className="text-xl font-extrabold text-slate-100 leading-tight line-clamp-1 tracking-tight mb-3">{idea.title}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    <Users size={11} className="text-indigo-400" />
                    <span className="text-xs text-slate-300 font-medium">{idea.authorName}</span>
                  </div>
                  {(idea.tags || []).slice(0, 4).map(tag => (
                    <div
                      key={tag}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}
                    >
                      <Tag size={9} className="text-violet-400" />
                      <span className="text-[11px] text-slate-300 font-medium">{tag}</span>
                    </div>
                  ))}
                  {idea.researchIds && idea.researchIds.length > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
                    >
                      <CheckCircle2 size={11} className="text-emerald-400" />
                      <span className="text-xs text-slate-300 font-medium">{idea.researchIds.length} araştırma</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                aria-label="Kapat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* Sidebar */}
            <div
              className="w-52 shrink-0 flex flex-col overflow-y-auto"
              style={{ borderRight: '1px solid rgba(99,102,241,0.1)', background: 'rgba(6,9,20,0.5)' }}
            >
              <nav className="p-3 space-y-0.5 flex-1">
                {SECTIONS.map(section => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                      style={{
                        background: isActive ? section.accentDim : 'transparent',
                        border: `1px solid ${isActive ? `${section.accent}30` : 'transparent'}`,
                        borderLeft: isActive ? `3px solid ${section.accent}` : '3px solid transparent',
                      }}
                    >
                      <div
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          background: isActive ? `${section.accent}18` : 'rgba(99,102,241,0.06)',
                          color: isActive ? section.accent : 'rgb(71,85,105)',
                        }}
                      >
                        {section.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[11px] font-semibold leading-tight truncate"
                          style={{ color: isActive ? section.accent : 'rgb(148,163,184)' }}
                        >
                          {section.label}
                        </p>
                        <p className="text-[9px] mt-0.5 truncate" style={{ color: 'rgb(71,85,105)' }}>{section.sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar footer */}
              <div className="p-4" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-2 font-mono" style={{ color: 'rgba(99,102,241,0.4)' }}>Açıklama</p>
                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-5">{idea.description}</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-7 pb-12">
                {/* Section header */}
                <div
                  className="flex items-center gap-3 mb-6 pb-4"
                  style={{ borderBottom: `1px solid ${currentSection.accent}25` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: currentSection.accentDim, color: currentSection.accent, border: `1px solid ${currentSection.accent}30` }}
                  >
                    {currentSection.icon}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-100">{currentSection.label}</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(71,85,105)' }}>{currentSection.sublabel}</p>
                  </div>

                  {/* Highlight badge */}
                  {activeSection === 'architectural' && archHighlight && (
                    <div
                      className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}
                    >
                      <Search size={10} className="text-indigo-400" />
                      <span className="text-[10px] font-semibold text-indigo-300">{archHighlight}</span>
                      <button
                        onClick={() => {
                          setArchHighlight('');
                          if (archContentRef.current) highlightAndScrollTo(archContentRef.current, '');
                        }}
                        className="ml-1 text-indigo-500 hover:text-indigo-300 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Section body */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeSection === 'overview' && (
                      <OverviewSection idea={idea} analysis={analysis} onNavigate={setActiveSection} />
                    )}

                    {activeSection === 'functional' && (
                      analysis?.functionalAnalysis
                        ? <RichContent content={analysis.functionalAnalysis} />
                        : <EmptyState />
                    )}

                    {activeSection === 'technical' && (
                      analysis?.technicalAnalysis
                        ? <RichContent content={analysis.technicalAnalysis} />
                        : <EmptyState />
                    )}

                    {activeSection === 'architectural' && (
                      analysis
                        ? (
                          <div className="space-y-8">
                            {analysis.flowDiagram?.nodes?.length ? (
                              <div>
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="h-px flex-1" style={{ background: 'rgba(167,139,250,0.2)' }} />
                                  <span className="text-[10px] font-bold tracking-widest uppercase px-3 flex items-center gap-1.5 font-mono" style={{ color: '#a78bfa' }}>
                                    <GitBranch size={10} /> İnteraktif Mimari Şema
                                  </span>
                                  <div className="h-px flex-1" style={{ background: 'rgba(167,139,250,0.2)' }} />
                                </div>
                                <ArchitectureFlow flowDiagram={analysis.flowDiagram} onJumpToPlan={handleJumpToPlan} />
                                {/* Legend */}
                                <div className="mt-3 flex flex-wrap gap-3 justify-center">
                                  {Object.entries(NODE_STYLES).filter(([k]) => k !== 'default').map(([key, s]) => (
                                    <div key={key} className="flex items-center gap-1.5">
                                      <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${s.gradient}`} />
                                      <span className="text-[10px] text-slate-600 font-medium">{LAYER_LABELS[key] ?? key}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {analysis.architecturalPlan && (
                              <div>
                                {analysis.flowDiagram?.nodes?.length ? (
                                  <div className="flex items-center gap-3 mb-5">
                                    <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.12)' }} />
                                    <span className="text-[9px] font-bold tracking-widest uppercase font-mono" style={{ color: 'rgba(99,102,241,0.4)' }}>Detaylı Açıklama</span>
                                    <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.12)' }} />
                                  </div>
                                ) : null}
                                <RichContent
                                  content={analysis.architecturalPlan}
                                  highlight={archHighlight}
                                  contentRef={archContentRef as React.RefObject<HTMLDivElement>}
                                />
                              </div>
                            )}
                          </div>
                        )
                        : <EmptyState />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <Layers size={24} className="text-indigo-600" />
      </div>
      <p className="text-sm text-slate-500">Analiz henüz oluşturulmadı.</p>
      <p className="text-xs text-slate-600 mt-1">Sohbet asistanından "analiz oluştur" komutunu kullanın.</p>
    </div>
  );
}
