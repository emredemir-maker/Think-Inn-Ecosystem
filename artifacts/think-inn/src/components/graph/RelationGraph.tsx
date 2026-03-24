import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, ThumbsUp, Users, ZoomIn, ZoomOut, Maximize2, ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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
  allIdeas: Idea[];
  onBack: () => void;
  onNodeClick: (id: number, type: 'research' | 'idea') => void;
  onRelationChange?: () => void;
}

export function RelationGraph({
  selectedId, selectedType, globalMode = false,
  allResearch, allIdeas, onBack, onNodeClick, onRelationChange,
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

  const drawing = useRef<{ srcNode: NodeData; portSide: PortSide; toX: number; toY: number } | null>(null);
  const [drawTick, setDrawTick] = useState(0);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const panDrag = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current  = pan;  }, [pan]);

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
      const colGap = Math.max(cw * 0.5, 400);
      const leftX  = cw/2 - colGap/2 - NODE_W/2;
      const rightX = cw/2 + colGap/2 - NODE_W/2;
      const vR = Math.max(180, Math.min(220, (ch-120) / Math.max(allResearch.length,1)));
      const vI = Math.max(180, Math.min(220, (ch-120) / Math.max(allIdeas.length,1)));
      allResearch.forEach((r,i) => newNodes.push({ id:r.id, type:'research', title:r.title, summary:r.summary??'', voteCount:r.voteCount, collaboratorCount:1, x:leftX, y:ch/2-vR*(allResearch.length-1)/2+i*vR }));
      allIdeas.forEach((idea,i) => {
        newNodes.push({ id:idea.id, type:'idea', title:idea.title, summary:idea.description??'', voteCount:idea.voteCount, collaboratorCount:idea.collaborators?.length??0, x:rightX, y:ch/2-vI*(allIdeas.length-1)/2+i*vI });
        (idea.researchIds??[]).forEach(rid => { if (allResearch.find(r=>r.id===rid)) newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:rid, targetType:'research' }); });
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
        connected.forEach(({item})=>newEdges.push({sourceId:selectedId,sourceType:'idea',targetId:item.id,targetType:'research'}));
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
    const idea=allIdeas.find(i=>i.id===ideaId); if(!idea) return;
    const newResearchIds=Array.from(new Set([...(idea.researchIds??[]),researchId]));
    const resp=await fetch(`/api/ideas/${ideaId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchIds:newResearchIds})});
    if(resp.ok){setEdges(prev=>[...prev,{sourceId:fromId,sourceType:fromType,targetId:toId,targetType:toType,manual:true}]);flash('Bağlantı kaydedildi ✓','ok');onRelationChange?.();}
    else flash('Kaydedilemedi','err');
  };

  const deleteEdge = async (edge: Edge) => {
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
      style={{ backgroundImage:'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)', backgroundSize:'28px 28px', backgroundPosition:`${pan.x%28}px ${pan.y%28}px`, backgroundColor:'#f8fafc', cursor:panDrag.current?'grabbing':'default', userSelect:'none', touchAction:'none' }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onWheel={onCanvasWheel}
    >
      {/* ── Top bar ─────────────────────────────── */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md text-sm font-medium text-gray-700 transition-all">
          <ArrowLeft size={14}/> Listeye Dön
        </button>
        <span className="text-xs text-gray-400 bg-white/90 px-2.5 py-1 rounded-full border border-gray-100">
          {globalMode?'Genel Harita · ':''}{nodes.length} düğüm · {edges.length} bağlantı
        </span>
        {flashMsg&&(
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${flashMsg.type==='ok'?'bg-green-50 border-green-200 text-green-700':flashMsg.type==='err'?'bg-red-50 border-red-200 text-red-700':'bg-blue-50 border-blue-200 text-blue-700'}`}>
            {flashMsg.text}
          </span>
        )}
      </div>

      {/* Global legend */}
      {globalMode&&(
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm pointer-events-none">
          <span className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-400 inline-block"/>Araştırma</span>
          <span className="text-gray-200">|</span>
          <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-400 inline-block"/>Fikir</span>
        </div>
      )}

      {!!dr&&!validation&&(
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full font-medium pointer-events-none">
          Başka bir düğümün portuna sürükleyin
        </div>
      )}

      {/* ── HTML Delete button (screen-space, reliable) ─────────────── */}
      {deleteBtn !== null && hoveredEdgeIdx !== null && edges[deleteBtn.edgeIdx] && (
        <button
          className="absolute z-40 w-7 h-7 rounded-full bg-white border-2 border-red-300 text-red-500 text-base font-bold hover:bg-red-50 hover:border-red-400 shadow-md transition-colors flex items-center justify-center"
          style={{ left: deleteBtn.x - 14, top: deleteBtn.y - 14, pointerEvents: 'auto' }}
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
        <button onClick={zoomIn}  className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomIn  size={14}/></button>
        <button onClick={zoomOut} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><ZoomOut size={14}/></button>
        <button onClick={fitView} className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow flex items-center justify-center text-gray-600 hover:text-indigo-600 transition-all"><Maximize2 size={13}/></button>
        <div className="text-center text-[11px] text-gray-400 font-medium mt-0.5">{Math.round(zoom*100)}%</div>
      </div>

      {/* ── AI Validation popup ─────────────────────────────────────── */}
      {validation&&(
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-5 w-80">
          {validation.status==='loading'?(
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 size={28} className="text-indigo-500 animate-spin"/>
              <p className="text-sm font-semibold text-gray-700">AI Değerlendiriyor...</p>
              <p className="text-xs text-gray-400 text-center">Bağlantının anlamlı olup olmadığı kontrol ediliyor</p>
            </div>
          ):validation.status==='valid'?(
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle size={28} className="text-green-500"/>
              <p className="text-sm font-semibold text-gray-700">Bağlantı Uygun</p>
              <p className="text-xs text-gray-500 text-center">{validation.reason}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/></div>
              <p className="text-[10px] text-gray-400">Güven: %{validation.confidence}</p>
              <p className="text-xs text-green-600 font-medium">Kaydediliyor...</p>
            </div>
          ):(
            <div className="flex flex-col items-center gap-3 py-2">
              <AlertTriangle size={28} className="text-amber-500"/>
              <p className="text-sm font-semibold text-gray-700">Bağlantı Önerilmiyor</p>
              <p className="text-xs text-gray-500 text-center">{validation.reason}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-amber-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/></div>
              <p className="text-[10px] text-gray-400">Güven: %{validation.confidence}</p>
              <div className="flex gap-2 mt-1 w-full">
                <button onClick={()=>setValidation(null)} className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">İptal</button>
                <button onClick={()=>{const v=validation;setValidation(null);commitEdge(v.fromId,v.fromType,v.toId,v.toType);}} className="flex-1 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">Yine de Bağla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Transform layer ──────────────────────────────────────────── */}
      <div className="absolute inset-0"
        style={{ transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin:'50% 50%', pointerEvents:'none' }}>

        {/* Global column headers */}
        {globalMode&&(()=>{
          const cw=containerRef.current?.clientWidth??900,ch=containerRef.current?.clientHeight??600;
          const colGap=Math.max(cw*0.5,400),leftX=cw/2-colGap/2-NODE_W/2,rightX=cw/2+colGap/2-NODE_W/2;
          return (<>
            <div className="absolute pointer-events-none" style={{left:leftX,top:20,width:NODE_W}}><div className="text-center text-xs font-bold text-indigo-500 uppercase tracking-widest">📄 Araştırmalar</div></div>
            <div className="absolute pointer-events-none" style={{left:rightX,top:20,width:NODE_W}}><div className="text-center text-xs font-bold text-amber-500 uppercase tracking-widest">💡 Fikirler</div></div>
          </>);
        })()}

        {/* SVG: edges + live edge + ports */}
        <svg className="absolute inset-0 overflow-visible" style={{width:'100%',height:'100%',pointerEvents:'none'}}>
          {/* Edges */}
          {edges.map((edge,i)=>{
            const src=nodes.find(n=>n.id===edge.sourceId&&n.type===edge.sourceType);
            const tgt=nodes.find(n=>n.id===edge.targetId&&n.type===edge.targetType);
            if(!src||!tgt) return null;
            const {s,t,v}=getBestPorts(src,tgt);
            const path=epPath(s.x,s.y,t.x,t.y,v);
            const hov=hoveredEdgeIdx===i;
            return (
              <g key={i} data-edge="true"
                onPointerEnter={()=>setHoveredEdgeIdx(i)}
                onPointerLeave={()=>setHoveredEdgeIdx(null)}
                style={{pointerEvents:'all'}}
              >
                {/* Wide transparent hit area */}
                <path d={path} fill="none" stroke="transparent" strokeWidth={20} style={{cursor:'pointer'}}/>
                {/* Visible edge */}
                <path d={path} fill="none"
                  stroke={hov?'#6366f1':edge.manual?'#818cf8':'#c7d2fe'}
                  strokeWidth={hov?2.5:1.5} strokeDasharray="7 4" strokeLinecap="round"
                  style={{pointerEvents:'none',transition:'stroke 0.12s'}}/>
                <circle cx={s.x} cy={s.y} r={3.5} fill={hov?'#6366f1':'#c7d2fe'} style={{pointerEvents:'none'}}/>
                <circle cx={t.x} cy={t.y} r={3.5} fill={hov?'#6366f1':'#c7d2fe'} style={{pointerEvents:'none'}}/>
              </g>
            );
          })}

          {/* Live drawing edge */}
          {dr&&(()=>{
            const fp=getPort(dr.srcNode,dr.portSide);
            return (<g>
              <path d={livePath(fp.x,fp.y,dr.toX,dr.toY)} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" opacity={0.85}/>
              <circle cx={fp.x} cy={fp.y} r={4} fill="#6366f1"/>
              <circle cx={dr.toX} cy={dr.toY} r={3.5} fill="#6366f1" opacity={0.5}/>
            </g>);
          })()}

          {/* Port circles */}
          {nodes.map(node=>{
            const nk=nodeKey(node.id,node.type);
            const isTarget=hoverTarget===nk&&!!dr;
            return PORT_SIDES.map(side=>{
              const {x,y}=getPort(node,side);
              return (
                <circle key={`p-${nk}-${side}`} cx={x} cy={y} r={PORT_R}
                  fill="white" stroke={isTarget?'#6366f1':'#a5b4fc'} strokeWidth={isTarget?2.5:1.5}
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
          const isHoverTarget=hoverTarget===nk&&!!dr;
          return (
            <div key={nk} data-node="true"
              onPointerDown={e=>onNodePointerDown(e,node)}
              onPointerEnter={()=>!!dr&&setHoverTarget(nk)}
              onPointerLeave={()=>setHoverTarget(null)}
              className={`absolute rounded-2xl border bg-white transition-shadow ${isCenter?'border-indigo-400 ring-2 ring-indigo-200 shadow-lg':isHoverTarget?'border-indigo-400 ring-2 ring-indigo-100 shadow-xl':'border-gray-200 shadow-md hover:shadow-lg'}`}
              style={{left:node.x,top:node.y,width:NODE_W,pointerEvents:'auto',cursor:'grab',touchAction:'none'}}
            >
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-t-2xl border-b ${isIdea?'bg-amber-50 border-amber-100':'bg-indigo-50 border-indigo-100'}`}>
                <span className={`text-[10px] font-bold tracking-widest uppercase ${isIdea?'text-amber-600':'text-indigo-600'}`}>{isIdea?'💡 Fikir':'📄 Araştırma'}</span>
                {isCenter&&<span className="ml-1 text-[9px] text-gray-400">Seçili</span>}
                <button data-detail="true" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onNodeClick(node.id,node.type);}} className="ml-auto p-0.5 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors" style={{pointerEvents:'auto'}}><ExternalLink size={11}/></button>
              </div>
              <div className="px-3 pt-2.5 pb-3">
                <h4 className="font-semibold text-gray-900 text-[13px] mb-1.5 line-clamp-2 leading-snug">{node.title}</h4>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{node.summary}</p>
                <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><ThumbsUp size={10} className={isIdea?'text-amber-500':'text-indigo-400'}/>{node.voteCount}</span>
                  <span className="flex items-center gap-1"><Users size={10}/>{node.collaboratorCount}</span>
                  <span className="ml-auto text-[10px] text-gray-300 font-mono">{isIdea?`#${node.id}`:`R${node.id}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Minimap ─────────────────────────────────────────────────── */}
      {nodes.length>0&&(
        <div className="absolute bottom-4 right-4 z-30 bg-white/95 border border-gray-200 rounded-xl shadow-sm overflow-hidden pointer-events-none" style={{width:MM_W,height:MM_H}}>
          <svg width={MM_W} height={MM_H}>
            {edges.map((edge,i)=>{
              const src=nodes.find(n=>n.id===edge.sourceId&&n.type===edge.sourceType);
              const tgt=nodes.find(n=>n.id===edge.targetId&&n.type===edge.targetType);
              if(!src||!tgt) return null;
              const {s,t}=getBestPorts(src,tgt);
              return <line key={i} x1={(s.x-minX)*mmSX} y1={(s.y-minY)*mmSY} x2={(t.x-minX)*mmSX} y2={(t.y-minY)*mmSY} stroke={edge.manual?'#818cf8':'#c7d2fe'} strokeWidth={1} strokeDasharray="3 2"/>;
            })}
            {nodes.map(node=>{
              const nk=nodeKey(node.id,node.type);
              const isCenter=!globalMode&&node.id===selectedId&&node.type===selectedType;
              const isIdea=node.type==='idea';
              return <rect key={`mm-${nk}`} x={(node.x-minX)*mmSX} y={(node.y-minY)*mmSY} width={NODE_W*mmSX} height={NODE_H*mmSY} rx={2} fill={isCenter?'#eef2ff':isIdea?'#fffbeb':'#f5f3ff'} stroke={isCenter?'#6366f1':isIdea?'#f59e0b':'#818cf8'} strokeWidth={isCenter?1.5:1}/>;
            })}
          </svg>
          <div className="absolute bottom-1 left-2 text-[9px] text-gray-300 font-medium">Mini Harita</div>
        </div>
      )}
    </div>
  );
}
