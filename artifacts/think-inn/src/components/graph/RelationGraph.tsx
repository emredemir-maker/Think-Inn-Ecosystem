import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Users, ThumbsUp, ZoomIn, ZoomOut, Maximize2, ExternalLink, Link2 } from 'lucide-react';

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

const NODE_W = 230;
const NODE_H = 155;
const MINIMAP_W = 180;
const MINIMAP_H = 110;

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
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Drawing edge state
  const [drawingEdge, setDrawingEdge] = useState<{
    fromId: number; fromType: string;
    fromScreenX: number; fromScreenY: number;
    toScreenX: number; toScreenY: number;
  } | null>(null);
  const [hoverNodeKey, setHoverNodeKey] = useState<string | null>(null);

  // Refs for drag state (avoids stale closure issues)
  const panDragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const nodesRef = useRef<NodeData[]>([]);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const getNodeKey = (id: number, type: string) => `${type}-${id}`;

  // ── Build graph ────────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    const newNodes: NodeData[] = [];
    const newEdges: Edge[] = [];

    const centerItem = selectedType === 'research'
      ? allResearch.find(r => r.id === selectedId)
      : allIdeas.find(i => i.id === selectedId);
    if (!centerItem) return;

    const cw = containerRef.current?.clientWidth || 800;
    const ch = containerRef.current?.clientHeight || 600;
    const cx = cw / 2 - NODE_W / 2;
    const cy = ch / 2 - NODE_H / 2;

    newNodes.push({
      id: centerItem.id, type: selectedType,
      title: centerItem.title,
      summary: selectedType === 'research' ? (centerItem as Research).summary ?? '' : (centerItem as Idea).description ?? '',
      voteCount: centerItem.voteCount,
      collaboratorCount: selectedType === 'idea' ? ((centerItem as Idea).collaborators?.length || 0) : 1,
      x: cx, y: cy,
    });

    let connectedItems: (Research | Idea)[] = [];
    let connectedTypes: ('research' | 'idea')[] = [];

    if (selectedType === 'research') {
      const related = allIdeas.filter(i => i.researchIds?.includes(selectedId));
      connectedItems = related;
      connectedTypes = related.map(() => 'idea');
      related.forEach(i => newEdges.push({ sourceId: selectedId, sourceType: 'research', targetId: i.id, targetType: 'idea' }));
    } else {
      const idea = centerItem as Idea;
      if (idea.researchIds?.length) {
        const related = allResearch.filter(r => idea.researchIds!.includes(r.id));
        connectedItems = related;
        connectedTypes = related.map(() => 'research' as const);
        related.forEach(r => newEdges.push({ sourceId: selectedId, sourceType: 'idea', targetId: r.id, targetType: 'research' }));
      }
    }

    const count = connectedItems.length;
    const radius = Math.max(300, count * 80);

    connectedItems.forEach((item, index) => {
      const type = connectedTypes[index];
      const angle = count === 1 ? -Math.PI / 2
        : -Math.PI / 2 + (index / Math.max(count - 1, 1)) * (count > 2 ? 2 * Math.PI : Math.PI);
      newNodes.push({
        id: item.id, type,
        title: item.title,
        summary: type === 'research' ? (item as Research).summary ?? '' : (item as Idea).description ?? '',
        voteCount: item.voteCount,
        collaboratorCount: type === 'idea' ? ((item as Idea).collaborators?.length || 0) : 1,
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

  // ── Canvas pan (pointer events on canvas background) ───────────────

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only start pan if clicking the background (not a node)
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if ((e.target as HTMLElement).closest('[data-connect]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPanX: panRef.current.x, startPanY: panRef.current.y,
    };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
    }
    // Update drawing edge pointer position
    if (drawingEdge) {
      const rect = containerRef.current!.getBoundingClientRect();
      setDrawingEdge(d => d ? { ...d, toScreenX: e.clientX - rect.left, toScreenY: e.clientY - rect.top } : d);
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panDragRef.current = null;

    if (drawingEdge && hoverNodeKey) {
      const parts = hoverNodeKey.split('-');
      const targetType = parts[0] as 'research' | 'idea';
      const targetId = parseInt(parts[1]);
      const { fromId, fromType } = drawingEdge;

      if (fromId !== targetId && fromType !== targetType &&
        !edges.some(e2 => e2.sourceId === fromId && e2.targetId === targetId)) {
        saveEdge(fromId, fromType, targetId, targetType);
      }
    }
    setDrawingEdge(null);
    setHoverNodeKey(null);
  };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(1))));
  };

  // ── Node dragging (pointer capture on each node) ───────────────────

  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: NodeData) => {
    if ((e.target as HTMLElement).closest('[data-connect]')) return;
    if ((e.target as HTMLElement).closest('[data-detail]')) return;
    e.stopPropagation();

    // Capture currentTarget immediately — it becomes null after the handler returns
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startNx = node.x;
    const startNy = node.y;
    const nodeKey = getNodeKey(node.id, node.type);
    const z = zoomRef.current;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / z;
      const dy = (ev.clientY - startY) / z;
      setNodes(prev => prev.map(n =>
        getNodeKey(n.id, n.type) === nodeKey
          ? { ...n, x: startNx + dx, y: startNy + dy }
          : n
      ));
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  // ── Connect button: start drawing edge ────────────────────────────

  const onConnectPointerDown = (e: React.PointerEvent, node: NodeData) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setDrawingEdge({ fromId: node.id, fromType: node.type, fromScreenX: sx, fromScreenY: sy, toScreenX: sx, toScreenY: sy });
  };

  // ── Save edge ─────────────────────────────────────────────────────

  const saveEdge = async (fromId: number, fromType: string, targetId: number, targetType: string) => {
    let ideaId: number, researchId: number;
    if (fromType === 'idea' && targetType === 'research') { ideaId = fromId; researchId = targetId; }
    else if (fromType === 'research' && targetType === 'idea') { ideaId = targetId; researchId = fromId; }
    else return;

    try {
      const idea = allIdeas.find(i => i.id === ideaId);
      if (!idea) return;
      const newResearchIds = Array.from(new Set([...(idea.researchIds || []), researchId]));
      const resp = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchIds: newResearchIds }),
      });
      if (resp.ok) {
        setEdges(prev => [...prev, { sourceId: fromId, sourceType: fromType, targetId, targetType, manual: true }]);
        setSaveMsg('Bağlantı kaydedildi ✓');
        onRelationChange?.();
      } else {
        setSaveMsg('Kaydedilemedi');
      }
    } catch {
      setSaveMsg('Bağlantı hatası');
    } finally {
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  // ── Zoom controls ─────────────────────────────────────────────────

  const zoomIn = () => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)));
  const zoomOut = () => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)));
  const fitView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // ── Minimap ───────────────────────────────────────────────────────

  const allX = nodes.map(n => n.x);
  const allY = nodes.map(n => n.y);
  const minX = (allX.length ? Math.min(...allX) : 0) - 40;
  const minY = (allY.length ? Math.min(...allY) : 0) - 40;
  const maxX = (allX.length ? Math.max(...allX.map(x => x + NODE_W)) : 100) + 40;
  const maxY = (allY.length ? Math.max(...allY.map(y => y + NODE_H)) : 100) + 40;
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const mmSX = MINIMAP_W / worldW;
  const mmSY = MINIMAP_H / worldH;

  // For the live drawing edge in canvas space
  const edgeSrcNode = drawingEdge ? nodes.find(n => n.id === drawingEdge.fromId && n.type === drawingEdge.fromType) : null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundColor: '#f8f9fa',
        cursor: panDragRef.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Top bar ──────────────────────────────── */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md text-sm font-medium text-gray-700 transition-all">
          <ArrowLeft size={15} /> Listeye Dön
        </button>
        <span className="text-xs text-gray-400 bg-white/90 px-2 py-1 rounded-full border border-gray-200">
          {nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {saveMsg && (
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${saveMsg.includes('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Drawing edge hint ─────────────────────── */}
      {drawingEdge && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium" style={{ pointerEvents: 'none' }}>
          Bağlanmak istediğiniz düğüme sürükleyin
        </div>
      )}

      {/* ── Zoom controls ─────────────────────────── */}
      <div className="absolute top-5 right-5 z-20 flex flex-col gap-1" style={{ pointerEvents: 'auto' }}>
        <button onClick={zoomIn} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all"><ZoomIn size={15} /></button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all"><ZoomOut size={15} /></button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all"><Maximize2 size={13} /></button>
        <div className="text-center text-xs text-gray-400 font-medium mt-0.5">{Math.round(zoom * 100)}%</div>
      </div>

      {/* ── Main canvas layer (pan + zoom transform) ── */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '50% 50%', pointerEvents: 'none' }}
      >
        {/* SVG edges */}
        <svg className="absolute inset-0 overflow-visible" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
            const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
            if (!src || !tgt) return null;
            const sx = src.x + NODE_W / 2, sy = src.y + NODE_H / 2;
            const tx = tgt.x + NODE_W / 2, ty = tgt.y + NODE_H / 2;
            const mx = (sx + tx) / 2, my = (sy + ty) / 2 - 50;
            return (
              <g key={i}>
                <path d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`} fill="none"
                  stroke={edge.manual ? '#6366f1' : '#c7d2fe'} strokeWidth="2" strokeDasharray="6 3" />
                <circle cx={sx} cy={sy} r="4" fill={edge.manual ? '#6366f1' : '#818cf8'} />
                <circle cx={tx} cy={ty} r="4" fill={edge.manual ? '#6366f1' : '#818cf8'} />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const nodeKey = getNodeKey(node.id, node.type);
          const isIdea = node.type === 'idea';
          const isCenter = node.id === selectedId && node.type === selectedType;
          const isHovered = hoverNodeKey === nodeKey && !!drawingEdge;

          return (
            <div
              key={nodeKey}
              data-node="true"
              onPointerDown={e => onNodePointerDown(e, node)}
              onPointerEnter={() => drawingEdge && setHoverNodeKey(nodeKey)}
              onPointerLeave={() => setHoverNodeKey(null)}
              className={`absolute bg-white rounded-xl border transition-shadow ${isCenter
                ? 'border-primary ring-2 ring-primary/20 shadow-md'
                : isHovered ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-lg'
                  : 'border-gray-200 shadow-sm hover:shadow-md'}`}
              style={{
                left: node.x, top: node.y, width: NODE_W,
                cursor: 'grab',
                pointerEvents: 'auto',
                touchAction: 'none',
              }}
            >
              {/* Badge */}
              <div className={`px-3 py-1.5 text-xs font-bold rounded-t-xl border-b border-gray-100 flex items-center gap-1.5 ${isIdea ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                {isCenter && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
                {isIdea ? 'FİKİR' : 'ARAŞTIRMA'}
                {isCenter && <span className="ml-auto text-[10px] opacity-60">Seçili</span>}
              </div>

              {/* Content */}
              <div className="p-3">
                <h4 className="font-semibold text-gray-900 text-sm mb-1.5 line-clamp-2 leading-tight">{node.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{node.summary}</p>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <ThumbsUp size={11} className={isIdea ? 'text-amber-500' : 'text-indigo-500'} />
                      {node.voteCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Users size={11} className="text-gray-400" />
                      {node.collaboratorCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Connect button */}
                    <button
                      data-connect="true"
                      onPointerDown={e => onConnectPointerDown(e, node)}
                      className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Bağlantı çiz"
                      style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
                    >
                      <Link2 size={12} />
                    </button>
                    {/* Detail button */}
                    <button
                      data-detail="true"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); onNodeClick(node.id, node.type); }}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Detayı Göster"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Drawing edge overlay (screen space, outside transform) ── */}
      {drawingEdge && edgeSrcNode && (
        <svg className="absolute inset-0 overflow-visible" style={{ width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }}>
          <line
            x1={(edgeSrcNode.x + NODE_W / 2) * zoom + pan.x}
            y1={(edgeSrcNode.y + NODE_H / 2) * zoom + pan.y}
            x2={drawingEdge.toScreenX}
            y2={drawingEdge.toScreenY}
            stroke="#6366f1" strokeWidth="2" strokeDasharray="5 3" opacity="0.8"
          />
          <circle
            cx={(edgeSrcNode.x + NODE_W / 2) * zoom + pan.x}
            cy={(edgeSrcNode.y + NODE_H / 2) * zoom + pan.y}
            r="5" fill="#6366f1"
          />
        </svg>
      )}

      {/* ── Minimap ──────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="absolute bottom-5 right-5 z-20 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden"
          style={{ width: MINIMAP_W, height: MINIMAP_H, pointerEvents: 'none' }}>
          <svg width={MINIMAP_W} height={MINIMAP_H}>
            {edges.map((edge, i) => {
              const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
              const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
              if (!src || !tgt) return null;
              return (
                <line key={i}
                  x1={(src.x - minX) * mmSX + (NODE_W * mmSX) / 2}
                  y1={(src.y - minY) * mmSY + (NODE_H * mmSY) / 2}
                  x2={(tgt.x - minX) * mmSX + (NODE_W * mmSX) / 2}
                  y2={(tgt.y - minY) * mmSY + (NODE_H * mmSY) / 2}
                  stroke={edge.manual ? '#6366f1' : '#c7d2fe'} strokeWidth="1" strokeDasharray="3 2"
                />
              );
            })}
            {nodes.map(node => {
              const isIdea = node.type === 'idea';
              const isCenter = node.id === selectedId && node.type === selectedType;
              return (
                <rect key={`mm-${getNodeKey(node.id, node.type)}`}
                  x={(node.x - minX) * mmSX} y={(node.y - minY) * mmSY}
                  width={NODE_W * mmSX} height={NODE_H * mmSY} rx="2"
                  fill={isCenter ? '#4f46e5' : isIdea ? '#fef3c7' : '#eef2ff'}
                  stroke={isCenter ? '#4f46e5' : isIdea ? '#d97706' : '#6366f1'}
                  strokeWidth="1"
                />
              );
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-gray-400 font-medium">Mini Harita</div>
        </div>
      )}
    </div>
  );
}
