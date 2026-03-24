import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Users, ThumbsUp, ZoomIn, ZoomOut, Maximize2, ExternalLink, Link2, X } from 'lucide-react';

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

  // Canvas pan
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Node dragging
  const [draggingNodeKey, setDraggingNodeKey] = useState<string | null>(null);
  const [dragNodeStart, setDragNodeStart] = useState({ mx: 0, my: 0, nx: 0, ny: 0 });

  // Edge drawing (connecting two nodes)
  const [drawingEdge, setDrawingEdge] = useState<{ fromId: number; fromType: string; mx: number; my: number } | null>(null);
  const [hoverNodeKey, setHoverNodeKey] = useState<string | null>(null);

  // Save status
  const [savingEdge, setSavingEdge] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const getNodeKey = (id: number, type: string) => `${type}-${id}`;

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
      id: centerItem.id,
      type: selectedType,
      title: centerItem.title,
      summary: selectedType === 'research' ? (centerItem as Research).summary ?? '' : (centerItem as Idea).description ?? '',
      voteCount: centerItem.voteCount,
      collaboratorCount: selectedType === 'idea' ? ((centerItem as Idea).collaborators?.length || 0) : 1,
      x: cx,
      y: cy,
    });

    let connectedItems: (Research | Idea)[] = [];
    let connectedTypes: ('research' | 'idea')[] = [];

    if (selectedType === 'research') {
      const relatedIdeas = allIdeas.filter(idea => idea.researchIds?.includes(selectedId));
      connectedItems = relatedIdeas;
      connectedTypes = relatedIdeas.map(() => 'idea');
      relatedIdeas.forEach(idea => newEdges.push({ sourceId: selectedId, sourceType: 'research', targetId: idea.id, targetType: 'idea' }));
    } else {
      const idea = centerItem as Idea;
      if (idea.researchIds?.length) {
        const rel = allResearch.filter(r => idea.researchIds!.includes(r.id));
        connectedItems = rel;
        connectedTypes = rel.map(() => 'research' as const);
        rel.forEach(r => newEdges.push({ sourceId: selectedId, sourceType: 'idea', targetId: r.id, targetType: 'research' }));
      }
    }

    const count = connectedItems.length;
    const radius = Math.max(300, count * 80);
    const startAngle = -Math.PI / 2;

    connectedItems.forEach((item, index) => {
      const type = connectedTypes[index];
      const angle = count === 1
        ? startAngle
        : startAngle + (index / Math.max(count - 1, 1)) * (count > 2 ? 2 * Math.PI : Math.PI);
      newNodes.push({
        id: item.id,
        type,
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

  // ── Mouse event helpers ──────────────────────────────────────────

  const canvasPos = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    return { mx, my };
  };

  // Canvas-level mousedown: start pan if not on a node
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (draggingNodeKey) {
      const dx = (e.clientX - dragNodeStart.mx) / zoom;
      const dy = (e.clientY - dragNodeStart.my) / zoom;
      setNodes(prev => prev.map(n =>
        getNodeKey(n.id, n.type) === draggingNodeKey
          ? { ...n, x: dragNodeStart.nx + dx, y: dragNodeStart.ny + dy }
          : n
      ));
    }
    if (drawingEdge) {
      const rect = containerRef.current!.getBoundingClientRect();
      setDrawingEdge(d => d ? { ...d, mx: e.clientX - rect.left, my: e.clientY - rect.top } : d);
    }
  };

  const onCanvasMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    if (draggingNodeKey) {
      setDraggingNodeKey(null);
    }

    if (drawingEdge && hoverNodeKey) {
      // Find the target node
      const parts = hoverNodeKey.split('-');
      const targetType = parts[0] as 'research' | 'idea';
      const targetId = parseInt(parts[1]);
      const fromId = drawingEdge.fromId;
      const fromType = drawingEdge.fromType;

      // Only link idea→research or research→idea
      if (
        fromId !== targetId &&
        (fromType !== targetType) &&
        !edges.some(e => e.sourceId === fromId && e.targetId === targetId)
      ) {
        saveEdge(fromId, fromType, targetId, targetType);
      }
    }

    setDrawingEdge(null);
    setHoverNodeKey(null);
  };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(2, Math.max(0.3, +(z + delta).toFixed(1))));
  };

  // Node mousedown: start drag
  const onNodeMouseDown = (e: React.MouseEvent, nodeKey: string, node: NodeData) => {
    e.stopPropagation();
    setDraggingNodeKey(nodeKey);
    setDragNodeStart({ mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y });
  };

  // Connection point mousedown: start drawing an edge
  const onConnectMouseDown = (e: React.MouseEvent, node: NodeData) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    setDrawingEdge({
      fromId: node.id,
      fromType: node.type,
      mx: e.clientX - rect.left,
      my: e.clientY - rect.top,
    });
  };

  // ── Save edge to backend ──────────────────────────────────────────

  const saveEdge = async (fromId: number, fromType: string, targetId: number, targetType: string) => {
    // idea must link to research
    let ideaId: number, researchId: number;
    if (fromType === 'idea' && targetType === 'research') {
      ideaId = fromId; researchId = targetId;
    } else if (fromType === 'research' && targetType === 'idea') {
      ideaId = targetId; researchId = fromId;
    } else {
      return; // only idea<->research links
    }

    setSavingEdge(true);
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
        const updated = await resp.json();
        setEdges(prev => [...prev, { sourceId: fromId, sourceType: fromType, targetId, targetType, manual: true }]);
        setSaveMsg('Bağlantı kaydedildi ✓');
        onRelationChange?.();
      } else {
        setSaveMsg('Bağlantı kaydedilemedi');
      }
    } catch {
      setSaveMsg('Bağlantı hatası');
    } finally {
      setSavingEdge(false);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  };

  // ── Zoom controls ──────────────────────────────────────────────────

  const zoomIn = () => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)));
  const zoomOut = () => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)));
  const fitView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // ── Minimap ────────────────────────────────────────────────────────

  const allX = nodes.map(n => n.x);
  const allY = nodes.map(n => n.y);
  const minX = (Math.min(...allX, 0)) - 40;
  const minY = (Math.min(...allY, 0)) - 40;
  const maxX = (Math.max(...allX.map(x => x + NODE_W), 0)) + 40;
  const maxY = (Math.max(...allY.map(y => y + NODE_H), 0)) + 40;
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const mmScaleX = MINIMAP_W / worldW;
  const mmScaleY = MINIMAP_H / worldH;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-[#f8f9fa] overflow-hidden select-none"
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      onWheel={onCanvasWheel}
      style={{
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning ? 'grabbing' : draggingNodeKey ? 'grabbing' : 'grab',
      }}
    >
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md text-sm font-medium text-gray-700 transition-all"
        >
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

      {/* ── Drawing-edge hint ───────────────────────────── */}
      {drawingEdge && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium pointer-events-none">
          Bağlanmak istediğiniz düğüme sürükleyin
        </div>
      )}

      {/* ── Zoom controls ───────────────────────────────── */}
      <div className="absolute top-5 right-5 z-20 flex flex-col gap-1 pointer-events-auto">
        <button onClick={zoomIn} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <ZoomIn size={15} />
        </button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <ZoomOut size={15} />
        </button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <Maximize2 size={13} />
        </button>
        <div className="text-center text-xs text-gray-400 font-medium mt-0.5">{Math.round(zoom * 100)}%</div>
      </div>

      {/* ── Canvas transform layer ───────────────────────── */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '50% 50%' }}
      >
        {/* SVG: existing edges + drawing edge */}
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
            const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
            if (!src || !tgt) return null;
            const sx = src.x + NODE_W / 2, sy = src.y + NODE_H / 2;
            const tx = tgt.x + NODE_W / 2, ty = tgt.y + NODE_H / 2;
            const mx = (sx + tx) / 2, my = (sy + ty) / 2 - 40;
            return (
              <g key={i}>
                <path d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`} fill="none" stroke={edge.manual ? '#6366f1' : '#c7d2fe'} strokeWidth="2" strokeDasharray="6 3" />
                <circle cx={sx} cy={sy} r="4" fill={edge.manual ? '#6366f1' : '#818cf8'} />
                <circle cx={tx} cy={ty} r="4" fill={edge.manual ? '#6366f1' : '#818cf8'} />
              </g>
            );
          })}

          {/* Live drawing edge */}
          {drawingEdge && (() => {
            const src = nodes.find(n => n.id === drawingEdge.fromId && n.type === drawingEdge.fromType);
            if (!src) return null;
            const sx = (src.x + NODE_W / 2) * zoom + pan.x;
            const sy = (src.y + NODE_H / 2) * zoom + pan.y;
            // Convert screen coords back to canvas coords
            const tx = (drawingEdge.mx - pan.x) / zoom;
            const ty = (drawingEdge.my - pan.y) / zoom;
            return (
              <line x1={src.x + NODE_W / 2} y1={src.y + NODE_H / 2} x2={tx} y2={ty}
                stroke="#6366f1" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
            );
          })()}
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
              onMouseDown={e => onNodeMouseDown(e, nodeKey, node)}
              onMouseEnter={() => drawingEdge && setHoverNodeKey(nodeKey)}
              onMouseLeave={() => setHoverNodeKey(null)}
              className={`absolute bg-white rounded-xl shadow-sm border transition-all ${
                isCenter ? 'border-primary ring-2 ring-primary/20 shadow-md' :
                isHovered ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md' :
                'border-gray-200 hover:shadow-md'
              }`}
              style={{ left: node.x, top: node.y, width: NODE_W, cursor: draggingNodeKey === nodeKey ? 'grabbing' : 'grab' }}
            >
              {/* Header badge */}
              <div className={`px-3 py-1.5 text-xs font-bold rounded-t-xl border-b border-gray-100 flex items-center gap-1.5 ${
                isIdea ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
              }`}>
                {isCenter && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
                {isIdea ? 'FİKİR' : 'ARAŞTIRMA'}
                {isCenter && <span className="ml-auto text-[10px] opacity-60">Seçili</span>}
              </div>

              {/* Body */}
              <div className="p-3">
                <h4 className="font-semibold text-gray-900 text-sm mb-1.5 line-clamp-2 leading-tight">{node.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{node.summary}</p>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} className={isIdea ? 'text-amber-500' : 'text-indigo-500'} /> {node.voteCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={11} className="text-gray-400" /> {node.collaboratorCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Connect button */}
                    <button
                      onMouseDown={e => { e.stopPropagation(); onConnectMouseDown(e, node); }}
                      className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Bağlantı çiz"
                    >
                      <Link2 size={12} />
                    </button>
                    {/* Detail button */}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); onNodeClick(node.id, node.type); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Detayı Göster"
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

      {/* ── Minimap ─────────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="absolute bottom-5 right-5 z-20 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden pointer-events-none" style={{ width: MINIMAP_W, height: MINIMAP_H }}>
          <svg width={MINIMAP_W} height={MINIMAP_H}>
            {edges.map((edge, i) => {
              const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
              const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);
              if (!src || !tgt) return null;
              return (
                <line key={i}
                  x1={(src.x - minX) * mmScaleX + (NODE_W * mmScaleX) / 2}
                  y1={(src.y - minY) * mmScaleY + (NODE_H * mmScaleY) / 2}
                  x2={(tgt.x - minX) * mmScaleX + (NODE_W * mmScaleX) / 2}
                  y2={(tgt.y - minY) * mmScaleY + (NODE_H * mmScaleY) / 2}
                  stroke={edge.manual ? '#6366f1' : '#c7d2fe'} strokeWidth="1" strokeDasharray="3 2"
                />
              );
            })}
            {nodes.map(node => {
              const isIdea = node.type === 'idea';
              const isCenter = node.id === selectedId && node.type === selectedType;
              return (
                <rect key={`mm-${getNodeKey(node.id, node.type)}`}
                  x={(node.x - minX) * mmScaleX} y={(node.y - minY) * mmScaleY}
                  width={NODE_W * mmScaleX} height={NODE_H * mmScaleY}
                  rx="2"
                  fill={isCenter ? '#4f46e5' : isIdea ? '#fef3c7' : '#eef2ff'}
                  stroke={isCenter ? '#4f46e5' : isIdea ? '#d97706' : '#6366f1'}
                  strokeWidth="1"
                />
              );
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-gray-400 font-medium">Harita</div>
        </div>
      )}
    </div>
  );
}
