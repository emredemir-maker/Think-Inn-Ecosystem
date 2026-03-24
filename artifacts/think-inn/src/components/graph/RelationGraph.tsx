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
const PORT_SIZE = 12;

const getNodeKey = (id: number, type: string) => `${type}-${id}`;

// Bezier edge path: bottom of source → top of target
function edgePath(src: NodeData, tgt: NodeData) {
  const x1 = src.x + NODE_W / 2;
  const y1 = src.y + NODE_H;
  const x2 = tgt.x + NODE_W / 2;
  const y2 = tgt.y;
  const dy = Math.abs(y2 - y1) * 0.5 + 60;
  return `M ${x1} ${y1} C ${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
}

// Live drawing edge: from a port position to mouse (canvas space)
function livePath(x1: number, y1: number, x2: number, y2: number) {
  const dy = (Math.abs(y2 - y1) * 0.4) + 50;
  return `M ${x1} ${y1} C ${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
}

export function RelationGraph({
  selectedId,
  selectedType,
  allResearch,
  allIdeas,
  onBack,
  onNodeClick,
  onRelationChange,
}: {
  selectedId: number;
  selectedType: 'research' | 'idea';
  allResearch: Research[];
  allIdeas: Idea[];
  onBack: () => void;
  onNodeClick: (id: number, type: 'research' | 'idea') => void;
  onRelationChange?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [hoverNodeKey, setHoverNodeKey] = useState<string | null>(null);

  // Drawing state (tracked in ref to avoid stale closures)
  const drawing = useRef<{
    srcNode: NodeData;
    fromX: number; fromY: number; // canvas space port origin
    toX: number; toY: number;     // canvas space mouse position
  } | null>(null);
  const [drawingTick, setDrawingTick] = useState(0); // force re-render during draw

  // Panning state
  const panDrag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Keep zoom/pan in refs for closures
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Build graph ───────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 800;
    const ch = containerRef.current?.clientHeight ?? 600;
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
      connected = allIdeas
        .filter(i => i.researchIds?.includes(selectedId))
        .map(i => ({ item: i, type: 'idea' as const }));
      connected.forEach(({ item }) =>
        newEdges.push({ sourceId: selectedId, sourceType: 'research', targetId: item.id, targetType: 'idea' }));
    } else {
      const idea = center as Idea;
      connected = allResearch
        .filter(r => idea.researchIds?.includes(r.id))
        .map(r => ({ item: r, type: 'research' as const }));
      connected.forEach(({ item }) =>
        newEdges.push({ sourceId: selectedId, sourceType: 'idea', targetId: item.id, targetType: 'research' }));
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
  }, [selectedId, selectedType, allResearch, allIdeas]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // ── Screen ↔ canvas coordinate conversion ─────────────────────────
  // Transform: translate(pan.x, pan.y) scale(zoom) with origin 50% 50%

  const screenToCanvas = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    const cx = (sx - rect.left - panRef.current.x - cw / 2) / zoomRef.current + cw / 2;
    const cy = (sy - rect.top - panRef.current.y - ch / 2) / zoomRef.current + ch / 2;
    return { x: cx, y: cy };
  }, []);

  // ── Canvas pointer handlers ────────────────────────────────────────

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if ((e.target as HTMLElement).closest('[data-port]')) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    panDrag.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag.current) {
      setPan({
        x: panDrag.current.px + (e.clientX - panDrag.current.mx),
        y: panDrag.current.py + (e.clientY - panDrag.current.my),
      });
    }
    if (drawing.current) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      drawing.current.toX = x;
      drawing.current.toY = y;
      setDrawingTick(t => t + 1);
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panDrag.current = null;

    if (drawing.current && hoverNodeKey) {
      const parts = hoverNodeKey.split('-');
      const targetType = parts[0] as 'research' | 'idea';
      const targetId = parseInt(parts[1]);
      const { srcNode } = drawing.current;

      if (srcNode.id !== targetId || srcNode.type !== targetType) {
        if (!edges.some(ex =>
          (ex.sourceId === srcNode.id && ex.targetId === targetId) ||
          (ex.sourceId === targetId && ex.targetId === srcNode.id)
        )) {
          saveEdge(srcNode.id, srcNode.type, targetId, targetType);
        }
      }
    }
    drawing.current = null;
    setHoverNodeKey(null);
    setDrawingTick(t => t + 1);
  };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.25, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))));
  };

  // ── Node drag ─────────────────────────────────────────────────────

  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: NodeData) => {
    if ((e.target as HTMLElement).closest('[data-port]')) return;
    if ((e.target as HTMLElement).closest('[data-detail]')) return;
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    const nx = node.x, ny = node.y;
    const nodeKey = getNodeKey(node.id, node.type);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoomRef.current;
      const dy = (ev.clientY - sy) / zoomRef.current;
      setNodes(prev => prev.map(n =>
        getNodeKey(n.id, n.type) === nodeKey ? { ...n, x: nx + dx, y: ny + dy } : n
      ));
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  // ── Port drag (start drawing edge) ────────────────────────────────

  const onPortPointerDown = (e: React.PointerEvent, node: NodeData, side: 'top' | 'bottom') => {
    e.stopPropagation();
    const fromX = node.x + NODE_W / 2;
    const fromY = side === 'bottom' ? node.y + NODE_H : node.y;
    drawing.current = { srcNode: node, fromX, fromY, toX: fromX, toY: fromY };
    setDrawingTick(t => t + 1);
  };

  // ── Save / delete edges ────────────────────────────────────────────

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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchIds: newResearchIds }),
      });
      if (resp.ok) {
        setEdges(prev => [...prev, { sourceId: fromId, sourceType: fromType, targetId: toId, targetType: toType, manual: true }]);
        flash('Bağlantı kaydedildi ✓');
        onRelationChange?.();
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchIds: newResearchIds }),
      });
      if (resp.ok) {
        setEdges(prev => prev.filter(ex => ex !== edge));
        setHoveredEdge(null);
        flash('Bağlantı silindi');
        onRelationChange?.();
      } else flash('Silinemedi');
    } catch { flash('Hata oluştu'); }
  };

  const flash = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 2500);
  };

  // ── Zoom controls ─────────────────────────────────────────────────

  const zoomIn = () => setZoom(z => Math.min(2.5, +(z + 0.2).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(0.25, +(z - 0.2).toFixed(2)));
  const fitView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // ── Minimap ───────────────────────────────────────────────────────

  const MM_W = 170, MM_H = 100;
  const allX = nodes.map(n => n.x), allY = nodes.map(n => n.y);
  const minX = (allX.length ? Math.min(...allX) : 0) - 40;
  const minY = (allY.length ? Math.min(...allY) : 0) - 40;
  const maxX = (allX.length ? Math.max(...allX.map(x => x + NODE_W)) : 100) + 40;
  const maxY = (allY.length ? Math.max(...allY.map(y => y + NODE_H)) : 100) + 40;
  const ww = maxX - minX || 1, wh = maxY - minY || 1;
  const msx = MM_W / ww, msy = MM_H / wh;

  // Current drawing state snapshot for render
  const dr = drawing.current;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
        backgroundPosition: `${pan.x % 28}px ${pan.y % 28}px`,
        backgroundColor: '#f8fafc',
        cursor: panDrag.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Top bar ──────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md text-sm font-medium text-gray-700 transition-all">
          <ArrowLeft size={14} /> Listeye Dön
        </button>
        <span className="text-xs text-gray-400 bg-white/90 px-2.5 py-1 rounded-full border border-gray-100">
          {nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {saveMsg && (
          <span className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${saveMsg.includes('✓') ? 'bg-green-50 border-green-200 text-green-700' : saveMsg.includes('silindi') ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Drawing hint ──────────────────────────── */}
      {dr && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium" style={{ pointerEvents: 'none' }}>
          Bağlanmak istediğiniz düğümün üstüne sürükleyin
        </div>
      )}

      {/* ── Zoom controls ────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1" style={{ pointerEvents: 'auto' }}>
        <button onClick={zoomIn} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomIn size={14} /></button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomOut size={14} /></button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><Maximize2 size={13} /></button>
        <div className="text-center text-[11px] text-gray-400 font-medium mt-0.5">{Math.round(zoom * 100)}%</div>
      </div>

      {/* ── Main transform layer ──────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%',
          pointerEvents: 'none',
        }}
      >
        {/* SVG: edges + ports + live edge */}
        <svg
          className="absolute inset-0 overflow-visible"
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
            const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
            if (!src || !tgt) return null;
            const path = edgePath(src, tgt);
            const mx = (src.x + tgt.x) / 2 + NODE_W / 2;
            const my = (src.y + NODE_H + tgt.y) / 2;
            const hovered = hoveredEdge === i;

            return (
              <g key={i}>
                {/* Invisible hit area */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={18}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredEdge(i)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
                {/* Visible edge */}
                <path d={path} fill="none"
                  stroke={hovered ? '#6366f1' : edge.manual ? '#818cf8' : '#c7d2fe'}
                  strokeWidth={hovered ? 2.5 : 2}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
                />
                {/* Delete button at midpoint */}
                {hovered && (
                  <g
                    transform={`translate(${mx}, ${my})`}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredEdge(i)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onClick={() => deleteEdge(edge)}
                  >
                    <circle r={11} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#ef4444" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Live drawing edge */}
          {dr && (
            <g>
              <path
                d={livePath(dr.fromX, dr.fromY, dr.toX, dr.toY)}
                fill="none" stroke="#6366f1" strokeWidth={2}
                strokeDasharray="6 4" strokeLinecap="round" opacity={0.8}
              />
              <circle cx={dr.fromX} cy={dr.fromY} r={5} fill="#6366f1" />
              <circle cx={dr.toX} cy={dr.toY} r={4} fill="#6366f1" opacity={0.5} />
            </g>
          )}

          {/* Port dots (rendered on top of node shadows) */}
          {nodes.map(node => {
            const nk = getNodeKey(node.id, node.type);
            const bx = node.x + NODE_W / 2;
            const topY = node.y;
            const botY = node.y + NODE_H;
            const hs = PORT_SIZE / 2;
            const isConnecting = !!dr;
            const isHoverTarget = hoverNodeKey === nk && isConnecting;

            return (
              <g key={`ports-${nk}`} style={{ pointerEvents: 'all' }}>
                {/* Top port (incoming) */}
                <rect
                  x={bx - hs} y={topY - hs}
                  width={PORT_SIZE} height={PORT_SIZE} rx={2}
                  fill="white"
                  stroke={isHoverTarget ? '#6366f1' : '#a5b4fc'}
                  strokeWidth={isHoverTarget ? 2.5 : 1.5}
                  style={{ cursor: isConnecting ? 'crosshair' : 'default' }}
                  data-port="top"
                  onPointerDown={e => { e.stopPropagation(); onPortPointerDown(e as any, node, 'top'); }}
                  onPointerEnter={() => isConnecting && setHoverNodeKey(nk)}
                  onPointerLeave={() => setHoverNodeKey(null)}
                />

                {/* Bottom port (outgoing) */}
                <rect
                  x={bx - hs} y={botY - hs}
                  width={PORT_SIZE} height={PORT_SIZE} rx={2}
                  fill="white"
                  stroke={isHoverTarget ? '#6366f1' : '#a5b4fc'}
                  strokeWidth={isHoverTarget ? 2.5 : 1.5}
                  style={{ cursor: 'crosshair' }}
                  data-port="bottom"
                  onPointerDown={e => { e.stopPropagation(); onPortPointerDown(e as any, node, 'bottom'); }}
                  onPointerEnter={() => isConnecting && setHoverNodeKey(nk)}
                  onPointerLeave={() => setHoverNodeKey(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const nk = getNodeKey(node.id, node.type);
          const isCenter = node.id === selectedId && node.type === selectedType;
          const isIdea = node.type === 'idea';
          const isHoverTarget = hoverNodeKey === nk && !!dr;

          return (
            <div
              key={nk}
              data-node="true"
              onPointerDown={e => onNodePointerDown(e, node)}
              onPointerEnter={() => dr && setHoverNodeKey(nk)}
              onPointerLeave={() => setHoverNodeKey(null)}
              className={`absolute rounded-2xl border bg-white transition-all ${
                isCenter ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-lg'
                : isHoverTarget ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-xl'
                : 'border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300'
              }`}
              style={{
                left: node.x, top: node.y,
                width: NODE_W,
                pointerEvents: 'auto',
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              {/* Badge row */}
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-t-2xl border-b ${
                isIdea
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-indigo-50 border-indigo-100'
              }`}>
                <span className={`text-[10px] font-bold tracking-widest uppercase ${isIdea ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {isIdea ? '💡 Fikir' : '📄 Araştırma'}
                </span>
                {isCenter && (
                  <span className="ml-auto text-[9px] text-gray-400 font-medium">Seçili</span>
                )}
                <button
                  data-detail="true"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onNodeClick(node.id, node.type); }}
                  className="ml-auto p-0.5 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
                  style={{ pointerEvents: 'auto' }}
                  title="Detayı Göster"
                >
                  <ExternalLink size={11} />
                </button>
              </div>

              {/* Content */}
              <div className="px-3 pt-2.5 pb-3">
                <h4 className="font-semibold text-gray-900 text-[13px] mb-1.5 line-clamp-2 leading-snug">{node.title}</h4>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{node.summary}</p>
                <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={10} className={isIdea ? 'text-amber-500' : 'text-indigo-400'} />
                    {node.voteCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {node.collaboratorCount}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-300 font-mono">{node.type === 'idea' ? `#${node.id}` : `R${node.id}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Minimap ───────────────────────────────── */}
      {nodes.length > 0 && (
        <div
          className="absolute bottom-4 right-4 z-20 bg-white/95 border border-gray-200 rounded-xl shadow-sm overflow-hidden"
          style={{ width: MM_W, height: MM_H, pointerEvents: 'none' }}
        >
          <svg width={MM_W} height={MM_H}>
            {edges.map((edge, i) => {
              const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
              const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
              if (!src || !tgt) return null;
              return (
                <line key={i}
                  x1={(src.x - minX) * msx + NODE_W * msx / 2}
                  y1={(src.y - minY) * msy + NODE_H * msy}
                  x2={(tgt.x - minX) * msx + NODE_W * msx / 2}
                  y2={(tgt.y - minY) * msy}
                  stroke={edge.manual ? '#818cf8' : '#c7d2fe'} strokeWidth={1} strokeDasharray="3 2"
                />
              );
            })}
            {nodes.map(node => {
              const isCenter = node.id === selectedId && node.type === selectedType;
              const isIdea = node.type === 'idea';
              return (
                <rect key={`mm-${getNodeKey(node.id, node.type)}`}
                  x={(node.x - minX) * msx} y={(node.y - minY) * msy}
                  width={NODE_W * msx} height={NODE_H * msy} rx={2}
                  fill={isCenter ? '#eef2ff' : isIdea ? '#fffbeb' : '#f5f3ff'}
                  stroke={isCenter ? '#6366f1' : isIdea ? '#f59e0b' : '#818cf8'}
                  strokeWidth={isCenter ? 1.5 : 1}
                />
              );
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-gray-300 font-medium">Mini Harita</div>
        </div>
      )}
    </div>
  );
}
