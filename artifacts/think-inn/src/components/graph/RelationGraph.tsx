import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, ThumbsUp, Users, ZoomIn, ZoomOut, Maximize2, ExternalLink } from 'lucide-react';

interface NodeData {
  id: number;
  type: 'research' | 'idea';
  title: string;
  summary: string;
  voteCount: number;
  collaboratorCount: number;
  x: number;
  y: number;
}

interface Edge {
  sourceId: number;
  sourceType: string;
  targetId: number;
  targetType: string;
  manual?: boolean;
}

const NODE_W = 240;
const NODE_H = 160;
const PORT_R = 6;

const nodeKey = (id: number, type: string) => `${type}-${id}`;

type PortSide = 'top' | 'bottom' | 'left' | 'right';

function getPort(node: NodeData, side: PortSide) {
  switch (side) {
    case 'top':    return { x: node.x + NODE_W / 2, y: node.y };
    case 'bottom': return { x: node.x + NODE_W / 2, y: node.y + NODE_H };
    case 'left':   return { x: node.x,              y: node.y + NODE_H / 2 };
    case 'right':  return { x: node.x + NODE_W,     y: node.y + NODE_H / 2 };
  }
}

function getBestPorts(src: NodeData, tgt: NodeData) {
  const scx = src.x + NODE_W / 2, scy = src.y + NODE_H / 2;
  const tcx = tgt.x + NODE_W / 2, tcy = tgt.y + NODE_H / 2;
  const dx = tcx - scx, dy = tcy - scy;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0
      ? { s: getPort(src, 'bottom'), t: getPort(tgt, 'top'),    vertical: true }
      : { s: getPort(src, 'top'),    t: getPort(tgt, 'bottom'), vertical: true };
  } else {
    return dx > 0
      ? { s: getPort(src, 'right'), t: getPort(tgt, 'left'),  vertical: false }
      : { s: getPort(src, 'left'),  t: getPort(tgt, 'right'), vertical: false };
  }
}

function buildEdgePath(sx: number, sy: number, tx: number, ty: number, vertical: boolean): string {
  const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
  const off = Math.max(50, dist * 0.4);
  if (vertical) {
    const sgn = ty > sy ? 1 : -1;
    return `M ${sx} ${sy} C ${sx} ${sy + sgn * off} ${tx} ${ty - sgn * off} ${tx} ${ty}`;
  } else {
    const sgn = tx > sx ? 1 : -1;
    return `M ${sx} ${sy} C ${sx + sgn * off} ${sy} ${tx - sgn * off} ${ty} ${tx} ${ty}`;
  }
}

function buildLivePath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx, dy = ty - sy;
  const off = Math.max(50, Math.sqrt(dx * dx + dy * dy) * 0.4);
  if (Math.abs(dy) >= Math.abs(dx)) {
    const sgn = dy >= 0 ? 1 : -1;
    return `M ${sx} ${sy} C ${sx} ${sy + sgn * off} ${tx} ${ty - sgn * off} ${tx} ${ty}`;
  } else {
    const sgn = dx >= 0 ? 1 : -1;
    return `M ${sx} ${sy} C ${sx + sgn * off} ${sy} ${tx - sgn * off} ${ty} ${tx} ${ty}`;
  }
}

interface RelationGraphProps {
  // Node-focused mode
  selectedId?: number;
  selectedType?: 'research' | 'idea';
  // Global map mode (shows everything)
  globalMode?: boolean;
  allResearch: Research[];
  allIdeas: Idea[];
  onBack: () => void;
  onNodeClick: (id: number, type: 'research' | 'idea') => void;
  onRelationChange?: () => void;
}

export function RelationGraph({
  selectedId,
  selectedType,
  globalMode = false,
  allResearch,
  allIdeas,
  onBack,
  onNodeClick,
  onRelationChange,
}: RelationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const drawing = useRef<{ srcNode: NodeData; portSide: PortSide; toX: number; toY: number } | null>(null);
  const [drawTick, setDrawTick] = useState(0);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  const panDrag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Build graph ────────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 900;
    const ch = containerRef.current?.clientHeight ?? 600;

    if (globalMode) {
      // ── GLOBAL MAP: all nodes in bipartite layout ──
      const newNodes: NodeData[] = [];
      const newEdges: Edge[] = [];

      const researchCount = allResearch.length;
      const ideaCount = allIdeas.length;

      const colGap = Math.max(cw * 0.5, 400);
      const leftX  = cw / 2 - colGap / 2 - NODE_W / 2;
      const rightX = cw / 2 + colGap / 2 - NODE_W / 2;

      const vSpaceR = Math.max(180, Math.min(220, (ch - 120) / Math.max(researchCount, 1)));
      const vSpaceI = Math.max(180, Math.min(220, (ch - 120) / Math.max(ideaCount, 1)));

      const totalHR = vSpaceR * (researchCount - 1);
      const totalHI = vSpaceI * (ideaCount - 1);

      allResearch.forEach((r, i) => {
        newNodes.push({
          id: r.id, type: 'research',
          title: r.title,
          summary: r.summary ?? '',
          voteCount: r.voteCount,
          collaboratorCount: 1,
          x: leftX,
          y: ch / 2 - totalHR / 2 + i * vSpaceR,
        });
      });

      allIdeas.forEach((idea, i) => {
        newNodes.push({
          id: idea.id, type: 'idea',
          title: idea.title,
          summary: idea.description ?? '',
          voteCount: idea.voteCount,
          collaboratorCount: idea.collaborators?.length ?? 0,
          x: rightX,
          y: ch / 2 - totalHI / 2 + i * vSpaceI,
        });
        (idea.researchIds ?? []).forEach(rid => {
          if (allResearch.find(r => r.id === rid)) {
            newEdges.push({ sourceId: idea.id, sourceType: 'idea', targetId: rid, targetType: 'research' });
          }
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
      setPan({ x: 0, y: 0 });
      setZoom(1);
    } else {
      // ── FOCUSED MAP: single center node ──
      if (selectedId === undefined || selectedType === undefined) return;
      const cx = cw / 2 - NODE_W / 2;
      const cy = ch / 2 - NODE_H / 2;

      const center = selectedType === 'research'
        ? allResearch.find(r => r.id === selectedId)
        : allIdeas.find(i => i.id === selectedId);
      if (!center) return;

      const newNodes: NodeData[] = [{
        id: center.id, type: selectedType,
        title: center.title,
        summary: selectedType === 'research' ? (center as Research).summary ?? '' : (center as Idea).description ?? '',
        voteCount: center.voteCount,
        collaboratorCount: selectedType === 'idea' ? ((center as Idea).collaborators?.length ?? 0) : 1,
        x: cx, y: cy,
      }];
      const newEdges: Edge[] = [];

      let connected: { item: Research | Idea; type: 'research' | 'idea' }[] = [];
      if (selectedType === 'research') {
        connected = allIdeas.filter(i => i.researchIds?.includes(selectedId)).map(i => ({ item: i, type: 'idea' as const }));
        connected.forEach(({ item }) => newEdges.push({ sourceId: selectedId, sourceType: 'research', targetId: item.id, targetType: 'idea' }));
      } else {
        const idea = center as Idea;
        connected = allResearch.filter(r => idea.researchIds?.includes(r.id)).map(r => ({ item: r, type: 'research' as const }));
        connected.forEach(({ item }) => newEdges.push({ sourceId: selectedId, sourceType: 'idea', targetId: item.id, targetType: 'research' }));
      }

      const n = connected.length;
      const radius = Math.max(320, n * 90);
      connected.forEach(({ item, type }, i) => {
        const angle = n === 1 ? Math.PI / 2
          : -Math.PI / 2 + (i / Math.max(n - 1, 1)) * (n > 2 ? 2 * Math.PI : Math.PI);
        newNodes.push({
          id: item.id, type,
          title: item.title,
          summary: type === 'research' ? (item as Research).summary ?? '' : (item as Idea).description ?? '',
          voteCount: item.voteCount,
          collaboratorCount: type === 'idea' ? ((item as Idea).collaborators?.length ?? 0) : 1,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [selectedId, selectedType, globalMode, allResearch, allIdeas]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // ── Coordinate conversion ──────────────────────────────────────────

  const toCanvas = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    return {
      x: (sx - rect.left - panRef.current.x - cw / 2) / zoomRef.current + cw / 2,
      y: (sy - rect.top  - panRef.current.y - ch / 2) / zoomRef.current + ch / 2,
    };
  }, []);

  // ── Canvas events ──────────────────────────────────────────────────

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('[data-node]') || t.closest('[data-port]')) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    panDrag.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag.current) {
      setPan({ x: panDrag.current.px + (e.clientX - panDrag.current.mx), y: panDrag.current.py + (e.clientY - panDrag.current.my) });
    }
    if (drawing.current) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      drawing.current.toX = x;
      drawing.current.toY = y;
      setDrawTick(t => t + 1);
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panDrag.current = null;
    if (drawing.current && hoverTarget) {
      const parts = hoverTarget.split('-');
      const targetType = parts[0] as 'research' | 'idea';
      const targetId = parseInt(parts[1]);
      const { srcNode } = drawing.current;
      const notSelf = srcNode.id !== targetId || srcNode.type !== targetType;
      const notExists = !edges.some(ex =>
        (ex.sourceId === srcNode.id && ex.targetId === targetId) ||
        (ex.sourceId === targetId && ex.targetId === srcNode.id)
      );
      if (notSelf && notExists) saveEdge(srcNode.id, srcNode.type, targetId, targetType);
    }
    drawing.current = null;
    setHoverTarget(null);
    setDrawTick(t => t + 1);
  };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.2, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))));
  };

  // ── Node drag ──────────────────────────────────────────────────────

  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: NodeData) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-port]') || t.closest('[data-detail]') || t.closest('button')) return;
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    const ox = node.x, oy = node.y;
    const nk = nodeKey(node.id, node.type);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoomRef.current;
      const dy = (ev.clientY - sy) / zoomRef.current;
      setNodes(prev => prev.map(n => nodeKey(n.id, n.type) === nk ? { ...n, x: ox + dx, y: oy + dy } : n));
    };
    const onUp = () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  // ── Port drag ──────────────────────────────────────────────────────

  const onPortPointerDown = (e: React.PointerEvent<SVGElement>, node: NodeData, side: PortSide) => {
    e.stopPropagation();
    const port = getPort(node, side);
    drawing.current = { srcNode: node, portSide: side, toX: port.x, toY: port.y };
    setDrawTick(t => t + 1);
  };

  // ── Save / delete ──────────────────────────────────────────────────

  const saveEdge = async (fromId: number, fromType: string, toId: number, toType: string) => {
    let ideaId: number, researchId: number;
    if (fromType === 'idea' && toType === 'research') { ideaId = fromId; researchId = toId; }
    else if (fromType === 'research' && toType === 'idea') { ideaId = toId; researchId = fromId; }
    else return;
    try {
      const idea = allIdeas.find(i => i.id === ideaId);
      if (!idea) return;
      const newResearchIds = Array.from(new Set([...(idea.researchIds ?? []), researchId]));
      const resp = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchIds: newResearchIds }),
      });
      if (resp.ok) {
        setEdges(prev => [...prev, { sourceId: fromId, sourceType: fromType, targetId: toId, targetType: toType, manual: true }]);
        flash('Bağlantı kaydedildi ✓'); onRelationChange?.();
      } else flash('Kaydedilemedi');
    } catch { flash('Hata oluştu'); }
  };

  const deleteEdge = async (edge: Edge) => {
    let ideaId: number, researchId: number;
    if (edge.sourceType === 'idea') { ideaId = edge.sourceId; researchId = edge.targetId; }
    else { ideaId = edge.targetId; researchId = edge.sourceId; }
    try {
      const idea = allIdeas.find(i => i.id === ideaId);
      if (!idea) return;
      const newResearchIds = (idea.researchIds ?? []).filter(id => id !== researchId);
      const resp = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchIds: newResearchIds }),
      });
      if (resp.ok) {
        setEdges(prev => prev.filter(ex => ex !== edge));
        setHoveredEdge(null); flash('Bağlantı silindi'); onRelationChange?.();
      } else flash('Silinemedi');
    } catch { flash('Hata oluştu'); }
  };

  const flash = (msg: string) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(null), 2500); };

  const zoomIn  = () => setZoom(z => Math.min(2.5, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.2, +(z - 0.2).toFixed(2)));
  const fitView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // ── Minimap ────────────────────────────────────────────────────────

  const MM_W = 170, MM_H = 100;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = (xs.length ? Math.min(...xs) : 0) - 40;
  const minY = (ys.length ? Math.min(...ys) : 0) - 40;
  const maxX = (xs.length ? Math.max(...xs.map(x => x + NODE_W)) : 100) + 40;
  const maxY = (ys.length ? Math.max(...ys.map(y => y + NODE_H)) : 100) + 40;
  const mmSX = MM_W / (maxX - minX || 1);
  const mmSY = MM_H / (maxY - minY || 1);

  const dr = drawing.current;
  const isDrawing = !!dr;
  const PORT_SIDES: PortSide[] = ['top', 'bottom', 'left', 'right'];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
        backgroundPosition: `${pan.x % 28}px ${pan.y % 28}px`,
        backgroundColor: '#f8fafc',
        cursor: panDrag.current ? 'grabbing' : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Top bar ──────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md text-sm font-medium text-gray-700 transition-all"
        >
          <ArrowLeft size={14} /> Listeye Dön
        </button>
        <span className="text-xs text-gray-400 bg-white/90 px-2.5 py-1 rounded-full border border-gray-100">
          {globalMode ? 'Genel Harita · ' : ''}{nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {saveMsg && (
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${saveMsg.includes('✓') ? 'bg-green-50 border-green-200 text-green-700' : saveMsg.includes('silindi') ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Global map legend ────────────────────────── */}
      {globalMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm pointer-events-none">
          <span className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-400 inline-block" />
            Araştırma
          </span>
          <span className="text-gray-200">|</span>
          <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-400 inline-block" />
            Fikir
          </span>
          <span className="text-gray-200">|</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-4 border-t-2 border-dashed border-indigo-300 inline-block" />
            Bağlantı
          </span>
        </div>
      )}

      {/* Drawing hint */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium pointer-events-none">
          Başka bir düğümün portuna sürükleyin
        </div>
      )}

      {/* ── Zoom controls ────────────────────────────── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
        <button onClick={zoomIn}  className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomIn  size={14} /></button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomOut size={14} /></button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><Maximize2 size={13} /></button>
        <div className="text-center text-[11px] text-gray-400 font-medium mt-0.5">{Math.round(zoom * 100)}%</div>
      </div>

      {/* ── Transform layer ──────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%',
          pointerEvents: 'none',
        }}
      >
        {/* Global map column headers */}
        {globalMode && (() => {
          const cw = containerRef.current?.clientWidth ?? 900;
          const ch = containerRef.current?.clientHeight ?? 600;
          const colGap = Math.max(cw * 0.5, 400);
          const leftX  = cw / 2 - colGap / 2 - NODE_W / 2;
          const rightX = cw / 2 + colGap / 2 - NODE_W / 2;
          return (
            <>
              <div className="absolute" style={{ left: leftX, top: 20, width: NODE_W, pointerEvents: 'none' }}>
                <div className="text-center text-xs font-bold text-indigo-500 uppercase tracking-widest">📄 Araştırmalar</div>
              </div>
              <div className="absolute" style={{ left: rightX, top: 20, width: NODE_W, pointerEvents: 'none' }}>
                <div className="text-center text-xs font-bold text-amber-500 uppercase tracking-widest">💡 Fikirler</div>
              </div>
            </>
          );
        })()}

        {/* SVG: edges + live edge + ports */}
        <svg className="absolute inset-0 overflow-visible" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
            const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
            if (!src || !tgt) return null;
            const { s, t, vertical } = getBestPorts(src, tgt);
            const path = buildEdgePath(s.x, s.y, t.x, t.y, vertical);
            const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
            const hov = hoveredEdge === i;

            return (
              <g key={i}>
                <path d={path} fill="none" stroke="transparent" strokeWidth={18}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredEdge(i)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
                <path d={path} fill="none"
                  stroke={hov ? '#6366f1' : edge.manual ? '#818cf8' : '#c7d2fe'}
                  strokeWidth={hov ? 2.5 : 1.5}
                  strokeDasharray="7 4" strokeLinecap="round"
                  style={{ transition: 'stroke 0.12s', pointerEvents: 'none' }}
                />
                <circle cx={s.x} cy={s.y} r={3.5} fill={hov ? '#6366f1' : '#c7d2fe'} style={{ pointerEvents: 'none' }} />
                <circle cx={t.x} cy={t.y} r={3.5} fill={hov ? '#6366f1' : '#c7d2fe'} style={{ pointerEvents: 'none' }} />
                {hov && (
                  <g transform={`translate(${mx},${my})`}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredEdge(i)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onClick={() => deleteEdge(edge)}
                  >
                    <circle r={11} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={15} fill="#ef4444" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Live edge */}
          {dr && (() => {
            const fromPort = getPort(dr.srcNode, dr.portSide);
            return (
              <g>
                <path d={buildLivePath(fromPort.x, fromPort.y, dr.toX, dr.toY)}
                  fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" opacity={0.85} />
                <circle cx={fromPort.x} cy={fromPort.y} r={4} fill="#6366f1" />
                <circle cx={dr.toX} cy={dr.toY} r={3.5} fill="#6366f1" opacity={0.5} />
              </g>
            );
          })()}

          {/* Ports */}
          {nodes.map(node => {
            const nk = nodeKey(node.id, node.type);
            const isTarget = hoverTarget === nk && isDrawing;
            return PORT_SIDES.map(side => {
              const { x, y } = getPort(node, side);
              return (
                <circle key={`port-${nk}-${side}`}
                  cx={x} cy={y} r={PORT_R}
                  fill="white"
                  stroke={isTarget ? '#6366f1' : '#a5b4fc'}
                  strokeWidth={isTarget ? 2.5 : 1.5}
                  style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                  data-port="true"
                  onPointerDown={e => onPortPointerDown(e as unknown as React.PointerEvent<SVGElement>, node, side)}
                  onPointerEnter={() => isDrawing && setHoverTarget(nk)}
                  onPointerLeave={() => setHoverTarget(null)}
                />
              );
            });
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node => {
          const nk = nodeKey(node.id, node.type);
          const isCenter = !globalMode && node.id === selectedId && node.type === selectedType;
          const isIdea = node.type === 'idea';
          const isHoverTarget = hoverTarget === nk && isDrawing;

          return (
            <div key={nk}
              data-node="true"
              onPointerDown={e => onNodePointerDown(e, node)}
              onPointerEnter={() => isDrawing && setHoverTarget(nk)}
              onPointerLeave={() => setHoverTarget(null)}
              className={`absolute rounded-2xl border bg-white transition-shadow ${
                isCenter ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-lg'
                : isHoverTarget ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-xl'
                : 'border-gray-200 shadow-md hover:shadow-lg'
              }`}
              style={{ left: node.x, top: node.y, width: NODE_W, pointerEvents: 'auto', cursor: 'grab', touchAction: 'none' }}
            >
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-t-2xl border-b ${isIdea ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <span className={`text-[10px] font-bold tracking-widest uppercase ${isIdea ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {isIdea ? '💡 Fikir' : '📄 Araştırma'}
                </span>
                {isCenter && <span className="ml-1 text-[9px] text-gray-400 font-medium">Seçili</span>}
                <button data-detail="true"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onNodeClick(node.id, node.type); }}
                  className="ml-auto p-0.5 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
                  style={{ pointerEvents: 'auto' }}
                  title="Detayı Göster"
                >
                  <ExternalLink size={11} />
                </button>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <h4 className="font-semibold text-gray-900 text-[13px] mb-1.5 line-clamp-2 leading-snug">{node.title}</h4>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{node.summary}</p>
                <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={10} className={isIdea ? 'text-amber-500' : 'text-indigo-400'} />
                    {node.voteCount}
                  </span>
                  <span className="flex items-center gap-1"><Users size={10} />{node.collaboratorCount}</span>
                  <span className="ml-auto text-[10px] text-gray-300 font-mono">{isIdea ? `#${node.id}` : `R${node.id}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Minimap ───────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 z-30 bg-white/95 border border-gray-200 rounded-xl shadow-sm overflow-hidden pointer-events-none"
          style={{ width: MM_W, height: MM_H }}>
          <svg width={MM_W} height={MM_H}>
            {edges.map((edge, i) => {
              const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
              const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
              if (!src || !tgt) return null;
              const { s, t } = getBestPorts(src, tgt);
              return <line key={i} x1={(s.x - minX) * mmSX} y1={(s.y - minY) * mmSY} x2={(t.x - minX) * mmSX} y2={(t.y - minY) * mmSY}
                stroke={edge.manual ? '#818cf8' : '#c7d2fe'} strokeWidth={1} strokeDasharray="3 2" />;
            })}
            {nodes.map(node => {
              const nk = nodeKey(node.id, node.type);
              const isCenter = !globalMode && node.id === selectedId && node.type === selectedType;
              const isIdea = node.type === 'idea';
              return <rect key={`mm-${nk}`}
                x={(node.x - minX) * mmSX} y={(node.y - minY) * mmSY}
                width={NODE_W * mmSX} height={NODE_H * mmSY} rx={2}
                fill={isCenter ? '#eef2ff' : isIdea ? '#fffbeb' : '#f5f3ff'}
                stroke={isCenter ? '#6366f1' : isIdea ? '#f59e0b' : '#818cf8'}
                strokeWidth={isCenter ? 1.5 : 1} />;
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-gray-300 font-medium">Mini Harita</div>
        </div>
      )}
    </div>
  );
}
