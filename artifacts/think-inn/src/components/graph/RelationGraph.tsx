import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Users, ThumbsUp, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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

const NODE_W = 220;
const NODE_H = 150;
const MINIMAP_W = 180;
const MINIMAP_H = 120;

export function RelationGraph({ selectedId, selectedType, allResearch, allIdeas, onBack, onNodeClick }: {
  selectedId: number;
  selectedType: 'research' | 'idea';
  allResearch: Research[];
  allIdeas: Idea[];
  onBack: () => void;
  onNodeClick: (id: number, type: 'research' | 'idea') => void;
}) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<{ source: number, target: number, sourceType: string, targetType: string }[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const buildGraph = useCallback(() => {
    const newNodes: NodeData[] = [];
    const newEdges: { source: number, target: number, sourceType: string, targetType: string }[] = [];

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
      summary: selectedType === 'research' ? (centerItem as Research).summary : (centerItem as Idea).description,
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
      relatedIdeas.forEach(idea => {
        newEdges.push({ source: selectedId, target: idea.id, sourceType: 'research', targetType: 'idea' });
      });
    } else {
      const idea = centerItem as Idea;
      if (idea.researchIds?.length) {
        const rel = allResearch.filter(r => idea.researchIds!.includes(r.id));
        connectedItems = [...connectedItems, ...rel];
        connectedTypes = [...connectedTypes, ...rel.map(() => 'research' as const)];
        rel.forEach(r => {
          newEdges.push({ source: selectedId, target: r.id, sourceType: 'idea', targetType: 'research' });
        });
      }
    }

    const count = connectedItems.length;
    const radius = Math.max(280, count * 70);
    const startAngle = -Math.PI / 2;

    connectedItems.forEach((item, index) => {
      const type = connectedTypes[index];
      const angle = count === 1
        ? startAngle
        : startAngle + (index / (count - 1)) * Math.PI * (count > 2 ? 2 : 1);

      newNodes.push({
        id: item.id,
        type,
        title: item.title,
        summary: type === 'research' ? (item as Research).summary : (item as Idea).description,
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

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
  };

  const zoomIn = () => setZoom(z => Math.min(2, +(z + 0.2).toFixed(1)));
  const zoomOut = () => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)));
  const fitView = () => { setPan({ x: 0, y: 0 }); setZoom(1); };

  // Minimap calculations
  const allX = nodes.map(n => n.x);
  const allY = nodes.map(n => n.y);
  const minX = Math.min(...allX, 0) - 40;
  const minY = Math.min(...allY, 0) - 40;
  const maxX = Math.max(...allX.map(x => x + NODE_W), 0) + 40;
  const maxY = Math.max(...allY.map(y => y + NODE_H), 0) + 40;
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const scaleX = MINIMAP_W / worldW;
  const scaleY = MINIMAP_H / worldH;

  return (
    <div
      className="absolute inset-0 bg-[#f8f9fa] overflow-hidden select-none"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning ? 'grabbing' : 'grab',
      }}
    >
      {/* Top-left controls */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-700"
        >
          <ArrowLeft size={15} />
          Listeye Dön
        </button>
        <span className="text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-full border border-gray-200">
          {nodes.length} düğüm · {edges.length} bağlantı
        </span>
      </div>

      {/* Zoom controls — top right */}
      <div className="absolute top-5 right-5 z-20 flex flex-col gap-1">
        <button onClick={zoomIn} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <ZoomIn size={15} />
        </button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <ZoomOut size={15} />
        </button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md flex items-center justify-center text-gray-600 hover:text-primary transition-all">
          <Maximize2 size={13} />
        </button>
        <div className="text-center text-xs text-gray-400 mt-0.5 font-medium">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Canvas layer (pan + zoom) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%',
        }}
      >
        {/* SVG edges */}
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {edges.map((edge, i) => {
            const src = nodes.find(n => n.id === edge.source && n.type === edge.sourceType);
            const tgt = nodes.find(n => n.id === edge.target && n.type === edge.targetType);
            if (!src || !tgt) return null;
            const sx = src.x + NODE_W / 2;
            const sy = src.y + NODE_H / 2;
            const tx = tgt.x + NODE_W / 2;
            const ty = tgt.y + NODE_H / 2;
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2 - 40;
            return (
              <g key={i}>
                <path
                  d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`}
                  fill="none"
                  stroke="#c7d2fe"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
                <circle cx={sx} cy={sy} r="4" fill="#818cf8" />
                <circle cx={tx} cy={ty} r="4" fill="#818cf8" />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const isIdea = node.type === 'idea';
          const isCenter = node.id === selectedId && node.type === selectedType;
          return (
            <div
              key={`${node.type}-${node.id}`}
              data-node="true"
              onClick={e => { e.stopPropagation(); onNodeClick(node.id, node.type); }}
              className={`absolute w-[220px] bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer border ${isCenter ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-gray-200'}`}
              style={{ left: node.x, top: node.y, width: NODE_W }}
            >
              <div className={`px-3 py-1.5 text-xs font-bold rounded-t-xl border-b border-gray-100 flex items-center gap-1.5 ${isIdea ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                {isCenter && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />}
                {isIdea ? 'FİKİR' : 'ARAŞTIRMA'}
                {isCenter && <span className="ml-auto text-[10px] opacity-60">Seçili</span>}
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 leading-tight">{node.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{node.summary}</p>
                <div className="flex items-center justify-between text-xs font-medium text-gray-500 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={11} className={isIdea ? 'text-amber-500' : 'text-indigo-500'} />
                    {node.voteCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={11} className="text-gray-400" />
                    {node.collaboratorCount}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Minimap — bottom right */}
      {nodes.length > 0 && (
        <div className="absolute bottom-5 right-5 z-20 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden" style={{ width: MINIMAP_W, height: MINIMAP_H }}>
          <svg width={MINIMAP_W} height={MINIMAP_H}>
            {/* Edges in minimap */}
            {edges.map((edge, i) => {
              const src = nodes.find(n => n.id === edge.source && n.type === edge.sourceType);
              const tgt = nodes.find(n => n.id === edge.target && n.type === edge.targetType);
              if (!src || !tgt) return null;
              return (
                <line key={i}
                  x1={(src.x - minX) * scaleX + (NODE_W * scaleX) / 2}
                  y1={(src.y - minY) * scaleY + (NODE_H * scaleY) / 2}
                  x2={(tgt.x - minX) * scaleX + (NODE_W * scaleX) / 2}
                  y2={(tgt.y - minY) * scaleY + (NODE_H * scaleY) / 2}
                  stroke="#c7d2fe" strokeWidth="1" strokeDasharray="3 2"
                />
              );
            })}
            {/* Nodes in minimap */}
            {nodes.map(node => {
              const isIdea = node.type === 'idea';
              const isCenter = node.id === selectedId && node.type === selectedType;
              return (
                <rect
                  key={`mm-${node.type}-${node.id}`}
                  x={(node.x - minX) * scaleX}
                  y={(node.y - minY) * scaleY}
                  width={NODE_W * scaleX}
                  height={NODE_H * scaleY}
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
