import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, ThumbsUp, Users, ZoomIn, ZoomOut, Maximize2, ExternalLink, Loader2, CheckCircle, AlertTriangle, BookOpen, Tag, LayoutTemplate } from 'lucide-react';

interface NodeData {
  id: number;
  type: 'research' | 'idea' | 'project';
  title: string;
  summary: string;
  voteCount: number;
  collaboratorCount: number;
  x: number;
  y: number;
  /** Only set for project nodes — the idea ID they're linked to */
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
  /** Project link edges are styled distinctly and not deletable */
  isProjectLink?: boolean;
}

interface ValidationState {
  fromId: number; fromType: string;
  toId: number; toType: string;
  status: 'loading' | 'valid' | 'invalid';
  confidence?: number;
  reason?: string;
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
  const dx = (tgt.x + NODE_W / 2) - (src.x + NODE_W / 2);
  const dy = (tgt.y + NODE_H / 2) - (src.y + NODE_H / 2);
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

function epPath(sx: number, sy: number, tx: number, ty: number, v: boolean): string {
  const off = Math.max(50, Math.sqrt((tx-sx)**2+(ty-sy)**2)*0.4);
  if (v) { const s=ty>sy?1:-1; return `M ${sx} ${sy} C ${sx} ${sy+s*off} ${tx} ${ty-s*off} ${tx} ${ty}`; }
  else    { const s=tx>sx?1:-1; return `M ${sx} ${sy} C ${sx+s*off} ${sy} ${tx-s*off} ${ty} ${tx} ${ty}`; }
}

function livePath(sx: number, sy: number, tx: number, ty: number): string {
  const dx=tx-sx, dy=ty-sy, off=Math.max(50,Math.sqrt(dx*dx+dy*dy)*0.4);
  if (Math.abs(dy)>=Math.abs(dx)) { const s=dy>=0?1:-1; return `M ${sx} ${sy} C ${sx} ${sy+s*off} ${tx} ${ty-s*off} ${tx} ${ty}`; }
  else { const s=dx>=0?1:-1; return `M ${sx} ${sy} C ${sx+s*off} ${sy} ${tx-s*off} ${ty} ${tx} ${ty}`; }
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
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Hovered edge index — driven by SVG onPointerEnter/Leave
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  // Screen-space position of the hovered edge midpoint (for HTML delete button)
  const [deleteBtn, setDeleteBtn] = useState<{ x: number; y: number; edgeIdx: number } | null>(null);

  const [flashMsg, setFlashMsg] = useState<{ text: string; type: 'ok'|'err'|'info' } | null>(null);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [topicPicker, setTopicPicker] = useState<{
    ideaId: number;
    researchId: number;
    neededTopics: string[];
    optionalTopics: string[];
  } | null>(null);

  const drawing = useRef<{ srcNode: NodeData; portSide: PortSide; toX: number; toY: number } | null>(null);
  const [drawTick, setDrawTick] = useState(0);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const panDrag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current  = pan;  }, [pan]);

  // ── Star field (generated once, CSS box-shadow trick) ─────────────
  const starField = React.useMemo(() => {
    const rng = (min: number, max: number) => Math.random() * (max - min) + min;
    const shadows = Array.from({ length: 180 }, () => {
      const x = rng(0, 2400), y = rng(0, 1400);
      const size = Math.random() < 0.12 ? 1.5 : Math.random() < 0.35 ? 1 : 0.5;
      const op = rng(0.08, 0.55).toFixed(2);
      return `${x.toFixed(0)}px ${y.toFixed(0)}px ${size}px rgba(255,255,255,${op})`;
    }).join(',');
    return shadows;
  }, []);

  // ── Canvas → screen space ─────────────────────────────────────────
  const canvasToScreen = useCallback((cx: number, cy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    return {
      x: (cx - cw/2) * zoomRef.current + cw/2 + panRef.current.x,
      y: (cy - ch/2) * zoomRef.current + ch/2 + panRef.current.y,
    };
  }, []);

  // ── Screen → canvas space ─────────────────────────────────────────
  const toCanvas = useCallback((sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    return {
      x: (sx - rect.left - panRef.current.x - cw/2) / zoomRef.current + cw/2,
      y: (sy - rect.top  - panRef.current.y - ch/2) / zoomRef.current + ch/2,
    };
  }, []);

  // ── Build graph ────────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 900;
    const ch = containerRef.current?.clientHeight ?? 600;

    if (globalMode) {
      const newNodes: NodeData[] = [], newEdges: Edge[] = [];
      // 3-column layout: Research | Ideas | Projects
      const projectIdeas = allIdeas.filter(i => !!(i as any).architecturalAnalysis);
      const hasProjects = projectIdeas.length > 0;
      const colGap = Math.max(cw * 0.36, 300);
      const leftX   = hasProjects ? cw/2 - colGap - NODE_W/2 : cw/2 - colGap/2 - NODE_W/2;
      const midX    = cw/2 - NODE_W/2;
      const rightX  = hasProjects ? cw/2 + colGap - NODE_W/2 : cw/2 + colGap/2 - NODE_W/2;
      const vR = Math.max(180, Math.min(220, (ch-120) / Math.max(allResearch.length,1)));
      const vI = Math.max(180, Math.min(220, (ch-120) / Math.max(allIdeas.length,1)));
      const vP = Math.max(180, Math.min(220, (ch-120) / Math.max(projectIdeas.length,1)));

      allResearch.forEach((r,i) => newNodes.push({ id:r.id, type:'research', title:r.title, summary:r.summary??'', voteCount:r.voteCount, collaboratorCount:1, x:leftX, y:ch/2-vR*(allResearch.length-1)/2+i*vR }));
      allIdeas.forEach((idea,i) => {
        newNodes.push({ id:idea.id, type:'idea', title:idea.title, summary:idea.description??'', voteCount:idea.voteCount, collaboratorCount:idea.collaborators?.length??0, x:hasProjects?midX:rightX, y:ch/2-vI*(allIdeas.length-1)/2+i*vI });
        (idea.researchIds??[]).forEach(rid => {
          if (allResearch.find(r=>r.id===rid)) {
            const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m => m.researchId === rid);
            newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:rid, targetType:'research', topicMapping: tm ? { topic: tm.topic, topicType: tm.topicType } : undefined });
          }
        });
      });
      // Project nodes (one per idea that has architecturalAnalysis)
      projectIdeas.forEach((idea,i) => {
        newNodes.push({ id:idea.id, type:'project', title:(idea as any).architecturalAnalysis?.functionalAnalysis ? `${idea.title} — Proje` : idea.title, summary:'Mimari analiz & akış şeması', voteCount:0, collaboratorCount:0, x:rightX, y:ch/2-vP*(projectIdeas.length-1)/2+i*vP, parentIdeaId:idea.id });
        newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:idea.id, targetType:'project', isProjectLink:true });
      });

      setNodes(newNodes); setEdges(newEdges); setPan({x:0,y:0}); setZoom(1);
    } else {
      if (selectedId===undefined||selectedType===undefined) return;
      const cx=cw/2-NODE_W/2, cy=ch/2-NODE_H/2;
      const center = selectedType==='research' ? allResearch.find(r=>r.id===selectedId) : allIdeas.find(i=>i.id===selectedId);
      if (!center) return;
      const newNodes: NodeData[] = [{ id:center.id, type:selectedType, title:center.title, summary:selectedType==='research'?(center as Research).summary??'':(center as Idea).description??'', voteCount:center.voteCount, collaboratorCount:selectedType==='idea'?((center as Idea).collaborators?.length??0):1, x:cx, y:cy }];
      const newEdges: Edge[] = [];
      let connected: {item:Research|Idea;type:'research'|'idea'}[] = [];
      if (selectedType==='research') {
        connected = allIdeas.filter(i=>i.researchIds?.includes(selectedId)).map(i=>({item:i,type:'idea' as const}));
        connected.forEach(({item})=>newEdges.push({sourceId:selectedId,sourceType:'research',targetId:item.id,targetType:'idea'}));
      } else {
        const idea=center as Idea;
        connected = allResearch.filter(r=>idea.researchIds?.includes(r.id)).map(r=>({item:r,type:'research' as const}));
        connected.forEach(({item})=>{
          const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m => m.researchId === item.id);
          newEdges.push({sourceId:selectedId,sourceType:'idea',targetId:item.id,targetType:'research', topicMapping: tm ? { topic: tm.topic, topicType: tm.topicType } : undefined});
        });
        // If this idea has a project, add project node below/right
        if (!!(idea as any).architecturalAnalysis) {
          const projX = cx + 320, projY = cy;
          newNodes.push({ id:idea.id, type:'project', title:`${idea.title} — Proje`, summary:'Mimari analiz & akış şeması', voteCount:0, collaboratorCount:0, x:projX, y:projY, parentIdeaId:idea.id });
          newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:idea.id, targetType:'project', isProjectLink:true });
        }
      }
      const n=connected.length, radius=Math.max(320,n*90);
      connected.forEach(({item,type},i)=>{
        const angle = n===1?Math.PI/2 : -Math.PI/2+(i/Math.max(n-1,1))*(n>2?2*Math.PI:Math.PI);
        newNodes.push({ id:item.id, type, title:item.title, summary:type==='research'?(item as Research).summary??'':(item as Idea).description??'', voteCount:item.voteCount, collaboratorCount:type==='idea'?((item as Idea).collaborators?.length??0):1, x:cx+radius*Math.cos(angle), y:cy+radius*Math.sin(angle) });
      });
      setNodes(newNodes); setEdges(newEdges); setPan({x:0,y:0}); setZoom(1);
    }
  }, [selectedId, selectedType, globalMode, allResearch, allIdeas]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // Update delete button position when zoom/pan/hoveredEdge/nodes change
  useEffect(() => {
    if (hoveredEdgeIdx === null || hoveredEdgeIdx >= edges.length) { setDeleteBtn(null); return; }
    const edge = edges[hoveredEdgeIdx];
    // Don't show delete button for project links
    if (edge.isProjectLink) { setDeleteBtn(null); return; }
    const src = nodes.find(n=>n.id===edge.sourceId&&n.type===edge.sourceType);
    const tgt = nodes.find(n=>n.id===edge.targetId&&n.type===edge.targetType);
    if (!src||!tgt) { setDeleteBtn(null); return; }
    const {s,t} = getBestPorts(src,tgt);
    const mx = (s.x+t.x)/2, my = (s.y+t.y)/2;
    const {x,y} = canvasToScreen(mx,my);
    setDeleteBtn({x, y, edgeIdx:hoveredEdgeIdx});
  }, [hoveredEdgeIdx, edges, nodes, zoom, pan, canvasToScreen]);

  // ── Canvas events ──────────────────────────────────────────────────

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // Don't start panning when clicking on interactive elements
    if (t.closest('button')) return;
    if (t.closest('[data-node]')) return;
    if (t.closest('[data-port]')) return;
    if (t.closest('[data-edge]')) return;  // ← edge hit areas
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    panDrag.current = { mx:e.clientX, my:e.clientY, px:panRef.current.x, py:panRef.current.y };
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag.current) {
      setPan({ x:panDrag.current.px+(e.clientX-panDrag.current.mx), y:panDrag.current.py+(e.clientY-panDrag.current.my) });
    }
    if (drawing.current) {
      const {x,y} = toCanvas(e.clientX, e.clientY);
      drawing.current.toX=x; drawing.current.toY=y;
      setDrawTick(t=>t+1);
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panDrag.current = null;
    if (drawing.current && hoverTarget) {
      const parts = hoverTarget.split('-');
      const targetType = parts[0] as 'research'|'idea';
      const targetId   = parseInt(parts[1]);
      const {srcNode}  = drawing.current;
      if ((srcNode.id!==targetId||srcNode.type!==targetType) &&
          !edges.some(ex=>(ex.sourceId===srcNode.id&&ex.targetId===targetId)||(ex.sourceId===targetId&&ex.targetId===srcNode.id))) {
        startValidation(srcNode.id, srcNode.type, targetId, targetType);
      }
    }
    drawing.current=null; setHoverTarget(null); setDrawTick(t=>t+1);
  };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z=>Math.min(2.5,Math.max(0.2,+(z+(e.deltaY>0?-0.1:0.1)).toFixed(2))));
  };

  // ── Node drag ──────────────────────────────────────────────────────

  const onNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: NodeData) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-port]')||t.closest('[data-detail]')||t.closest('button')) return;
    e.stopPropagation();
    const el=e.currentTarget; el.setPointerCapture(e.pointerId);
    const sx=e.clientX, sy=e.clientY, ox=node.x, oy=node.y;
    const nk=nodeKey(node.id,node.type);
    const onMove=(ev:PointerEvent)=>setNodes(prev=>prev.map(n=>nodeKey(n.id,n.type)===nk?{...n,x:ox+(ev.clientX-sx)/zoomRef.current,y:oy+(ev.clientY-sy)/zoomRef.current}:n));
    const onUp=()=>{el.removeEventListener('pointermove',onMove);el.removeEventListener('pointerup',onUp);};
    el.addEventListener('pointermove',onMove); el.addEventListener('pointerup',onUp);
  };

  const onPortPointerDown = (e: React.PointerEvent<SVGElement>, node: NodeData, side: PortSide) => {
    e.stopPropagation();
    const port=getPort(node,side);
    drawing.current={srcNode:node,portSide:side,toX:port.x,toY:port.y};
    setDrawTick(t=>t+1);
  };

  // ── AI Validation ──────────────────────────────────────────────────

  const startValidation = async (fromId:number, fromType:string, toId:number, toType:string) => {
    let ideaId:number|null=null, researchId:number|null=null;
    if (fromType==='idea'&&toType==='research'){ideaId=fromId;researchId=toId;}
    else if (fromType==='research'&&toType==='idea'){ideaId=toId;researchId=fromId;}
    else { flash('Yalnızca Araştırma ↔ Fikir bağlantısı kurulabilir.','err'); return; }

    setValidation({fromId,fromType,toId,toType,status:'loading'});
    try {
      const resp=await fetch('/api/validate-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchId,ideaId})});
      const data=await resp.json() as {valid:boolean;confidence:number;reason:string};
      setValidation({fromId,fromType,toId,toType,status:data.valid?'valid':'invalid',confidence:data.confidence,reason:data.reason});
      if (data.valid) { setTimeout(()=>{commitEdge(fromId,fromType,toId,toType);setValidation(null);},1200); }
    } catch { setValidation(null); commitEdge(fromId,fromType,toId,toType); }
  };

  const commitEdge = async (fromId:number,fromType:string,toId:number,toType:string) => {
    const [ideaId,researchId] = fromType==='idea'?[fromId,toId]:[toId,fromId];
    const idea = allIdeas.find(i=>i.id===ideaId) as IdeaWithTopics | undefined;
    if(!idea) return;
    const newResearchIds=Array.from(new Set([...(idea.researchIds??[]),researchId]));
    const resp=await fetch(`/api/ideas/${ideaId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchIds:newResearchIds})});
    if(resp.ok){
      setEdges(prev=>[...prev,{sourceId:fromId,sourceType:fromType,targetId:toId,targetType:toType,manual:true}]);
      flash('Bağlantı kaydedildi ✓','ok');
      onRelationChange?.();
      // Show topic picker if idea has research topics
      const neededTopics = idea.neededResearchTopics ?? [];
      const optionalTopics = idea.optionalResearchTopics ?? [];
      if (neededTopics.length > 0 || optionalTopics.length > 0) {
        setTopicPicker({ ideaId, researchId, neededTopics, optionalTopics });
      }
    }
    else flash('Kaydedilemedi','err');
  };

  const saveTopicMapping = async (topic: string, topicType: "needed" | "optional") => {
    if (!topicPicker) return;
    const { ideaId, researchId } = topicPicker;
    setTopicPicker(null);
    try {
      await fetch(`/api/ideas/${ideaId}/research-topic-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId, topic, topicType }),
      });
      flash(`"${topic}" konusuna eşlendi ✓`, 'ok');
      onRelationChange?.();
    } catch {
      flash('Konu eşleştirilemedi', 'err');
    }
  };

  const deleteEdge = async (edge: Edge) => {
    if (edge.isProjectLink) return; // Project links are not deletable
    const [ideaId,researchId] = edge.sourceType==='idea'?[edge.sourceId,edge.targetId]:[edge.targetId,edge.sourceId];
    const idea=allIdeas.find(i=>i.id===ideaId); if(!idea) return;
    const newResearchIds=(idea.researchIds??[]).filter(id=>id!==researchId);
    const resp=await fetch(`/api/ideas/${ideaId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchIds:newResearchIds})});
    if(resp.ok){setEdges(prev=>prev.filter(ex=>ex!==edge));setHoveredEdgeIdx(null);setDeleteBtn(null);flash('Bağlantı silindi','ok');onRelationChange?.();}
    else flash('Silinemedi','err');
  };

  const flash=(text:string,type:'ok'|'err'|'info')=>{setFlashMsg({text,type});setTimeout(()=>setFlashMsg(null),3000);};
  const zoomIn  =()=>setZoom(z=>Math.min(2.5,+(z+0.2).toFixed(2)));
  const zoomOut =()=>setZoom(z=>Math.max(0.2,+(z-0.2).toFixed(2)));
  const fitView =()=>{setPan({x:0,y:0});setZoom(1);};

  // Minimap
  const MM_W=170,MM_H=100;
  const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
  const minX=(xs.length?Math.min(...xs):0)-40,minY=(ys.length?Math.min(...ys):0)-40;
  const maxX=(xs.length?Math.max(...xs.map(x=>x+NODE_W)):100)+40,maxY=(ys.length?Math.max(...ys.map(y=>y+NODE_H)):100)+40;
  const mmSX=MM_W/(maxX-minX||1),mmSY=MM_H/(maxY-minY||1);

  const dr=drawing.current;
  const PORT_SIDES:PortSide[]=['top','bottom','left','right'];

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden"
      style={{ background:'radial-gradient(ellipse 120% 80% at 50% 0%, #0a0e2e 0%, #04050f 55%, #000008 100%)', cursor:panDrag.current?'grabbing':'default', userSelect:'none', touchAction:'none' }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Star field ──────────────────────────── */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, width:1, height:1, boxShadow: starField, willChange:'transform', transform:`translate(${pan.x%2400}px,${pan.y%1400}px)` }} />
        {/* Nebula glow 1 – indigo top-left */}
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'55%', height:'55%', background:'radial-gradient(ellipse at 40% 40%, rgba(79,70,229,0.13) 0%, transparent 70%)', pointerEvents:'none' }} />
        {/* Nebula glow 2 – cyan bottom-right */}
        <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:'50%', height:'50%', background:'radial-gradient(ellipse at 60% 60%, rgba(6,182,212,0.09) 0%, transparent 70%)', pointerEvents:'none' }} />
        {/* Nebula glow 3 – violet center */}
        <div style={{ position:'absolute', top:'30%', left:'35%', width:'40%', height:'40%', background:'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.07) 0%, transparent 65%)', pointerEvents:'none' }} />
        {/* Grid overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(99,102,241,0.18) 1px, transparent 1px)', backgroundSize:'28px 28px', backgroundPosition:`${pan.x%28}px ${pan.y%28}px`, pointerEvents:'none' }} />
        {/* Vignette */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(0,0,8,0.7) 100%)', pointerEvents:'none' }} />
      </div>
      {/* ── Top bar ─────────────────────────────── */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-slate-300 transition-all hover:text-white" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.3)', backdropFilter:'blur(8px)' }}>
          <ArrowLeft size={14}/> Listeye Dön
        </button>
        <span className="text-xs text-slate-400 px-2.5 py-1 rounded-full font-mono" style={{ background:'rgba(10,16,34,0.8)', border:'1px solid rgba(99,102,241,0.2)' }}>
          {globalMode?'Genel Harita · ':''}{nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {flashMsg&&(
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${flashMsg.type==='ok'?'border-emerald-500/30 text-emerald-400':flashMsg.type==='err'?'border-red-500/30 text-red-400':'border-indigo-500/30 text-indigo-400'}`} style={{ background:'rgba(10,16,34,0.9)' }}>
            {flashMsg.text}
          </span>
        )}
      </div>

      {/* Global legend */}
      {globalMode&&(
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 rounded-full px-4 py-2 pointer-events-none" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.2)', backdropFilter:'blur(8px)' }}>
          <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium font-mono"><span className="w-2 h-2 rounded-sm inline-block" style={{ background:'rgba(99,102,241,0.3)', border:'1px solid #818cf8' }}/>Araştırma</span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium font-mono"><span className="w-2 h-2 rounded-sm inline-block" style={{ background:'rgba(251,191,36,0.3)', border:'1px solid #fbbf24' }}/>Fikir</span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5 text-xs text-violet-400 font-medium font-mono"><span className="w-2 h-2 rounded-sm inline-block" style={{ background:'rgba(167,139,250,0.3)', border:'1px solid #a78bfa' }}/>Proje</span>
        </div>
      )}

      {!!dr&&!validation&&(
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 text-xs text-indigo-300 px-3 py-1.5 rounded-full font-medium font-mono pointer-events-none" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.3)', backdropFilter:'blur(8px)' }}>
          Başka bir düğümün portuna sürükleyin
        </div>
      )}

      {/* ── HTML Delete button (screen-space, reliable) ─────────────── */}
      {deleteBtn !== null && hoveredEdgeIdx !== null && edges[deleteBtn.edgeIdx] && (
        <button
          className="absolute z-40 w-7 h-7 rounded-full text-red-400 text-base font-bold hover:text-red-300 transition-colors flex items-center justify-center"
          style={{ background:'rgba(10,16,34,0.95)', border:'1px solid rgba(239,68,68,0.4)', backdropFilter:'blur(8px)', boxShadow:'0 4px 12px rgba(0,0,0,0.5)', left: deleteBtn.x - 14, top: deleteBtn.y - 14, pointerEvents: 'auto' }}
          onPointerEnter={() => setHoveredEdgeIdx(deleteBtn.edgeIdx)}
          onPointerLeave={() => { setHoveredEdgeIdx(null); setDeleteBtn(null); }}
          onClick={() => deleteEdge(edges[deleteBtn.edgeIdx])}
          title="Bağlantıyı Sil"
        >
          ×
        </button>
      )}

      {/* ── Zoom controls ───────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
        <button onClick={zoomIn}  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-all" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.25)' }}><ZoomIn  size={14}/></button>
        <button onClick={zoomOut} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-all" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.25)' }}><ZoomOut size={14}/></button>
        <button onClick={fitView} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-all" style={{ background:'rgba(10,16,34,0.9)', border:'1px solid rgba(99,102,241,0.25)' }}><Maximize2 size={13}/></button>
        <div className="text-center text-[11px] text-indigo-400/70 font-mono mt-0.5">{Math.round(zoom*100)}%</div>
      </div>

      {/* ── AI Validation popup ─────────────────────────────────────── */}
      {validation&&(
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 rounded-2xl p-5 w-80" style={{ background:'rgba(8,12,28,0.97)', border:'1px solid rgba(99,102,241,0.3)', backdropFilter:'blur(20px)', boxShadow:'0 24px 60px rgba(0,0,0,0.8)' }}>
          {validation.status==='loading'?(
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 size={28} className="text-indigo-400 animate-spin"/>
              <p className="text-sm font-semibold text-slate-200">AI Değerlendiriyor...</p>
              <p className="text-xs text-slate-500 text-center">Bağlantının anlamlı olup olmadığı kontrol ediliyor</p>
            </div>
          ):validation.status==='valid'?(
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle size={28} className="text-emerald-400"/>
              <p className="text-sm font-semibold text-slate-200">Bağlantı Uygun</p>
              <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
              <div className="w-full rounded-full h-1.5" style={{ background:'rgba(99,102,241,0.15)' }}><div className="bg-emerald-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`, boxShadow:'0 0 8px rgba(52,211,153,0.5)'}}/></div>
              <p className="text-[10px] text-slate-500 font-mono">Güven: %{validation.confidence}</p>
              <p className="text-xs text-emerald-400 font-medium">Kaydediliyor...</p>
            </div>
          ):(
            <div className="flex flex-col items-center gap-3 py-2">
              <AlertTriangle size={28} className="text-amber-400"/>
              <p className="text-sm font-semibold text-slate-200">Bağlantı Önerilmiyor</p>
              <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
              <div className="w-full rounded-full h-1.5" style={{ background:'rgba(99,102,241,0.15)' }}><div className="bg-amber-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/></div>
              <p className="text-[10px] text-slate-500 font-mono">Güven: %{validation.confidence}</p>
              <div className="flex gap-2 mt-1 w-full">
                <button onClick={()=>setValidation(null)} className="flex-1 py-1.5 text-xs font-medium text-slate-400 rounded-lg hover:text-slate-300 transition-colors" style={{ border:'1px solid rgba(99,102,241,0.2)' }}>İptal</button>
                <button onClick={()=>{const v=validation;setValidation(null);commitEdge(v.fromId,v.fromType,v.toId,v.toType);}} className="flex-1 py-1.5 text-xs font-medium text-amber-300 rounded-lg transition-colors hover:bg-amber-500/20" style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)' }}>Yine de Bağla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Topic Picker popup ─────────────────────────────────────────── */}
      {topicPicker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 rounded-2xl p-5 w-96" style={{ background:'rgba(8,12,28,0.97)', border:'1px solid rgba(99,102,241,0.3)', backdropFilter:'blur(20px)', boxShadow:'0 24px 60px rgba(0,0,0,0.8)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-indigo-400"/>
            <p className="text-sm font-semibold text-slate-200">Araştırma Konusu Eşleştir</p>
            <button onClick={()=>setTopicPicker(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors">×</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Bu araştırma hangi araştırma konusunu karşılıyor? (Opsiyonel)</p>
          {topicPicker.neededTopics.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 font-mono">Zorunlu Araştırma Konuları</p>
              <div className="flex flex-col gap-1">
                {topicPicker.neededTopics.map(topic => (
                  <button key={topic} onClick={()=>saveTopicMapping(topic,'needed')}
                    className="text-left text-xs px-3 py-2 rounded-lg text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-2"
                    style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)' }}>
                    <Tag size={10} className="shrink-0"/>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}
          {topicPicker.optionalTopics.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 font-mono">Opsiyonel Araştırma Konuları</p>
              <div className="flex flex-col gap-1">
                {topicPicker.optionalTopics.map(topic => (
                  <button key={topic} onClick={()=>saveTopicMapping(topic,'optional')}
                    className="text-left text-xs px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-2"
                    style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)' }}>
                    <Tag size={10} className="shrink-0"/>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={()=>setTopicPicker(null)} className="w-full py-2 text-xs text-slate-500 hover:text-slate-400 rounded-lg transition-colors mt-1" style={{ border:'1px solid rgba(99,102,241,0.15)' }}>
            Eşleştirme yapma
          </button>
        </div>
      )}

      {/* ── Transform layer ──────────────────────────────────────────── */}
      <div className="absolute inset-0"
        style={{ transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'50% 50%', pointerEvents:'none' }}>

        {/* Global column headers */}
        {globalMode&&(()=>{
          const cw=containerRef.current?.clientWidth??900,ch=containerRef.current?.clientHeight??600;
          const hasProjects=allIdeas.some(i=>!!(i as any).architecturalAnalysis);
          const colGap=Math.max(cw*0.36,300);
          const leftX  = hasProjects ? cw/2-colGap-NODE_W/2 : cw/2-colGap/2-NODE_W/2;
          const midX   = cw/2-NODE_W/2;
          const rightX = hasProjects ? cw/2+colGap-NODE_W/2 : cw/2+colGap/2-NODE_W/2;
          return (<>
            <div className="absolute pointer-events-none" style={{left:leftX,top:20,width:NODE_W}}><div className="text-center text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] font-mono" style={{ textShadow:'0 0 10px rgba(99,102,241,0.5)' }}>// Araştırmalar</div></div>
            <div className="absolute pointer-events-none" style={{left:hasProjects?midX:rightX,top:20,width:NODE_W}}><div className="text-center text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] font-mono" style={{ textShadow:'0 0 10px rgba(251,191,36,0.5)' }}>// Fikirler</div></div>
            {hasProjects&&<div className="absolute pointer-events-none" style={{left:rightX,top:20,width:NODE_W}}><div className="text-center text-[10px] font-bold text-violet-400 uppercase tracking-[0.2em] font-mono" style={{ textShadow:'0 0 10px rgba(167,139,250,0.5)' }}>// Projeler</div></div>}
          </>);
        })()}

        {/* SVG: edges + live edge + ports */}
        <svg className="absolute inset-0 overflow-visible" style={{width:'100%',height:'100%',pointerEvents:'none'}}>
          <defs>
            <marker id="arrowIndigo" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#6366f1" opacity="0.8"/>
            </marker>
            <marker id="arrowIndigoBright" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#818cf8"/>
            </marker>
            <marker id="arrowViolet" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#a78bfa" opacity="0.9"/>
            </marker>
          </defs>
          {/* Edges */}
          {edges.map((edge,i)=>{
            const src=nodes.find(n=>n.id===edge.sourceId&&n.type===edge.sourceType);
            const tgt=nodes.find(n=>n.id===edge.targetId&&n.type===edge.targetType);
            if(!src||!tgt) return null;
            const {s,t,v}=getBestPorts(src,tgt);
            const path=epPath(s.x,s.y,t.x,t.y,v);
            const hov=hoveredEdgeIdx===i;

            // Project link edge — violet animated style
            if (edge.isProjectLink) {
              const mx=(s.x+t.x)/2, my=(s.y+t.y)/2;
              return (
                <g key={i} data-edge="true"
                  onPointerEnter={()=>setHoveredEdgeIdx(i)}
                  onPointerLeave={()=>setHoveredEdgeIdx(null)}
                  style={{pointerEvents:'all'}}
                >
                  <path d={path} fill="none" stroke="transparent" strokeWidth={20} style={{cursor:'pointer'}}/>
                  {/* Glow layer */}
                  <path d={path} fill="none" stroke={hov?'#7c3aed':'#a78bfa'} strokeWidth={hov?6:4} strokeLinecap="round" opacity={0.12} style={{pointerEvents:'none'}}/>
                  {/* Animated dashes */}
                  <path d={path} fill="none"
                    stroke={hov?'#a78bfa':'#7c3aed'}
                    strokeWidth={hov?2.5:2} strokeDasharray="6 4" strokeLinecap="round"
                    markerEnd="url(#arrowViolet)"
                    style={{pointerEvents:'none',transition:'stroke 0.15s'}}>
                    <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite"/>
                  </path>
                  <circle cx={s.x} cy={s.y} r={3.5} fill={hov?'#a78bfa':'#7c3aed'} style={{pointerEvents:'none'}}/>
                  {/* "Proje" label badge always visible */}
                  <g style={{pointerEvents:'none'}}>
                    <rect x={mx-24} y={my-10} width={48} height={18} rx={9} fill="rgba(124,58,237,0.3)" stroke="#a78bfa" strokeWidth={0.8}/>
                    <text x={mx} y={my+3.5} textAnchor="middle" fontSize={8.5} fill="#c4b5fd" fontWeight="700" letterSpacing="0.5">Proje</text>
                  </g>
                </g>
              );
            }

            const edgeColor = hov ? '#818cf8' : edge.manual ? '#6366f1' : '#4f46e5';
            const glowColor = hov ? 'rgba(129,140,248,0.2)' : edge.manual ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.1)';

            return (
              <g key={i} data-edge="true"
                onPointerEnter={()=>setHoveredEdgeIdx(i)}
                onPointerLeave={()=>setHoveredEdgeIdx(null)}
                style={{pointerEvents:'all'}}
              >
                {/* Wide transparent hit area */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={20} style={{cursor:'pointer'}}/>
                {/* Glow layer */}
                <path d={path} fill="none" stroke={edgeColor} strokeWidth={hov?8:5} strokeLinecap="round" opacity={hov?0.15:0.08} style={{pointerEvents:'none'}}/>
                {/* Animated dashes */}
                <path d={path} fill="none"
                  stroke={edgeColor}
                  strokeWidth={hov?2.5:1.5} strokeDasharray="8 5" strokeLinecap="round"
                  markerEnd={hov?'url(#arrowIndigoBright)':'url(#arrowIndigo)'}
                  style={{pointerEvents:'none',transition:'stroke 0.15s,stroke-width 0.15s'}}>
                  <animate attributeName="stroke-dashoffset" from="0" to="-26" dur={edge.manual?'1.2s':'2s'} repeatCount="indefinite"/>
                </path>
                <circle cx={s.x} cy={s.y} r={3} fill={edgeColor} opacity={hov?0.9:0.5} style={{pointerEvents:'none'}}/>
              {edge.topicMapping && hov && (()=>{
                const mx=(s.x+t.x)/2, my=(s.y+t.y)/2;
                const isNeeded = edge.topicMapping.topicType === 'needed';
                return (
                  <g style={{pointerEvents:'none'}}>
                    <rect x={mx-62} y={my-13} width={124} height={22} rx={6} fill={isNeeded?'rgba(99,102,241,0.25)':'rgba(251,191,36,0.2)'} stroke={isNeeded?'#818cf8':'#fbbf24'} strokeWidth={0.8}/>
                    <text x={mx} y={my+3.5} textAnchor="middle" fontSize={9} fill={isNeeded?'#c7d2fe':'#fde68a'} fontWeight="600">
                      {edge.topicMapping.topic.length > 18 ? edge.topicMapping.topic.slice(0,15)+'…' : edge.topicMapping.topic}
                    </text>
                  </g>
                );
              })()}
              </g>
            );
          })}

          {/* Live drawing edge */}
          {dr&&(()=>{
            const fp=getPort(dr.srcNode,dr.portSide);
            return (<g>
              <path d={livePath(fp.x,fp.y,dr.toX,dr.toY)} fill="none" stroke="#818cf8" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" opacity={0.85}>
                <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite"/>
              </path>
              <circle cx={fp.x} cy={fp.y} r={4} fill="#818cf8"/>
              <circle cx={dr.toX} cy={dr.toY} r={3.5} fill="#6366f1" opacity={0.6}/>
            </g>);
          })()}

          {/* Port circles — not on project nodes */}
          {nodes.filter(n=>n.type!=='project').map(node=>{
            const nk=nodeKey(node.id,node.type);
            const isTarget=hoverTarget===nk&&!!dr;
            return PORT_SIDES.map(side=>{
              const {x,y}=getPort(node,side);
              return (
                <circle key={`p-${nk}-${side}`} cx={x} cy={y} r={PORT_R}
                  fill={isTarget?'rgba(99,102,241,0.4)':'rgba(10,16,34,0.8)'} stroke={isTarget?'#818cf8':'rgba(99,102,241,0.4)'} strokeWidth={isTarget?2.5:1.5}
                  style={{pointerEvents:'all',cursor:'crosshair'}} data-port="true"
                  onPointerDown={e=>onPortPointerDown(e as unknown as React.PointerEvent<SVGElement>,node,side)}
                  onPointerEnter={()=>!!dr&&setHoverTarget(nk)}
                  onPointerLeave={()=>setHoverTarget(null)}
                />
              );
            });
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node=>{
          const nk=nodeKey(node.id,node.type);
          const isCenter=!globalMode&&node.id===selectedId&&node.type===selectedType;
          const isIdea=node.type==='idea';
          const isProject=node.type==='project';
          const isHoverTarget=hoverTarget===nk&&!!dr;

          // ── Project node ──────────────────────────────────────────
          if (isProject) {
            return (
              <div key={nk} data-node="true"
                onPointerDown={e=>onNodePointerDown(e,node)}
                className="absolute rounded-2xl transition-[border-color,box-shadow]"
                style={{
                  left:node.x,top:node.y,width:NODE_W,
                  pointerEvents:'auto',cursor:'grab',touchAction:'none',
                  background:'rgba(12,8,30,0.95)',
                  border: isHoverTarget ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(139,92,246,0.35)',
                  boxShadow: isHoverTarget ? '0 0 24px rgba(167,139,250,0.25), 0 8px 32px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.4)',
                  backdropFilter:'blur(12px)',
                }}
              >
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-t-2xl" style={{ background:'linear-gradient(90deg,rgba(124,58,237,0.4),rgba(139,92,246,0.2))', borderBottom:'1px solid rgba(139,92,246,0.25)' }}>
                  <LayoutTemplate size={11} className="text-violet-300 shrink-0"/>
                  <span className="text-[9px] font-bold tracking-widest uppercase text-violet-300 font-mono">Proje Kartı</span>
                  <button
                    data-detail="true"
                    onPointerDown={e=>e.stopPropagation()}
                    onClick={e=>{e.stopPropagation(); if(node.parentIdeaId && onOpenProject) onOpenProject(node.parentIdeaId);}}
                    className="ml-auto p-0.5 rounded hover:bg-white/10 text-violet-400 hover:text-violet-200 transition-colors"
                    style={{pointerEvents:'auto'}}
                  >
                    <ExternalLink size={11}/>
                  </button>
                </div>
                <div className="px-3 pt-2.5 pb-3">
                  <h4 className="font-semibold text-slate-200 text-[13px] mb-1.5 line-clamp-2 leading-snug">{node.title.replace(' — Proje','')}</h4>
                  <p className="text-[11px] text-violet-400/70 line-clamp-2 leading-relaxed">Mimari analiz & akış şeması</p>
                  <button
                    data-detail="true"
                    onPointerDown={e=>e.stopPropagation()}
                    onClick={e=>{e.stopPropagation(); if(node.parentIdeaId && onOpenProject) onOpenProject(node.parentIdeaId);}}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-violet-300 hover:text-violet-200 rounded-lg px-2 py-1.5 transition-colors"
                    style={{background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', pointerEvents:'auto'}}
                  >
                    <LayoutTemplate size={10}/>
                    Projeyi Görüntüle
                  </button>
                </div>
              </div>
            );
          }

          // ── Research / Idea node ──────────────────────────────────
          const nodeAccentColor = isIdea ? 'rgba(251,191,36,0.3)' : 'rgba(99,102,241,0.3)';
          const nodeBorderColor = isCenter
            ? (isIdea ? 'rgba(251,191,36,0.7)' : 'rgba(99,102,241,0.7)')
            : isHoverTarget
              ? (isIdea ? 'rgba(251,191,36,0.6)' : 'rgba(99,102,241,0.6)')
              : (isIdea ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.2)');
          const nodeGlow = isCenter || isHoverTarget
            ? `0 0 20px ${isIdea?'rgba(251,191,36,0.15)':'rgba(99,102,241,0.2)'}, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 4px 20px rgba(0,0,0,0.4)';

          return (
            <div key={nk} data-node="true"
              onPointerDown={e=>onNodePointerDown(e,node)}
              onPointerEnter={()=>!!dr&&setHoverTarget(nk)}
              onPointerLeave={()=>setHoverTarget(null)}
              className="absolute rounded-2xl transition-[border-color,box-shadow]"
              style={{
                left:node.x,top:node.y,width:NODE_W,
                pointerEvents:'auto',cursor:'grab',touchAction:'none',
                background:'rgba(10,16,34,0.92)',
                border:`1px solid ${nodeBorderColor}`,
                boxShadow:nodeGlow,
                backdropFilter:'blur(12px)',
              }}
            >
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-t-2xl" style={{ background: isIdea ? 'rgba(251,191,36,0.07)' : 'rgba(99,102,241,0.07)', borderBottom: `1px solid ${isIdea?'rgba(251,191,36,0.12)':'rgba(99,102,241,0.12)'}` }}>
                <span className={`text-[9px] font-bold tracking-widest uppercase font-mono ${isIdea?'text-amber-400':'text-indigo-400'}`}>{isIdea?'Fikir':'Araştırma'}</span>
                {isCenter&&<span className="ml-1 text-[9px] text-slate-500 font-mono">· seçili</span>}
                <button data-detail="true" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onNodeClick(node.id,node.type as 'research'|'idea');}} className={`ml-auto p-0.5 rounded transition-colors ${isIdea?'text-amber-500/60 hover:text-amber-300':'text-indigo-500/60 hover:text-indigo-300'}`} style={{pointerEvents:'auto'}}><ExternalLink size={11}/></button>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <h4 className="font-semibold text-slate-200 text-[13px] mb-1.5 line-clamp-2 leading-snug">{node.title}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{node.summary}</p>
                <div className="flex items-center gap-3 mt-2.5 pt-2 text-[11px] text-slate-600" style={{ borderTop:`1px solid ${isIdea?'rgba(251,191,36,0.08)':'rgba(99,102,241,0.08)'}` }}>
                  <span className="flex items-center gap-1"><ThumbsUp size={10} className={isIdea?'text-amber-500/70':'text-indigo-400/70'}/><span className="text-slate-500">{node.voteCount}</span></span>
                  <span className="flex items-center gap-1"><Users size={10} className="text-slate-600"/><span className="text-slate-500">{node.collaboratorCount}</span></span>
                  <span className={`ml-auto text-[10px] font-mono ${isIdea?'text-amber-500/30':'text-indigo-500/30'}`}>{isIdea?`#${node.id}`:`R${node.id}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Minimap ─────────────────────────────────────────────────── */}
      {nodes.length>0&&(
        <div className="absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden pointer-events-none" style={{width:MM_W,height:MM_H,background:'rgba(6,11,24,0.9)',border:'1px solid rgba(99,102,241,0.2)',backdropFilter:'blur(8px)'}}>
          <svg width={MM_W} height={MM_H}>
            {edges.map((edge,i)=>{
              const src=nodes.find(n=>n.id===edge.sourceId&&n.type===edge.sourceType);
              const tgt=nodes.find(n=>n.id===edge.targetId&&n.type===edge.targetType);
              if(!src||!tgt) return null;
              const {s,t}=getBestPorts(src,tgt);
              return <line key={i} x1={(s.x-minX)*mmSX} y1={(s.y-minY)*mmSY} x2={(t.x-minX)*mmSX} y2={(t.y-minY)*mmSY} stroke={edge.isProjectLink?'#a78bfa':edge.manual?'#6366f1':'#4338ca'} strokeWidth={1} strokeDasharray="3 2" opacity={0.7}/>;
            })}
            {nodes.map(node=>{
              const nk=nodeKey(node.id,node.type);
              const isCenter=!globalMode&&node.id===selectedId&&node.type===selectedType;
              const isIdea=node.type==='idea';
              const isProject=node.type==='project';
              return <rect key={`mm-${nk}`} x={(node.x-minX)*mmSX} y={(node.y-minY)*mmSY} width={NODE_W*mmSX} height={NODE_H*mmSY} rx={2} fill={isCenter?'rgba(99,102,241,0.3)':isProject?'rgba(139,92,246,0.2)':isIdea?'rgba(251,191,36,0.15)':'rgba(99,102,241,0.15)'} stroke={isCenter?'#818cf8':isProject?'#a78bfa':isIdea?'#fbbf24':'#6366f1'} strokeWidth={isCenter?1.5:0.8}/>;
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-indigo-500/50 font-mono tracking-wider">MINI MAP</div>
        </div>
      )}
    </div>
  );
}
