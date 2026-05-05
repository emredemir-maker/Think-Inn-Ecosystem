import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface NodeData {
  id: number;
  type: 'research' | 'idea' | 'project';
  title: string;
  summary: string;
  voteCount: number;
  collaboratorCount: number;
  x: number; y: number; z: number;
  parentIdeaId?: number;
}

interface ResearchTopicMapping {
  researchId: number; topic: string;
  topicType: 'needed' | 'optional'; autoLinked: boolean; confidence?: number;
}

type IdeaWithTopics = Idea & {
  neededResearchTopics?: string[];
  optionalResearchTopics?: string[];
  researchTopicMappings?: ResearchTopicMapping[];
};

interface Edge {
  sourceId: number; sourceType: string;
  targetId: number; targetType: string;
  manual?: boolean;
  topicMapping?: { topic: string; topicType: 'needed' | 'optional' };
  isProjectLink?: boolean;
}

interface ValidationState {
  fromId: number; fromType: string;
  toId: number; toType: string;
  status: 'loading' | 'valid' | 'invalid';
  confidence?: number; reason?: string;
}

interface ConnectMode { sourceId: number; sourceType: string; }

// ── Card accent colors per type ────────────────────────────────────────────
const TYPE_ACCENT: Record<string, string> = {
  research: '#6366f1',
  idea:     '#f59e0b',
  project:  '#8b5cf6',
};
const TYPE_LABEL: Record<string, string> = {
  research: 'Araştırma',
  idea:     'Fikir',
  project:  'Proje',
};

const nodeKey = (id: number, type: string) => `${type}-${id}`;

function jitter(id: number, range: number): number {
  return (((id * 2654435761) >>> 0) % 1000) / 1000 * range - range / 2;
}

function calcImportance(node: NodeData, edges: Edge[]): number {
  const conn = edges.filter(e =>
    (e.sourceId === node.id && e.sourceType === node.type) ||
    (e.targetId === node.id && e.targetType === node.type)
  ).length;
  return conn * 2.5 + Math.log1p(node.voteCount);
}

function fibSphere(n: number, r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y   = 1 - (i / Math.max(n - 1, 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const t   = phi * i;
    pts.push([r * rad * Math.cos(t), r * y, r * rad * Math.sin(t)]);
  }
  return pts;
}

// ── Single edge ─────────────────────────────────────────────────────────────
function Edge3D({ edge, nodes, hovered, onEnter, onLeave, onDelete }: {
  edge: Edge; nodes: NodeData[];
  hovered: boolean;
  onEnter: () => void; onLeave: () => void; onDelete: () => void;
}) {
  const src = nodes.find(n => n.id === edge.sourceId && n.type === edge.sourceType);
  const tgt = nodes.find(n => n.id === edge.targetId && n.type === edge.targetType);

  const sx = src?.x ?? 0, sy = src?.y ?? 0, sz = src?.z ?? 0;
  const tx = tgt?.x ?? 0, ty = tgt?.y ?? 0, tz = tgt?.z ?? 0;
  const p0  = useMemo((): [number,number,number] => [sx,sy,sz], [sx,sy,sz]);
  const p1  = useMemo((): [number,number,number] => [tx,ty,tz], [tx,ty,tz]);
  const mid = useMemo(() => [(sx+tx)/2,(sy+ty)/2,(sz+tz)/2] as [number,number,number], [sx,sy,sz,tx,ty,tz]);

  if (!src || !tgt) return null;

  const col = edge.isProjectLink ? '#8b5cf6'
    : edge.topicMapping?.topicType === 'needed' ? '#6366f1'
    : '#94a3b8';

  return (
    <group onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <Line
        points={[p0, p1]}
        color={col}
        lineWidth={hovered ? 2 : 1}
        transparent
        opacity={hovered ? 0.7 : edge.isProjectLink ? 0.45 : 0.3}
      />
      {hovered && !edge.isProjectLink && (
        <Html position={mid} center zIndexRange={[50, 0]}>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            onPointerEnter={onEnter} onPointerLeave={onLeave}
            style={{
              background: 'white',
              border: '1px solid #fca5a5',
              color: '#ef4444',
              borderRadius: '50%',
              width: 22, height: 22,
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >×</button>
        </Html>
      )}
    </group>
  );
}

// ── Node card ────────────────────────────────────────────────────────────────
function NodeCard({ node, edges, orbitRef, setNodes, connectMode, onClickNode, onBeginConnect, globalMode }: {
  node: NodeData; edges: Edge[];
  orbitRef: React.RefObject<any>;
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  connectMode: ConnectMode | null;
  onClickNode: () => void;
  onBeginConnect: () => void;
  globalMode: boolean;
}) {
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);

  const isCenter   = !globalMode && node.x === 0 && node.y === 0 && node.z === 0;
  const isConnSrc  = connectMode?.sourceId === node.id && connectMode?.sourceType === node.type;
  const isConnTgt  = !!(connectMode && connectMode.sourceId !== node.id && node.type !== 'project');
  const accent     = TYPE_ACCENT[node.type] ?? '#94a3b8';
  const importance = calcImportance(node, edges);

  // Card dimensions (world units, used for hit plane)
  const cardW = isCenter ? 4.8 : importance >= 4 ? 3.6 : 3.0;
  const cardH = isCenter ? 2.0 : 1.3;

  // Text truncation
  const maxTitleLen = isCenter ? 48 : 32;
  const title = node.title.length > maxTitleLen ? node.title.slice(0, maxTitleLen - 2) + '…' : node.title;
  const desc  = node.summary
    ? (node.summary.length > 65 ? node.summary.slice(0, 63) + '…' : node.summary)
    : null;

  // Pointer-drag logic
  const onPD = (e: any) => {
    e.stopPropagation();
    const hasMoved = { v: false };
    const plane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), -node.z);
    const raycaster = new THREE.Raycaster();
    const canvas   = gl.domElement;
    let initHit: { x: number; y: number } | null = null;

    if (orbitRef.current) orbitRef.current.enabled = false;

    const onMove = (ev: PointerEvent) => {
      const rect  = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        if (!initHit) initHit = { x: hit.x, y: hit.y };
        if (Math.hypot(hit.x - initHit.x, hit.y - initHit.y) > 0.08) hasMoved.v = true;
        if (hasMoved.v) {
          setNodes(prev => prev.map(n =>
            n.id === node.id && n.type === node.type ? { ...n, x: hit.x, y: hit.y } : n
          ));
        }
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (orbitRef.current) orbitRef.current.enabled = true;
      if (!hasMoved.v) onClickNode();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  // Card visual styles
  const cardBg      = isConnSrc ? `${accent}12` : 'rgba(255,255,255,0.97)';
  const borderColor = isConnSrc ? accent
    : isCenter ? accent
    : hovered ? `${accent}90`
    : '#d1d5db';
  const borderW     = isCenter || isConnSrc ? 2 : 1;
  const shadow      = hovered || isCenter
    ? `0 6px 24px rgba(0,0,0,0.13), 0 0 0 2px ${accent}30`
    : '0 2px 10px rgba(0,0,0,0.08)';

  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Invisible hit plane */}
      <mesh
        onPointerDown={onPD}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[cardW, cardH]}/>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/>
      </mesh>

      {/* Connect-target ring (glowing outline on the plane) */}
      {isConnTgt && (
        <mesh>
          <planeGeometry args={[cardW + 0.2, cardH + 0.2]}/>
          <meshBasicMaterial color={accent} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false}/>
        </mesh>
      )}

      {/* Visual card (Html overlay) */}
      <Html center distanceFactor={14} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: cardBg,
          border: `${borderW}px solid ${borderColor}`,
          borderRadius: isCenter ? 14 : 10,
          padding: isCenter ? '10px 14px 10px 17px' : '6px 10px 6px 14px',
          minWidth: isCenter ? 200 : 130,
          maxWidth: isCenter ? 250 : 190,
          boxShadow: shadow,
          fontFamily: '"Inter", system-ui, sans-serif',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
          {/* Left accent bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: isCenter ? 4 : 3,
            background: accent,
            borderRadius: '10px 0 0 10px',
          }}/>

          {/* Type badge */}
          <div style={{
            fontSize: 9,
            fontWeight: 600,
            color: accent,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginBottom: isCenter ? 4 : 2,
            lineHeight: 1,
          }}>
            {TYPE_LABEL[node.type] ?? node.type}
          </div>

          {/* Title */}
          <div style={{
            fontSize: isCenter ? 13 : 11,
            fontWeight: isCenter ? 700 : 600,
            color: '#0f172a',
            lineHeight: 1.35,
          }}>
            {title}
          </div>

          {/* Description — only for center node or if important */}
          {desc && (isCenter || importance >= 3) && (
            <div style={{
              fontSize: 9.5,
              color: '#64748b',
              marginTop: 3,
              lineHeight: 1.45,
            }}>
              {desc}
            </div>
          )}

          {/* Vote count pill */}
          {node.voteCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              marginTop: 5,
              background: `${accent}15`,
              border: `1px solid ${accent}30`,
              borderRadius: 100,
              padding: '1px 6px',
              fontSize: 9,
              fontWeight: 600,
              color: accent,
            }}>
              ★ {node.voteCount}
            </div>
          )}

          {/* Pulsing ring for connect target */}
          {isConnTgt && (
            <div style={{
              position: 'absolute', inset: -2,
              border: `2px dashed ${accent}`,
              borderRadius: 12,
              pointerEvents: 'none',
              animation: 'spin 2s linear infinite',
            }}/>
          )}
        </div>
      </Html>

      {/* Connect button — visible on hover */}
      {hovered && !connectMode && node.type !== 'project' && (
        <Html
          position={[cardW / 2 + 0.3, cardH / 2 - 0.05, 0]}
          center
          zIndexRange={[30, 0]}
        >
          <button
            onClick={e => { e.stopPropagation(); onBeginConnect(); }}
            title="Bağlantı oluştur"
            style={{
              background: 'white',
              border: `1.5px solid ${accent}`,
              color: accent,
              borderRadius: '50%',
              width: 22, height: 22,
              fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 2px 8px ${accent}40`,
            }}
          >+</button>
        </Html>
      )}
    </group>
  );
}

// ── Scene (inside Canvas) ────────────────────────────────────────────────────
function Scene({ nodes, edges, orbitRef, setNodes, connectMode, onClickNode, onBeginConnect,
  hoveredEdgeIdx, setHoveredEdgeIdx, onDeleteEdge, globalMode }: any) {
  return (
    <>
      <color attach="background" args={['#e8ecf0']}/>
      <ambientLight intensity={1.4}/>
      <directionalLight position={[5, 8, 6]} intensity={0.4} color="#ffffff"/>
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={40}
        rotateSpeed={0.6}
      />
      {edges.map((edge: Edge, i: number) => (
        <Edge3D
          key={`${edge.sourceId}-${edge.sourceType}-${edge.targetId}-${edge.targetType}`}
          edge={edge} nodes={nodes}
          hovered={hoveredEdgeIdx === i}
          onEnter={() => setHoveredEdgeIdx(i)}
          onLeave={() => setHoveredEdgeIdx(null)}
          onDelete={() => onDeleteEdge(edge)}
        />
      ))}
      {nodes.map((node: NodeData) => (
        <NodeCard
          key={nodeKey(node.id, node.type)}
          node={node} edges={edges}
          orbitRef={orbitRef}
          setNodes={setNodes}
          connectMode={connectMode}
          globalMode={globalMode}
          onClickNode={() => onClickNode(node)}
          onBeginConnect={() => onBeginConnect(node.id, node.type)}
        />
      ))}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
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
  const [nodes, setNodes]               = useState<NodeData[]>([]);
  const [edges, setEdges]               = useState<Edge[]>([]);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  const [flashMsg, setFlashMsg]         = useState<{ text: string; type: 'ok'|'err'|'info' } | null>(null);
  const [validation, setValidation]     = useState<ValidationState | null>(null);
  const [topicPicker, setTopicPicker]   = useState<{ ideaId: number; researchId: number; neededTopics: string[]; optionalTopics: string[] } | null>(null);
  const [connectMode, setConnectMode]   = useState<ConnectMode | null>(null);
  const orbitRef = useRef<any>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── Build graph ──────────────────────────────────────────────────────────
  const buildGraph = useCallback(() => {
    if (globalMode) {
      const newNodes: NodeData[] = [], newEdges: Edge[] = [];
      const projIdeas = allIdeas.filter(i => !!(i as any).architecturalAnalysis);
      const hasProj   = projIdeas.length > 0;
      const gap = 6.5;
      const lx  = hasProj ? -gap : -gap / 2;
      const mx  = 0;
      const rx  = hasProj ? gap : gap / 2;
      const spread = (n: number) => Math.min(5, n * 1.2);

      allResearch.forEach((r, i) => {
        const t = allResearch.length > 1 ? i / (allResearch.length - 1) : 0.5;
        newNodes.push({ id:r.id, type:'research', title:r.title, summary:r.summary??'',
          voteCount:r.voteCount, collaboratorCount:1,
          x: lx + jitter(r.id, 1.2), y: spread(allResearch.length) * (t*2-1), z: jitter(r.id*7, 2.5) });
      });
      allIdeas.forEach((idea, i) => {
        const t = allIdeas.length > 1 ? i / (allIdeas.length - 1) : 0.5;
        newNodes.push({ id:idea.id, type:'idea', title:idea.title, summary:idea.description??'',
          voteCount:idea.voteCount, collaboratorCount:idea.collaborators?.length??0,
          x: (hasProj?mx:rx) + jitter(idea.id, 1.2), y: spread(allIdeas.length) * (t*2-1), z: jitter(idea.id*11, 2.5) });
        (idea.researchIds??[]).forEach(rid => {
          if (allResearch.find(r=>r.id===rid)) {
            const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m=>m.researchId===rid);
            newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:rid, targetType:'research',
              topicMapping: tm ? { topic:tm.topic, topicType:tm.topicType } : undefined });
          }
        });
      });
      projIdeas.forEach((idea, i) => {
        const t = projIdeas.length > 1 ? i / (projIdeas.length - 1) : 0.5;
        newNodes.push({ id:idea.id, type:'project', title:`${idea.title} — Proje`, summary:'',
          voteCount:0, collaboratorCount:0,
          x: rx + jitter(idea.id, 1.2), y: spread(projIdeas.length) * (t*2-1), z: jitter(idea.id*13, 2.5),
          parentIdeaId:idea.id });
        newEdges.push({ sourceId:idea.id, sourceType:'idea', targetId:idea.id, targetType:'project', isProjectLink:true });
      });
      setNodes(newNodes); setEdges(newEdges);
    } else {
      if (selectedId===undefined||selectedType===undefined) return;
      const center = selectedType==='research'
        ? allResearch.find(r=>r.id===selectedId)
        : allIdeas.find(i=>i.id===selectedId);
      if (!center) return;
      const newNodes: NodeData[] = [{ id:center.id, type:selectedType, title:center.title,
        summary: selectedType==='research'?(center as Research).summary??'':(center as Idea).description??'',
        voteCount:center.voteCount, collaboratorCount:selectedType==='idea'?((center as Idea).collaborators?.length??0):1,
        x:0, y:0, z:0 }];
      const newEdges: Edge[] = [];
      let connected: {item:Research|Idea; type:'research'|'idea'}[] = [];
      if (selectedType==='research') {
        connected = allIdeas.filter(i=>i.researchIds?.includes(selectedId)).map(i=>({item:i,type:'idea' as const}));
        connected.forEach(({item})=>newEdges.push({sourceId:selectedId,sourceType:'research',targetId:item.id,targetType:'idea'}));
      } else {
        const idea = center as Idea;
        connected = allResearch.filter(r=>idea.researchIds?.includes(r.id)).map(r=>({item:r,type:'research' as const}));
        connected.forEach(({item})=>{
          const tm = (idea as IdeaWithTopics).researchTopicMappings?.find(m=>m.researchId===item.id);
          newEdges.push({sourceId:selectedId,sourceType:'idea',targetId:item.id,targetType:'research',
            topicMapping:tm?{topic:tm.topic,topicType:tm.topicType}:undefined});
        });
        if (!!(idea as any).architecturalAnalysis) {
          newNodes.push({id:idea.id,type:'project',title:`${idea.title} — Proje`,summary:'',
            voteCount:0,collaboratorCount:0,x:5,y:0,z:0,parentIdeaId:idea.id});
          newEdges.push({sourceId:idea.id,sourceType:'idea',targetId:idea.id,targetType:'project',isProjectLink:true});
        }
      }
      const pts = fibSphere(connected.length, 5);
      connected.forEach(({item,type},i)=>{
        const [px,py,pz] = pts[i] ?? [4,0,0];
        newNodes.push({id:item.id,type,title:item.title,
          summary:type==='research'?(item as Research).summary??'':(item as Idea).description??'',
          voteCount:item.voteCount,collaboratorCount:type==='idea'?((item as Idea).collaborators?.length??0):1,
          x:px,y:py,z:pz});
      });
      setNodes(newNodes); setEdges(newEdges);
    }
  }, [selectedId, selectedType, globalMode, allResearch, allIdeas]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // ESC cancels connect mode
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key==='Escape') setConnectMode(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ── Node click ───────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: NodeData) => {
    if (connectMode) {
      if (connectMode.sourceId !== node.id && node.type !== 'project') {
        startValidation(connectMode.sourceId, connectMode.sourceType, node.id, node.type);
      }
      setConnectMode(null);
    } else {
      if (node.type === 'project' && onOpenProject) onOpenProject(node.parentIdeaId!);
      else if (node.type !== 'project') onNodeClick(node.id, node.type as 'research'|'idea');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectMode, onOpenProject, onNodeClick]);

  // ── Edge / validation ────────────────────────────────────────────────────
  const startValidation = async (fromId: number, fromType: string, toId: number, toType: string) => {
    let ideaId: number|null = null, researchId: number|null = null;
    if (fromType==='idea'&&toType==='research')      {ideaId=fromId; researchId=toId;}
    else if (fromType==='research'&&toType==='idea') {ideaId=toId;   researchId=fromId;}
    else { flash('Yalnızca Araştırma ↔ Fikir bağlantısı kurulabilir.','err'); return; }
    setValidation({fromId,fromType,toId,toType,status:'loading'});
    try {
      const resp = await fetch('/api/validate-connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchId,ideaId})});
      const data = await resp.json() as {valid:boolean;confidence:number;reason:string};
      setValidation({fromId,fromType,toId,toType,status:data.valid?'valid':'invalid',confidence:data.confidence,reason:data.reason});
      if (data.valid) setTimeout(()=>{commitEdge(fromId,fromType,toId,toType);setValidation(null);},1200);
    } catch {setValidation(null); commitEdge(fromId,fromType,toId,toType);}
  };

  const commitEdge = async (fromId:number,fromType:string,toId:number,toType:string) => {
    const [ideaId,researchId] = fromType==='idea'?[fromId,toId]:[toId,fromId];
    const idea = allIdeas.find(i=>i.id===ideaId) as IdeaWithTopics|undefined; if (!idea) return;
    const newResearchIds = Array.from(new Set([...(idea.researchIds??[]),researchId]));
    const resp = await fetch(`/api/ideas/${ideaId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchIds:newResearchIds})});
    if (resp.ok) {
      setEdges(prev=>[...prev,{sourceId:fromId,sourceType:fromType,targetId:toId,targetType:toType,manual:true}]);
      flash('Bağlantı kaydedildi ✓','ok'); onRelationChange?.();
      const nt = idea.neededResearchTopics??[], ot = idea.optionalResearchTopics??[];
      if (nt.length>0||ot.length>0) setTopicPicker({ideaId,researchId,neededTopics:nt,optionalTopics:ot});
    } else flash('Kaydedilemedi','err');
  };

  const saveTopicMapping = async (topic:string,topicType:'needed'|'optional') => {
    if (!topicPicker) return;
    const {ideaId,researchId}=topicPicker; setTopicPicker(null);
    try {
      await fetch(`/api/ideas/${ideaId}/research-topic-mapping`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchId,topic,topicType})});
      flash(`"${topic}" konusuna eşlendi ✓`,'ok'); onRelationChange?.();
    } catch {flash('Konu eşleştirilemedi','err');}
  };

  const onDeleteEdge = async (edge:Edge) => {
    if (edge.isProjectLink) return;
    const [ideaId,researchId] = edge.sourceType==='idea'?[edge.sourceId,edge.targetId]:[edge.targetId,edge.sourceId];
    const idea = allIdeas.find(i=>i.id===ideaId); if (!idea) return;
    const newResearchIds = (idea.researchIds??[]).filter(id=>id!==researchId);
    const resp = await fetch(`/api/ideas/${ideaId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchIds:newResearchIds})});
    if (resp.ok) {setEdges(prev=>prev.filter(ex=>ex!==edge));setHoveredEdgeIdx(null);flash('Bağlantı silindi','ok');onRelationChange?.();}
    else flash('Silinemedi','err');
  };

  const flash = (text:string,type:'ok'|'err'|'info') => {
    setFlashMsg({text,type});
    setTimeout(()=>setFlashMsg(null),3000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0" style={{background:'#e8ecf0'}}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position:[0,0,18], fov:60 }}
        gl={{ antialias:true, alpha:false }}
        style={{ position:'absolute', inset:0 }}
        onPointerMissed={() => { if (connectMode) setConnectMode(null); }}
      >
        <Suspense fallback={null}>
          <Scene
            nodes={nodes} edges={edges}
            orbitRef={orbitRef}
            setNodes={setNodes}
            connectMode={connectMode}
            globalMode={globalMode}
            onClickNode={handleNodeClick}
            onBeginConnect={(id:number, type:string) => setConnectMode({sourceId:id,sourceType:type})}
            hoveredEdgeIdx={hoveredEdgeIdx}
            setHoveredEdgeIdx={setHoveredEdgeIdx}
            onDeleteEdge={onDeleteEdge}
          />
        </Suspense>
      </Canvas>

      {/* ── HTML UI overlay ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{zIndex:10}}>

        {/* Top-left bar */}
        <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background:'white',
              border:'1px solid #e2e8f0',
              color:'#475569',
              boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <ArrowLeft size={14}/> Listeye Dön
          </button>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-mono"
            style={{background:'white',border:'1px solid #e2e8f0',color:'#94a3b8',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}
          >
            {globalMode?'Genel · ':''}{nodes.length} düğüm · {edges.length} bağlantı
          </span>
          {flashMsg && (
            <span
              className={`text-xs px-3 py-1 rounded-full border font-medium ${
                flashMsg.type==='ok'?'border-emerald-200 text-emerald-700 bg-emerald-50':
                flashMsg.type==='err'?'border-red-200 text-red-700 bg-red-50':
                'border-indigo-200 text-indigo-700 bg-indigo-50'
              }`}
              style={{boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}
            >
              {flashMsg.text}
            </span>
          )}
        </div>

        {/* Legend */}
        {globalMode && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-4 py-2"
            style={{background:'white',border:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,0.07)',pointerEvents:'none'}}
          >
            {(['research','idea','project'] as const).map((t,i) => (
              <React.Fragment key={t}>
                {i>0 && <span className="text-slate-200">·</span>}
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{color:TYPE_ACCENT[t]}}>
                  <span className="w-2 h-2 rounded-sm inline-block" style={{background:TYPE_ACCENT[t]}}/>
                  {TYPE_LABEL[t]}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Connect mode banner */}
        {connectMode && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-full pointer-events-auto"
            style={{background:'white',border:'1px solid #c7d2fe',boxShadow:'0 4px 16px rgba(99,102,241,0.15)'}}
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/>
            <span className="text-sm text-indigo-700 font-medium">Bağlanacak düğüme tıklayın</span>
            <button onClick={()=>setConnectMode(null)} className="text-indigo-400 hover:text-indigo-600 text-lg leading-none ml-1">×</button>
          </div>
        )}

        {/* Controls hint */}
        <div
          className="absolute bottom-4 left-4 text-slate-400 text-[11px] font-mono"
          style={{pointerEvents:'none',lineHeight:1.9}}
        >
          <div>Sol sürükle: döndür · Scroll: zoom · Orta tuş: kaydır</div>
          <div>Düğüm sürükle: taşı · Düğüm tıkla: aç · +: bağlantı ekle</div>
        </div>

        {/* AI Validation popup */}
        {validation && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-80 pointer-events-auto"
            style={{background:'white',border:'1px solid #e2e8f0',boxShadow:'0 24px 60px rgba(0,0,0,0.14)'}}
          >
            {validation.status==='loading' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 size={28} className="text-indigo-500 animate-spin"/>
                <p className="text-sm font-semibold text-slate-700">AI Değerlendiriyor...</p>
                <p className="text-xs text-slate-400 text-center">Bağlantı analiz ediliyor</p>
              </div>
            ) : validation.status==='valid' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle size={28} className="text-emerald-500"/>
                <p className="text-sm font-semibold text-slate-700">Bağlantı Uygun</p>
                <p className="text-xs text-slate-500 text-center">{validation.reason}</p>
                <div className="w-full rounded-full h-1.5 bg-slate-100">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/>
                </div>
                <p className="text-xs text-emerald-600 font-medium">Kaydediliyor...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <AlertTriangle size={28} className="text-amber-500"/>
                <p className="text-sm font-semibold text-slate-700">Bağlantı Önerilmiyor</p>
                <p className="text-xs text-slate-500 text-center">{validation.reason}</p>
                {validation.confidence !== undefined && (
                  <div className="w-full rounded-full h-1.5 bg-slate-100">
                    <div className="bg-amber-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/>
                  </div>
                )}
                <button
                  onClick={() => {
                    commitEdge(validation.fromId,validation.fromType,validation.toId,validation.toType);
                    setValidation(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >Yine de bağla</button>
              </div>
            )}
          </div>
        )}

        {/* Topic picker */}
        {topicPicker && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-96 pointer-events-auto"
            style={{background:'white',border:'1px solid #e2e8f0',boxShadow:'0 24px 60px rgba(0,0,0,0.14)'}}
          >
            <p className="text-sm font-semibold text-slate-700 mb-1">Araştırma Konusu Eşleştir</p>
            <p className="text-xs text-slate-400 mb-4">Bu araştırma hangi konuya katkı sağlıyor?</p>
            {topicPicker.neededTopics.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">Gerekli Konular</p>
                <div className="flex flex-wrap gap-1.5">
                  {topicPicker.neededTopics.map(t => (
                    <button key={t}
                      onClick={() => saveTopicMapping(t,'needed')}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                      style={{background:'#eef2ff',color:'#4338ca',border:'1px solid #c7d2fe'}}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
            {topicPicker.optionalTopics.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">İsteğe Bağlı</p>
                <div className="flex flex-wrap gap-1.5">
                  {topicPicker.optionalTopics.map(t => (
                    <button key={t}
                      onClick={() => saveTopicMapping(t,'optional')}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                      style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0'}}
                    >{t}</button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setTopicPicker(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 pt-2 border-t border-slate-100"
            >Geç</button>
          </div>
        )}
      </div>

      {/* CSS for connect-target ring animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
