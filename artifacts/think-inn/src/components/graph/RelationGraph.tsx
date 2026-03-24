import React, { useState, useRef, useEffect } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Users, ThumbsUp } from 'lucide-react';

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate nodes and edges based on selected item
    const newNodes: NodeData[] = [];
    const newEdges: { source: number, target: number, sourceType: string, targetType: string }[] = [];

    // Center node
    const centerItem = selectedType === 'research' 
      ? allResearch.find(r => r.id === selectedId)
      : allIdeas.find(i => i.id === selectedId);

    if (!centerItem) return;

    newNodes.push({
      id: centerItem.id,
      type: selectedType,
      title: centerItem.title,
      summary: selectedType === 'research' ? (centerItem as Research).summary : (centerItem as Idea).description,
      voteCount: centerItem.voteCount,
      collaboratorCount: selectedType === 'idea' ? ((centerItem as Idea).collaborators?.length || 0) : 1,
      x: window.innerWidth / 3, // approximate center of the view
      y: window.innerHeight / 2.5
    });

    // Connected nodes
    let connectedItems: (Research | Idea)[] = [];
    let connectedTypes: ('research' | 'idea')[] = [];

    if (selectedType === 'research') {
      // Find ideas that reference this research
      const relatedIdeas = allIdeas.filter(idea => idea.researchIds?.includes(selectedId));
      connectedItems = relatedIdeas;
      connectedTypes = relatedIdeas.map(() => 'idea');
      
      relatedIdeas.forEach(idea => {
        newEdges.push({ source: selectedId, target: idea.id, sourceType: 'research', targetType: 'idea' });
      });
    } else {
      // Find research referenced by this idea
      const idea = centerItem as Idea;
      if (idea.researchIds && idea.researchIds.length > 0) {
        const relatedResearch = allResearch.filter(r => idea.researchIds!.includes(r.id));
        connectedItems = [...connectedItems, ...relatedResearch];
        connectedTypes = [...connectedTypes, ...relatedResearch.map(() => 'research' as const)];
        
        relatedResearch.forEach(r => {
          newEdges.push({ source: selectedId, target: r.id, sourceType: 'idea', targetType: 'research' });
        });
      }
    }

    // Position connected nodes in a circle
    const radius = 300;
    const angleStep = (2 * Math.PI) / Math.max(1, connectedItems.length);

    connectedItems.forEach((item, index) => {
      const type = connectedTypes[index];
      const angle = index * angleStep;
      
      newNodes.push({
        id: item.id,
        type: type,
        title: item.title,
        summary: type === 'research' ? (item as Research).summary : (item as Idea).description,
        voteCount: item.voteCount,
        collaboratorCount: type === 'idea' ? ((item as Idea).collaborators?.length || 0) : 1,
        x: (window.innerWidth / 3) + radius * Math.cos(angle),
        y: (window.innerHeight / 2.5) + radius * Math.sin(angle)
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
    setPan({ x: 0, y: 0 }); // reset pan
  }, [selectedId, selectedType, allResearch, allIdeas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="absolute inset-0 bg-[#f8f9fa] overflow-hidden select-none"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      <div className="absolute top-6 left-6 z-10">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all text-sm font-medium text-gray-700"
        >
          <ArrowLeft size={16} />
          Listeye Dön
        </button>
      </div>

      <div 
        className="absolute inset-0 transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {edges.map((edge, i) => {
            const sourceNode = nodes.find(n => n.id === edge.source && n.type === edge.sourceType);
            const targetNode = nodes.find(n => n.id === edge.target && n.type === edge.targetType);
            
            if (!sourceNode || !targetNode) return null;

            // Center of nodes
            const sx = sourceNode.x + 110; // half of node width
            const sy = sourceNode.y + 75;  // half of node height
            const tx = targetNode.x + 110;
            const ty = targetNode.y + 75;

            return (
              <g key={i}>
                <line 
                  x1={sx} 
                  y1={sy} 
                  x2={tx} 
                  y2={ty} 
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
              onClick={(e) => {
                e.stopPropagation();
                onNodeClick(node.id, node.type);
              }}
              className={`absolute w-[220px] bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border ${isCenter ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'}`}
              style={{ 
                left: node.x, 
                top: node.y,
              }}
            >
              <div className={`px-3 py-1.5 text-xs font-bold rounded-t-xl border-b border-gray-100 ${
                isIdea 
                  ? 'bg-amber-50 text-amber-700' 
                  : 'bg-indigo-50 text-indigo-700'
              }`}>
                {isIdea ? 'FİKİR' : 'ARAŞTIRMA'}
              </div>
              
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 leading-tight">
                  {node.title}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">
                  {node.summary}
                </p>
                
                <div className="flex items-center justify-between text-xs font-medium text-gray-500 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={12} className={isIdea ? 'text-amber-500' : 'text-indigo-500'} />
                    {node.voteCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={12} className="text-gray-400" />
                    {node.collaboratorCount}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}