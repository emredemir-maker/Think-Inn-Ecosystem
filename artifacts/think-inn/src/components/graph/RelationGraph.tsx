import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Loader2, CheckCircle, AlertTriangle, BookOpen, Tag } from 'lucide-react';

interface NodeData {
  id: number;
  type: 'research' | 'idea' | 'project';
  title: string;
  summary: string;
  voteCount: number;
  collaboratorCount: number;
  x: number; // CENTER x
  y: number; // CENTER y
  parentIdeaId?: number;
}

interface ResearchTopicMapping {
  researchId: number;
  topic: string;
  topicType: "needed" | "optional";
  autoLinked: boolean;
  confidence?: number;
}

type IdeaWithTopics = Idea & {
  neededResearchTopics?: string[];
  optionalResearchTopics?: string[];
  researchTopicMappings?: ResearchTopicMapping[];
};

interface Edge {
  sourceId: number;
  sourceType: string;
  targetId: number;
  targetType: string;
  manual?: boolean;
  topicMapping?: { topic: string; topicType: "needed" | "optional" };
  isProjectLink?: boolean;
}

interface ValidationState {
  fromId: number; fromType: string;
  toId: number; toType: string;
  status: 'loading' | 'valid' | 'invalid';
  confidence?: number;
  reason?: string;
}

// Port offset from node center
const PORT_OFFSET = 32;
const PORT_R = 5;

const nodeKey = (id: number, type: string) => `${type}-${id}`;
type PortSide = 'top' | 'bottom' | 'left' | 'right';

function getPort(node: NodeData, side: PortSide) {
  switch (side) {
    case 'top':    return { x: node.x,              y: node.y - PORT_OFFSET };
    case 'bottom': return { x: node.x,              y: node.y + PORT_OFFSET };
    case 'left':   return { x: node.x - PORT_OFFSET * 2.5, y: node.y };
    case 'right':  return { x: node.x + PORT_OFFSET * 2.5, y: node.y };
  }
}

function getBestPorts(src: NodeData, tgt: NodeData) {
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0
      ? { s: getPort(src, 'bottom'), t: getPort(tgt, 'top'),    v: true }
      : { s: getPort(src, 'top'),    t: getPort(tgt, 'bottom'), v: true };
  } else {
    return dx > 0
      ? { s: getPort(src, 'right'), t: getPort(tgt, 'left'),  v: false }
      : { s: getPort(src, 'left'),  t: getPort(tgt, 'right'), v: false };
  }
}

// Straight line (knowledge graph style)
function epPath(sx: number, sy: number, tx: number, ty: number, _v: boolean): string {
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

function livePath(sx: number, sy: number, tx: number, ty: number): string {
  return `M ${sx} ${sy} L ${tx} ${ty}`;
}

// Deterministic jitter based on id (for organic layout)
function jitter(id: number, range: number): number {
  return (((id * 2654435761) >>> 0) % 1000) / 1000 * range - range / 2;
}

// Node importance score
function calcImportance(node: NodeData, edges: Edge[]): number {
  const conn = edges.filter(e =>
    (e.sourceId === node.id && e.sourceType === node.type) ||
    (e.targetId === node.id && e.targetType === node.type)
  ).length;
  return conn * 2.5 + Math.log1p(node.voteCount) * 1.2 + Math.log1p(node.collaboratorCount);
}

const TYPE_COLOR: Record<string, string> = {
  research: '#22d3ee',
  idea:     '#f1f5f9',
  project:  '#c4b5fd',
};

const TYPE_GLOW: Record<string, string> = {
  research: '34,211,238',
  idea:     '226,232,240',
  project:  '196,181,253',
};

function getTextStyle(importance: number, type: string) {
  const col = TYPE_COLOR[type] ?? '#ffffff';
  const g   = TYPE_GLOW[type]  ?? '255,255,255';
  if (importance >= 8)  return { fontSize: 36, fontWeight: 700, color: type==='idea'?'#ffffff':col, textShadow: `0 0 28px rgba(${g},0.85), 0 0 70px rgba(${g},0.35)`, opacity: 1 };
  if (importance >= 6)  return { fontSize: 28, fontWeight: 700, color: type==='idea'?'#f8fafc':col, textShadow: `0 0 20px rgba(${g},0.7),  0 0 50px rgba(${g},0.25)`, opacity: 1 };
  if (importance >= 4)  return { fontSize: 21, fontWeight: 600, color: col, textShadow: `0 0 14px rgba(${g},0.55)`, opacity: 0.97 };
  if (importance >= 2)  return { fontSize: 16, fontWeight: 500, color: col, textShadow: `0 0 8px  rgba(${g},0.35)`, opacity: 0.88 };
  if (importance >= 1)  return { fontSize: 13, fontWeight: 400, color: col, textShadow: 'none',                      opacity: 0.72 };
  return                       { fontSize: 11, fontWeight: 300, color: col, textShadow: 'none',                      opacity: 0.48 };
}

interface RelationGraphProps {
  selectedId?: number;
  selectedType?: 'research' | 'idea';
  globalMode?: boolean;
  allResearch: Research[];
  allIdeas: IdeaWithTopics[];
  onBack: () => void;
  onNodeClick: (id: number, type: 'research' | 'idea') => void;
  onOpenProject?: (ideaId: number) => void;
  onRelationChange?: () => void;
}

export function RelationGraph({
  selectedId, selectedType, globalMode = false,
  allResearch, allIdeas, onBack, onNodeClick, onOpenProject, onRelationChange,
}: RelationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan]  = useState({ x: 0, y: 0 });

  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  const [deleteBtn, setDeleteBtn] = useState<{ x: number; y: number; edgeIdx: number } | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; type: 'ok'|'err'|'info' } | null>(null);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [topicPicker, setTopicPicker] = useState<{
    ideaId: number; researchId: number;
    neededTopics: string[]; optionalTopics: string[];
  } | null>(null);

  const drawing   = useRef<{ srcNode: NodeData; portSide: PortSide; toX: number; toY: number } | null>(null);
  const [drawTick, setDrawTick] = useState(0);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const panDrag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current  = pan;  }, [pan]);

  const canvasToScreen = useCallback((cx: number, cy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    return {
      x: (cx - cw/2) * zoomRef.current + cw/2 + panRef.current.x,
      y: (cy - ch/2) * zoomRef.current + ch/2 + panRef.current.y,
    };
  }, []);

  const toCanvas = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    return {
      x: (sx - rect.left - panRef.current.x - cw/2) / zoomRef.current + cw/2,
      y: (sy - rect.top  - panRef.current.y - ch/2) / zoomRef.current + ch/2,
    };
  }, []);

  // ── Build graph ─────────────────────────────────────────────────────
  const buildGraph = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 900;
    const ch = containerRef.current?.clientHeight ?? 600;

    if (globalMode) {
      const newNodes: NodeData[] = [], newEdges: Edge[] = [];
      const projectIdeas = allIdeas.filter(i => !!(i as any).architecturalAnalysis);
      const hasProjects  = projectIdeas.length > 0;
      const colGap = Math.max(cw * 0.36, 300);
      const leftX  = hasProjects ? cw/2 - colGap : cw/2 - colGap/2;
      const midX   = cw/2;
      const rightX = hasProjects ? cw/2 + colGap : cw/2 + colGap/2;
      const vR = Math.max(120, Math.min(180, (ch - 80) / Math.max(allResearch.length, 1)));
      const vI = Math.max(120, Math.min(180, (ch - 80) / Math.max(allIdeas.length, 1)));
      const vP = Math.max(120, Math.min(180, (ch - 80) / Math.max(projectIdeas.length, 1)));

      allResearch.forEach((r, i) => newNodes.push({
        id: r.id, type: 'research', title: r.title, summary: r.summary ?? '',
        voteCount: r.voteCount, collaboratorCount: 1,
        x: leftX + jitter(r.id * 3, 80),
        y: ch/2 - vR * (allResearch.length - 1) / 2 + i * vR,
      }));
      allIdeas.forEach((idea, i) => {
        newNodes.push({
          id: idea.id, type: 'idea', title: idea.title, summary: idea.description ?? '',
          voteCount: idea.voteCount, collaboratorCount: idea.collaborators?.length ?? 0,
          x: (hasProjects ? midX : rightX) + jitter(idea.id * 7, 80),
          y: ch/2 - vI * (allIdeas.length - 1) / 2 + i * vI,
        });
        (idea.researchIds ?? []).forEach(rid => {
          if (allResearch.find(r => r.id === rid)) {
            const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m => m.researchId === rid);
            newEdges.push({ sourceId: idea.id, sourceType: 'idea', targetId: rid, targetType: 'research',
              topicMapping: tm ? { topic: tm.topic, topicType: tm.topicType } : undefined });
          }
        });
      });
      projectIdeas.forEach((idea, i) => {
        newNodes.push({
          id: idea.id, type: 'project',
          title: (idea as any).architecturalAnalysis?.functionalAnalysis ? `${idea.title} — Proje` : idea.title,
          summary: 'Mimari analiz & akış şeması', voteCount: 0, collaboratorCount: 0,
          x: rightX + jitter(idea.id * 11, 80),
          y: ch/2 - vP * (projectIdeas.length - 1) / 2 + i * vP,
          parentIdeaId: idea.id,
        });
        newEdges.push({ sourceId: idea.id, sourceType: 'idea', targetId: idea.id, targetType: 'project', isProjectLink: true });
      });
      setNodes(newNodes); setEdges(newEdges); setPan({ x:0, y:0 }); setZoom(1);
    } else {
      if (selectedId === undefined || selectedType === undefined) return;
      const cx = cw/2, cy = ch/2;
      const center = selectedType === 'research'
        ? allResearch.find(r => r.id === selectedId)
        : allIdeas.find(i => i.id === selectedId);
      if (!center) return;
      const newNodes: NodeData[] = [{
        id: center.id, type: selectedType, title: center.title,
        summary: selectedType === 'research' ? (center as Research).summary ?? '' : (center as Idea).description ?? '',
        voteCount: center.voteCount,
        collaboratorCount: selectedType === 'idea' ? ((center as Idea).collaborators?.length ?? 0) : 1,
        x: cx, y: cy,
      }];
      const newEdges: Edge[] = [];
      let connected: { item: Research|Idea; type: 'research'|'idea' }[] = [];
      if (selectedType === 'research') {
        connected = allIdeas.filter(i => i.researchIds?.includes(selectedId)).map(i => ({ item: i, type: 'idea' as const }));
        connected.forEach(({ item }) => newEdges.push({ sourceId: selectedId, sourceType: 'research', targetId: item.id, targetType: 'idea' }));
      } else {
        const idea = center as Idea;
        connected = allResearch.filter(r => idea.researchIds?.includes(r.id)).map(r => ({ item: r, type: 'research' as const }));
        connected.forEach(({ item }) => {
          const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m => m.researchId === item.id);
          newEdges.push({ sourceId: selectedId, sourceType: 'idea', targetId: item.id, targetType: 'research',
            topicMapping: tm ? { topic: tm.topic, topicType: tm.topicType } : undefined });
        });
        if (!!(idea as any).architecturalAnalysis) {
          newNodes.push({
            id: idea.id, type: 'project', title: `${idea.title} — Proje`,
            summary: 'Mimari analiz & akış şeması', voteCount: 0, collaboratorCount: 0,
            x: cx + 340, y: cy, parentIdeaId: idea.id,
          });
          newEdges.push({ sourceId: idea.id, sourceType: 'idea', targetId: idea.id, targetType: 'project', isProjectLink: true });
        }
      }
      const n = connected.length, radius = Math.max(280, n * 100);
      connected.forEach(({ item, type }, i) => {
        const angle = n === 1 ? Math.PI/2 : -Math.PI/2 + (i / Math.max(n-1, 1)) * (n > 2 ? 2*Math.PI : Math.PI);
        newNodes.push({
          id: item.id, type, title: item.title,
          summary: type === 'research' ? (item as Research).summary ?? '' : (item as Idea).description ?? '',
          voteCount: item.voteCount,
          collaboratorCount: type === 'idea' ? ((item as Idea).collaborators?.length ?? 0) : 1,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      });
      setNodes(newNodes); setEdges(newEdges); setPan({ x:0, y:0 }); setZoom(1);
    }
  }, [selectedId, selectedType, globalMode, allResearch, allIdeas]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // Delete button position
  useEffect(() => {
    if (hoveredEdgeIdx === null || hoveredEdgeIdx >= edges.length) { setDeleteBtn(null); return; }
    const edge = edges[hoveredEdgeIdx];
    if (edge.isProjectLink) { setDeleteBtn(null); return; }
    const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
    const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
    if (!src || !tgt) { setDeleteBtn(null); return; }
    const mx = (src.x + tgt.x) / 2, my = (src.y + tgt.y) / 2;
    const { x, y } = canvasToScreen(mx, my);
    setDeleteBtn({ x, y, edgeIdx: hoveredEdgeIdx });
  }, [hoveredEdgeIdx, edges, nodes, zoom, pan, canvasToScreen]);

  // ── Canvas events ───────────────────────────────────────────────────
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('[data-node]') || t.closest('[data-port]') || t.closest('[data-edge]')) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    panDrag.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };
  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag.current) setPan({ x: panDrag.current.px + (e.clientX - panDrag.current.mx), y: panDrag.current.py + (e.clientY - panDrag.current.my) });
    if (drawing.current) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      drawing.current.toX = x; drawing.current.toY = y;
      setDrawTick(t => t+1);
    }
  };
  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panDrag.current = null;
    if (drawing.current && hoverTarget) {
      const parts = hoverTarget.split('-');
      const targetType = parts[0] as 'research'|'idea';
      const targetId   = parseInt(parts[1]);
      const { srcNode } = drawing.current;
      if ((srcNode.id !== targetId || srcNode.type !== targetType) &&
          !edges.some(ex => (ex.sourceId===srcNode.id&&ex.targetId===targetId)||(ex.sourceId===targetId&&ex.targetId===srcNode.id))) {
        startValidation(srcNode.id, srcNode.type, targetId, targetType);
      }
    }
    drawing.current = null; setHoverTarget(null); setDrawTick(t => t+1);
  };
  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.15, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))));
  };

  // ── Node drag ───────────────────────────────────────────────────────
  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: NodeData) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-port]') || t.closest('button')) return;
    e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = node.x, oy = node.y;
    const nk = nodeKey(node.id, node.type);
    const onMove = (ev: PointerEvent) => setNodes(prev => prev.map(n =>
      nodeKey(n.id, n.type) === nk ? { ...n, x: ox + (ev.clientX-sx)/zoomRef.current, y: oy + (ev.clientY-sy)/zoomRef.current } : n
    ));
    const onUp = () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); };
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp);
  };

  const onPortPointerDown = (e: React.PointerEvent<SVGElement>, node: NodeData, side: PortSide) => {
    e.stopPropagation();
    const port = getPort(node, side);
    drawing.current = { srcNode: node, portSide: side, toX: port.x, toY: port.y };
    setDrawTick(t => t+1);
  };

  // ── AI Validation ───────────────────────────────────────────────────
  const startValidation = async (fromId: number, fromType: string, toId: number, toType: string) => {
    let ideaId: number|null = null, researchId: number|null = null;
    if (fromType==='idea'&&toType==='research')      { ideaId=fromId; researchId=toId; }
    else if (fromType==='research'&&toType==='idea') { ideaId=toId;   researchId=fromId; }
    else { flash('Yalnızca Araştırma ↔ Fikir bağlantısı kurulabilir.', 'err'); return; }
    setValidation({ fromId, fromType, toId, toType, status: 'loading' });
    try {
      const resp = await fetch('/api/validate-connection', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ researchId, ideaId }) });
      const data = await resp.json() as { valid:boolean; confidence:number; reason:string };
      setValidation({ fromId, fromType, toId, toType, status: data.valid?'valid':'invalid', confidence: data.confidence, reason: data.reason });
      if (data.valid) setTimeout(() => { commitEdge(fromId,fromType,toId,toType); setValidation(null); }, 1200);
    } catch { setValidation(null); commitEdge(fromId,fromType,toId,toType); }
  };

  const commitEdge = async (fromId: number, fromType: string, toId: number, toType: string) => {
    const [ideaId, researchId] = fromType==='idea' ? [fromId,toId] : [toId,fromId];
    const idea = allIdeas.find(i => i.id === ideaId) as IdeaWithTopics|undefined;
    if (!idea) return;
    const newResearchIds = Array.from(new Set([...(idea.researchIds??[]),researchId]));
    const resp = await fetch(`/api/ideas/${ideaId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ researchIds: newResearchIds }) });
    if (resp.ok) {
      setEdges(prev => [...prev, { sourceId:fromId, sourceType:fromType, targetId:toId, targetType:toType, manual:true }]);
      flash('Bağlantı kaydedildi ✓', 'ok');
      onRelationChange?.();
      const neededTopics   = idea.neededResearchTopics   ?? [];
      const optionalTopics = idea.optionalResearchTopics ?? [];
      if (neededTopics.length > 0 || optionalTopics.length > 0)
        setTopicPicker({ ideaId, researchId, neededTopics, optionalTopics });
    } else flash('Kaydedilemedi', 'err');
  };

  const saveTopicMapping = async (topic: string, topicType: "needed"|"optional") => {
    if (!topicPicker) return;
    const { ideaId, researchId } = topicPicker;
    setTopicPicker(null);
    try {
      await fetch(`/api/ideas/${ideaId}/research-topic-mapping`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ researchId, topic, topicType }) });
      flash(`"${topic}" konusuna eşlendi ✓`, 'ok');
      onRelationChange?.();
    } catch { flash('Konu eşleştirilemedi', 'err'); }
  };

  const deleteEdge = async (edge: Edge) => {
    if (edge.isProjectLink) return;
    const [ideaId,researchId] = edge.sourceType==='idea' ? [edge.sourceId,edge.targetId] : [edge.targetId,edge.sourceId];
    const idea = allIdeas.find(i => i.id === ideaId); if (!idea) return;
    const newResearchIds = (idea.researchIds??[]).filter(id => id !== researchId);
    const resp = await fetch(`/api/ideas/${ideaId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ researchIds: newResearchIds }) });
    if (resp.ok) { setEdges(prev => prev.filter(ex => ex !== edge)); setHoveredEdgeIdx(null); setDeleteBtn(null); flash('Bağlantı silindi', 'ok'); onRelationChange?.(); }
    else flash('Silinemedi', 'err');
  };

  const flash = (text: string, type: 'ok'|'err'|'info') => { setFlashMsg({ text, type }); setTimeout(() => setFlashMsg(null), 3000); };
  const zoomIn  = () => setZoom(z => Math.min(3, +(z+0.2).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.15, +(z-0.2).toFixed(2)));
  const fitView = () => { setPan({ x:0, y:0 }); setZoom(1); };

  // Minimap
  const MM_W = 150, MM_H = 85;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = (xs.length ? Math.min(...xs) : 0) - 120;
  const minY = (ys.length ? Math.min(...ys) : 0) - 60;
  const maxX = (xs.length ? Math.max(...xs) : 100) + 120;
  const maxY = (ys.length ? Math.max(...ys) : 100) + 60;
  const mmSX = MM_W / (maxX - minX || 1);
  const mmSY = MM_H / (maxY - minY || 1);

  const dr = drawing.current;
  const PORT_SIDES: PortSide[] = ['top','bottom','left','right'];

  const cw0 = containerRef.current?.clientWidth ?? 900;
  const ch0 = containerRef.current?.clientHeight ?? 600;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ background: '#000000', cursor: panDrag.current ? 'grabbing' : 'default', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Very subtle ambient background ────────────────────────────── */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}>
        <defs>
          <radialGradient id="bg-ambient" cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="rgba(10,12,40,1)"/>
            <stop offset="60%"  stopColor="rgba(3,4,15,1)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,1)"/>
          </radialGradient>
          <filter id="dot-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="line-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-ambient)"/>
      </svg>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-slate-400 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
        >
          <ArrowLeft size={14}/> Listeye Dön
        </button>
        <span
          className="text-xs text-slate-500 px-2.5 py-1 rounded-full font-mono"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {globalMode ? 'Genel Harita · ' : ''}{nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {flashMsg && (
          <span
            className={`text-xs px-3 py-1 rounded-full border font-medium ${flashMsg.type==='ok'?'border-emerald-500/30 text-emerald-400':flashMsg.type==='err'?'border-red-500/30 text-red-400':'border-cyan-500/30 text-cyan-400'}`}
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          >
            {flashMsg.text}
          </span>
        )}
      </div>

      {/* Global legend */}
      {globalMode && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 rounded-full px-4 py-2 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
        >
          <span className="flex items-center gap-1.5 text-xs font-medium font-mono" style={{ color: '#22d3ee' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#22d3ee' }}/>Araştırma
          </span>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1.5 text-xs font-medium font-mono" style={{ color: '#f1f5f9' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#f1f5f9' }}/>Fikir
          </span>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1.5 text-xs font-medium font-mono" style={{ color: '#c4b5fd' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#c4b5fd' }}/>Proje
          </span>
        </div>
      )}

      {!!dr && !validation && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 text-xs text-cyan-400 px-3 py-1.5 rounded-full font-medium font-mono pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(34,211,238,0.3)' }}
        >
          Başka bir düğümün portuna sürükleyin
        </div>
      )}

      {/* ── Delete button (screen-space) ─────────────────────────────── */}
      {deleteBtn !== null && hoveredEdgeIdx !== null && edges[deleteBtn.edgeIdx] && (
        <button
          className="absolute z-40 w-7 h-7 rounded-full text-red-400 text-base font-bold hover:text-red-300 transition-colors flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(239,68,68,0.4)', left: deleteBtn.x - 14, top: deleteBtn.y - 14, pointerEvents: 'auto' }}
          onPointerEnter={() => setHoveredEdgeIdx(deleteBtn.edgeIdx)}
          onPointerLeave={() => { setHoveredEdgeIdx(null); setDeleteBtn(null); }}
          onClick={() => deleteEdge(edges[deleteBtn.edgeIdx])}
          title="Bağlantıyı Sil"
        >×</button>
      )}

      {/* ── Zoom controls ────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
        <button onClick={zoomIn}  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}><ZoomIn  size={14}/></button>
        <button onClick={zoomOut} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}><ZoomOut size={14}/></button>
        <button onClick={fitView} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}><Maximize2 size={13}/></button>
        <div className="text-center text-[10px] text-slate-600 font-mono mt-0.5">{Math.round(zoom*100)}%</div>
      </div>

      {/* ── AI Validation popup ────────────────────────────────────── */}
      {validation && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 rounded-2xl p-5 w-80"
          style={{ background:'rgba(5,7,15,0.97)', border:'1px solid rgba(34,211,238,0.2)', backdropFilter:'blur(24px)', boxShadow:'0 24px 60px rgba(0,0,0,0.9)' }}>
          {validation.status === 'loading' ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 size={28} className="text-cyan-400 animate-spin"/>
              <p className="text-sm font-semibold text-slate-200">AI Değerlendiriyor...</p>
              <p className="text-xs text-slate-500 text-center">Bağlantının anlamlı olup olmadığı kontrol ediliyor</p>
            </div>
          ) : validation.status === 'valid' ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle size={28} className="text-emerald-400"/>
              <p className="text-sm font-semibold text-slate-200">Bağlantı Uygun</p>
              <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
              <div className="w-full rounded-full h-1.5" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width:`${validation.confidence}%` }}/>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Güven: %{validation.confidence}</p>
              <p className="text-xs text-emerald-400 font-medium">Kaydediliyor...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <AlertTriangle size={28} className="text-amber-400"/>
              <p className="text-sm font-semibold text-slate-200">Bağlantı Önerilmiyor</p>
              <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
              <div className="w-full rounded-full h-1.5" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="bg-amber-400 h-1.5 rounded-full" style={{ width:`${validation.confidence}%` }}/>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Güven: %{validation.confidence}</p>
              <div className="flex gap-2 mt-1 w-full">
                <button onClick={() => setValidation(null)} className="flex-1 py-1.5 text-xs font-medium text-slate-400 rounded-lg hover:text-slate-300 transition-colors" style={{ border:'1px solid rgba(255,255,255,0.1)' }}>İptal</button>
                <button onClick={() => { const v=validation; setValidation(null); commitEdge(v.fromId,v.fromType,v.toId,v.toType); }} className="flex-1 py-1.5 text-xs font-medium text-amber-300 rounded-lg transition-colors" style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>Yine de Bağla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Topic Picker popup ─────────────────────────────────────── */}
      {topicPicker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 rounded-2xl p-5 w-96"
          style={{ background:'rgba(5,7,15,0.97)', border:'1px solid rgba(34,211,238,0.2)', backdropFilter:'blur(24px)', boxShadow:'0 24px 60px rgba(0,0,0,0.9)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-cyan-400"/>
            <p className="text-sm font-semibold text-slate-200">Araştırma Konusu Eşleştir</p>
            <button onClick={() => setTopicPicker(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors">×</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Bu araştırma hangi araştırma konusunu karşılıyor? (Opsiyonel)</p>
          {topicPicker.neededTopics.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 font-mono">Zorunlu Konular</p>
              <div className="flex flex-col gap-1">
                {topicPicker.neededTopics.map(topic => (
                  <button key={topic} onClick={() => saveTopicMapping(topic, 'needed')}
                    className="text-left text-xs px-3 py-2 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-2"
                    style={{ background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.15)' }}>
                    <Tag size={10} className="shrink-0"/>{topic}
                  </button>
                ))}
              </div>
            </div>
          )}
          {topicPicker.optionalTopics.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 font-mono">Opsiyonel Konular</p>
              <div className="flex flex-col gap-1">
                {topicPicker.optionalTopics.map(topic => (
                  <button key={topic} onClick={() => saveTopicMapping(topic, 'optional')}
                    className="text-left text-xs px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-2"
                    style={{ background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.15)' }}>
                    <Tag size={10} className="shrink-0"/>{topic}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setTopicPicker(null)} className="w-full py-2 text-xs text-slate-500 hover:text-slate-400 rounded-lg transition-colors mt-1" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
            Eşleştirme yapma
          </button>
        </div>
      )}

      {/* ── Transform layer ──────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'50% 50%', pointerEvents:'none' }}
      >
        {/* SVG: edges + live edge + ports */}
        <svg className="absolute inset-0 overflow-visible" style={{ width:'100%', height:'100%', pointerEvents:'none' }}>
          <defs>
            <filter id="edge-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="dot-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id===edge.sourceId && n.type===edge.sourceType);
            const tgt = nodes.find(n => n.id===edge.targetId && n.type===edge.targetType);
            if (!src || !tgt) return null;
            const { s, t, v } = getBestPorts(src, tgt);
            const path = epPath(s.x, s.y, t.x, t.y, v);
            const hov  = hoveredEdgeIdx === i;

            if (edge.isProjectLink) {
              const lineColor = hov ? 'rgba(196,181,253,0.7)' : 'rgba(196,181,253,0.35)';
              return (
                <g key={i} data-edge="true"
                  onPointerEnter={() => setHoveredEdgeIdx(i)}
                  onPointerLeave={() => setHoveredEdgeIdx(null)}
                  style={{ pointerEvents:'all' }}
                >
                  <path d={path} fill="none" stroke="transparent" strokeWidth={18} style={{ cursor:'pointer' }}/>
                  <path d={path} fill="none" stroke={lineColor} strokeWidth={hov?12:8} strokeLinecap="round" opacity={0.06} filter="url(#edge-glow)" style={{ pointerEvents:'none' }}/>
                  <path d={path} fill="none" stroke={lineColor} strokeWidth={hov?1.5:1} strokeLinecap="round" strokeDasharray="5 4" style={{ pointerEvents:'none' }}>
                    <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.5s" repeatCount="indefinite"/>
                  </path>
                  <circle r={2.5} fill="#c4b5fd" filter="url(#dot-glow)" style={{ pointerEvents:'none' }} opacity={0.85}>
                    <animateMotion dur="2.5s" repeatCount="indefinite" path={path}/>
                  </circle>
                </g>
              );
            }

            const isNeeded   = edge.topicMapping?.topicType === 'needed';
            const isOptional = edge.topicMapping?.topicType === 'optional';
            const lineColor  = edge.manual
              ? (hov ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)')
              : isNeeded
                ? (hov ? 'rgba(34,211,238,0.7)' : 'rgba(34,211,238,0.35)')
                : (hov ? 'rgba(148,163,184,0.55)' : 'rgba(148,163,184,0.22)');
            const dotColor = edge.manual ? '#e2e8f0' : isNeeded ? '#22d3ee' : '#94a3b8';
            const dur = edge.manual ? '2.2s' : isNeeded ? '1.8s' : '3s';

            return (
              <g key={i} data-edge="true"
                onPointerEnter={() => setHoveredEdgeIdx(i)}
                onPointerLeave={() => setHoveredEdgeIdx(null)}
                style={{ pointerEvents:'all' }}
              >
                <path d={path} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor:'pointer' }}/>
                {/* Glow */}
                <path d={path} fill="none" stroke={lineColor} strokeWidth={hov?10:6} strokeLinecap="round" opacity={0.07} filter="url(#edge-glow)" style={{ pointerEvents:'none' }}/>
                {/* Line */}
                <path d={path} fill="none" stroke={lineColor} strokeWidth={hov?1.5:0.8} strokeLinecap="round" style={{ pointerEvents:'none', transition:'stroke-width 0.15s' }}/>
                {/* Travelling dot */}
                <circle r={hov?3:2} fill={dotColor} filter="url(#dot-glow)" opacity={hov?0.9:0.6} style={{ pointerEvents:'none' }}>
                  <animateMotion dur={dur} repeatCount="indefinite" path={path}/>
                </circle>
              </g>
            );
          })}

          {/* Live drawing edge */}
          {dr && !validation && (() => {
            const path = livePath(getPort(dr.srcNode, dr.portSide).x, getPort(dr.srcNode, dr.portSide).y, dr.toX, dr.toY);
            return (
              <>
                <path d={path} fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth={1} strokeDasharray="6 4" strokeLinecap="round" style={{ pointerEvents:'none' }}>
                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.6s" repeatCount="indefinite"/>
                </path>
                <circle cx={dr.toX} cy={dr.toY} r={4} fill="rgba(34,211,238,0.5)" filter="url(#dot-glow)" style={{ pointerEvents:'none' }}/>
              </>
            );
          })()}

          {/* Port circles (visible on hover) */}
          {nodes.map(node => {
            const isHov = hoverTarget === nodeKey(node.id, node.type);
            if (!isHov) return null;
            const portCol = TYPE_COLOR[node.type] ?? '#ffffff';
            return PORT_SIDES.map(side => {
              const port = getPort(node, side);
              return (
                <circle
                  key={`${nodeKey(node.id,node.type)}-${side}`}
                  data-port="true"
                  cx={port.x} cy={port.y} r={PORT_R}
                  fill={portCol} opacity={0.6}
                  style={{ cursor:'crosshair', pointerEvents:'all' }}
                  onPointerDown={e => onPortPointerDown(e, node, side)}
                  filter="url(#dot-glow)"
                />
              );
            });
          })}
        </svg>

        {/* ── Text nodes ─────────────────────────────────────────────── */}
        {nodes.map(node => {
          const importance = calcImportance(node, edges);
          const style = getTextStyle(importance, node.type);
          const isHov = hoverTarget === nodeKey(node.id, node.type);
          const hovColor = node.type === 'research' ? '#67e8f9' : node.type === 'idea' ? '#ffffff' : '#ddd6fe';
          return (
            <div
              key={nodeKey(node.id, node.type)}
              data-node="true"
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                fontSize: `${style.fontSize}px`,
                fontWeight: style.fontWeight,
                color: isHov ? hovColor : style.color,
                opacity: style.opacity,
                textShadow: isHov
                  ? `0 0 30px ${hovColor}, 0 0 70px ${hovColor}88`
                  : style.textShadow,
                whiteSpace: 'nowrap',
                fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
                letterSpacing: importance >= 4 ? '0.01em' : '0.02em',
                userSelect: 'none',
                pointerEvents: 'all',
                zIndex: Math.round(importance * 10),
                lineHeight: 1,
                transition: 'color 0.15s, text-shadow 0.15s, opacity 0.15s',
              }}
              onPointerDown={e => onNodePointerDown(e, node)}
              onPointerEnter={() => setHoverTarget(nodeKey(node.id, node.type))}
              onPointerLeave={() => setHoverTarget(null)}
              onClick={e => {
                e.stopPropagation();
                if (node.type === 'project' && onOpenProject) onOpenProject(node.parentIdeaId!);
                else if (node.type !== 'project') onNodeClick(node.id, node.type as 'research'|'idea');
              }}
            >
              {node.title}
            </div>
          );
        })}
      </div>

      {/* ── Minimap ─────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-4 right-4 z-20 rounded-xl overflow-hidden"
        style={{ width: MM_W, height: MM_H, background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}
      >
        <svg width={MM_W} height={MM_H}>
          {/* Edges in minimap */}
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id===edge.sourceId && n.type===edge.sourceType);
            const tgt = nodes.find(n => n.id===edge.targetId && n.type===edge.targetType);
            if (!src || !tgt) return null;
            const col = edge.isProjectLink ? 'rgba(196,181,253,0.4)' : edge.manual ? 'rgba(255,255,255,0.25)' : 'rgba(34,211,238,0.25)';
            return (
              <line key={i}
                x1={(src.x - minX) * mmSX} y1={(src.y - minY) * mmSY}
                x2={(tgt.x - minX) * mmSX} y2={(tgt.y - minY) * mmSY}
                stroke={col} strokeWidth={0.5}
              />
            );
          })}
          {/* Nodes in minimap */}
          {nodes.map(node => (
            <circle key={nodeKey(node.id, node.type)}
              cx={(node.x - minX) * mmSX}
              cy={(node.y - minY) * mmSY}
              r={2.5}
              fill={TYPE_COLOR[node.type] ?? '#fff'}
              opacity={0.75}
            />
          ))}
          {/* Viewport rectangle */}
          {(() => {
            const vx = (-pan.x / zoom - cw0/2) / zoom + cw0/2;
            const vy = (-pan.y / zoom - ch0/2) / zoom + ch0/2;
            const vw = cw0 / zoom, vh = ch0 / zoom;
            return (
              <rect
                x={(vx - minX) * mmSX} y={(vy - minY) * mmSY}
                width={vw * mmSX} height={vh * mmSY}
                fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8}
              />
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
