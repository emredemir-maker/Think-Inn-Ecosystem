import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Research, Idea } from '@workspace/api-client-react';
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle, BookOpen, Tag } from 'lucide-react';

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

// ── Constants & helpers ────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  research: '#22d3ee',
  idea:     '#e2e8f0',
  project:  '#c4b5fd',
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

// ── Star field ─────────────────────────────────────────────────────────────
function StarField() {
  const positions = useMemo(() => {
    const p = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r     = 50 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(Math.random() * 2 - 1);
      p[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      p[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      p[i*3+2] = r * Math.cos(phi);
    }
    return p;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]}/>
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#4a5a7a" transparent opacity={0.65} sizeAttenuation/>
    </points>
  );
}

// ── Travelling dot along an edge ────────────────────────────────────────────
function TravellingDot({ p0, p1, color, speed }: {
  p0: [number,number,number]; p1: [number,number,number]; color: string; speed: number;
}) {
  const ref  = useRef<THREE.Mesh>(null);
  const t    = useRef(Math.random());
  const srcV = useMemo(() => new THREE.Vector3(...p0), [p0[0], p0[1], p0[2]]);
  const tgtV = useMemo(() => new THREE.Vector3(...p1), [p1[0], p1[1], p1[2]]);
  useFrame((_, dt) => {
    t.current = (t.current + dt * speed) % 1;
    ref.current?.position.lerpVectors(srcV, tgtV, t.current);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.055, 8, 8]}/>
      <meshBasicMaterial color={color} transparent opacity={0.9}
        blending={THREE.AdditiveBlending} depthWrite={false}/>
    </mesh>
  );
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
  const p0 = useMemo((): [number,number,number] => [sx,sy,sz], [sx,sy,sz]);
  const p1 = useMemo((): [number,number,number] => [tx,ty,tz], [tx,ty,tz]);
  const mid = useMemo(() => [(sx+tx)/2, (sy+ty)/2, (sz+tz)/2] as [number,number,number], [sx,sy,sz,tx,ty,tz]);

  if (!src || !tgt) return null;

  const col = edge.isProjectLink ? '#a78bfa'
    : edge.manual ? '#e2e8f0'
    : edge.topicMapping?.topicType === 'needed' ? '#22d3ee'
    : '#64748b';
  const dotCol   = edge.isProjectLink ? '#c4b5fd' : edge.manual ? '#f1f5f9' : col;
  const dotSpeed = edge.manual ? 0.22 : edge.isProjectLink ? 0.17 : 0.15;

  return (
    <group onPointerEnter={onEnter} onPointerLeave={onLeave}>
      {/* Wide glow */}
      <Line points={[p0, p1]} color={col}
        lineWidth={hovered ? 10 : 5} transparent opacity={hovered ? 0.09 : 0.04}/>
      {/* Core line */}
      <Line points={[p0, p1]} color={col}
        lineWidth={hovered ? 1.8 : 0.9}
        transparent opacity={hovered ? 0.75 : edge.manual ? 0.5 : 0.3}/>
      {/* Dot */}
      <TravellingDot p0={p0} p1={p1} color={dotCol} speed={dotSpeed}/>
      {/* Delete button */}
      {hovered && !edge.isProjectLink && (
        <Html position={mid} center zIndexRange={[50, 0]}>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            onPointerEnter={onEnter} onPointerLeave={onLeave}
            style={{
              background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(239,68,68,0.5)',
              color: '#f87171', borderRadius: '50%', width: 22, height: 22,
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </Html>
      )}
    </group>
  );
}

// ── Node sphere ─────────────────────────────────────────────────────────────
function NodeMesh({ node, edges, orbitRef, setNodes, connectMode, onClickNode, onBeginConnect }: {
  node: NodeData; edges: Edge[];
  orbitRef: React.RefObject<any>;
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  connectMode: ConnectMode | null;
  onClickNode: () => void;
  onBeginConnect: () => void;
}) {
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const outerRef   = useRef<THREE.Mesh>(null);
  const importance = calcImportance(node, edges);
  const radius     = Math.max(0.2, 0.15 + importance * 0.06);
  const col        = TYPE_COLOR[node.type] ?? '#ffffff';
  const isConnSrc  = connectMode?.sourceId === node.id && connectMode?.sourceType === node.type;
  const isConnTgt  = connectMode && connectMode.sourceId !== node.id && node.type !== 'project';

  // Font size based on importance
  const fontSize = Math.max(11, Math.min(22, 10 + importance * 1.8));
  const fw       = importance >= 4 ? 700 : importance >= 2 ? 600 : 400;
  const title    = node.title.length > 36 ? node.title.slice(0, 34) + '…' : node.title;

  // Pulse animation on outer glow
  useFrame(({ clock }) => {
    if (!outerRef.current) return;
    const mat = outerRef.current.material as THREE.MeshBasicMaterial;
    const base  = isConnSrc ? 0.20 : hovered ? 0.13 : 0.05;
    mat.opacity = base + Math.sin(clock.elapsedTime * 2) * 0.025;
  });

  // Pointer down → start drag or connect-target click
  const onPD = (e: any) => {
    e.stopPropagation();
    const hasMoved = { v: false };
    const plane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), -node.z);
    const raycaster = new THREE.Raycaster();
    const canvas   = gl.domElement;
    let initHit: { x: number; y: number } | null = null;

    if (orbitRef.current) orbitRef.current.enabled = false;

    const onMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
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

  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Outer glow halo */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[radius * 3, 10, 10]}/>
        <meshBasicMaterial color={col} transparent opacity={0.05}
          blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide}/>
      </mesh>

      {/* Core sphere */}
      <mesh
        onPointerDown={onPD}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 22, 22]}/>
        <meshStandardMaterial
          color={col} emissive={col}
          emissiveIntensity={isConnSrc ? 1.6 : hovered ? 1.1 : 0.55}
          roughness={0.18} metalness={0.15}
        />
      </mesh>

      {/* Connect-target ring */}
      {isConnTgt && (
        <mesh>
          <torusGeometry args={[radius * 1.7, 0.04, 8, 32]}/>
          <meshBasicMaterial color={col} transparent opacity={0.55} blending={THREE.AdditiveBlending}/>
        </mesh>
      )}

      {/* Text label */}
      <Html
        position={[0, radius + 0.28, 0]}
        center
        distanceFactor={14}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[20, 0]}
      >
        <div style={{
          color: hovered || isConnSrc ? '#ffffff' : col,
          fontSize: `${fontSize}px`,
          fontWeight: fw,
          whiteSpace: 'nowrap',
          fontFamily: '"Inter", system-ui, sans-serif',
          textShadow: `0 0 14px ${col}cc, 0 0 28px ${col}66`,
          userSelect: 'none',
          letterSpacing: '0.015em',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}>
          {title}
        </div>
      </Html>

      {/* Connect button (hover, not in connect mode, not project) */}
      {hovered && !connectMode && node.type !== 'project' && (
        <Html position={[radius + 0.55, radius + 0.4, 0]} center zIndexRange={[30, 0]}>
          <button
            onClick={e => { e.stopPropagation(); onBeginConnect(); }}
            title="Bağlantı oluştur"
            style={{
              background: 'rgba(0,0,0,0.82)',
              border: `1px solid ${col}88`,
              color: col, borderRadius: '50%',
              width: 20, height: 20,
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </Html>
      )}
    </group>
  );
}

// ── Scene (inside Canvas) ───────────────────────────────────────────────────
function Scene({ nodes, edges, orbitRef, setNodes, connectMode, onClickNode, onBeginConnect,
  hoveredEdgeIdx, setHoveredEdgeIdx, onDeleteEdge }: any) {
  return (
    <>
      <color attach="background" args={['#000000']}/>
      <ambientLight intensity={0.12}/>
      <pointLight position={[0, 12, 12]} intensity={0.6} color="#2a4a7a"/>
      <pointLight position={[-12, -6, -6]} intensity={0.35} color="#1a2a4a"/>
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={40}
        rotateSpeed={0.6}
      />
      <StarField/>
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
        <NodeMesh
          key={nodeKey(node.id, node.type)}
          node={node} edges={edges}
          orbitRef={orbitRef}
          setNodes={setNodes}
          connectMode={connectMode}
          onClickNode={() => onClickNode(node)}
          onBeginConnect={() => onBeginConnect(node.id, node.type)}
        />
      ))}
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
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
  const orbitRef  = useRef<any>(null);
  const nodesRef  = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── Build graph ────────────────────────────────────────────────────────
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
      const center = selectedType==='research' ? allResearch.find(r=>r.id===selectedId) : allIdeas.find(i=>i.id===selectedId);
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

  // ESC cancel connect mode
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key==='Escape') setConnectMode(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ── Node click handler ───────────────────────────────────────────────
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

  // ── Edge / validation logic ───────────────────────────────────────────
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

  const flash = (text:string,type:'ok'|'err'|'info') => {setFlashMsg({text,type});setTimeout(()=>setFlashMsg(null),3000);};

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0" style={{background:'#000'}}>
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
            onClickNode={handleNodeClick}
            onBeginConnect={(id:number, type:string) => setConnectMode({sourceId:id,sourceType:type})}
            hoveredEdgeIdx={hoveredEdgeIdx}
            setHoveredEdgeIdx={setHoveredEdgeIdx}
            onDeleteEdge={onDeleteEdge}
          />
        </Suspense>
      </Canvas>

      {/* ── HTML UI overlay ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{zIndex:10}}>

        {/* Top-left bar */}
        <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-slate-400 hover:text-white transition-all"
            style={{background:'rgba(0,0,0,0.72)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(12px)'}}>
            <ArrowLeft size={14}/> Listeye Dön
          </button>
          <span className="text-xs text-slate-500 px-2.5 py-1 rounded-full font-mono"
            style={{background:'rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.07)'}}>
            {globalMode?'Genel · ':''}{nodes.length} düğüm · {edges.length} bağlantı
          </span>
          {flashMsg && (
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${flashMsg.type==='ok'?'border-emerald-500/30 text-emerald-400':flashMsg.type==='err'?'border-red-500/30 text-red-400':'border-cyan-500/30 text-cyan-400'}`}
              style={{background:'rgba(0,0,0,0.85)'}}>
              {flashMsg.text}
            </span>
          )}
        </div>

        {/* Legend */}
        {globalMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full px-4 py-2"
            style={{background:'rgba(0,0,0,0.65)',border:'1px solid rgba(255,255,255,0.07)',pointerEvents:'none'}}>
            {(['research','idea','project'] as const).map((t,i) => (
              <React.Fragment key={t}>
                {i>0 && <span className="text-slate-700">·</span>}
                <span className="flex items-center gap-1.5 text-xs font-mono" style={{color:TYPE_COLOR[t]}}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:TYPE_COLOR[t]}}/>
                  {t==='research'?'Araştırma':t==='idea'?'Fikir':'Proje'}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Connect mode banner */}
        {connectMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-full pointer-events-auto"
            style={{background:'rgba(34,211,238,0.1)',border:'1px solid rgba(34,211,238,0.4)'}}>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
            <span className="text-sm text-cyan-300 font-medium">Bağlanacak düğüme tıklayın</span>
            <button onClick={()=>setConnectMode(null)} className="text-cyan-500 hover:text-cyan-300 text-lg leading-none ml-1">×</button>
          </div>
        )}

        {/* Controls hint */}
        <div className="absolute bottom-4 left-4 text-slate-700 text-[11px] font-mono" style={{pointerEvents:'none',lineHeight:1.9}}>
          <div>Sol sürükle: döndür · Scroll: zoom · Orta tuş: kaydır</div>
          <div>Düğüm sürükle: taşı · Düğüm tıkla: aç · +: bağlantı ekle</div>
        </div>

        {/* AI Validation popup */}
        {validation && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-80 pointer-events-auto"
            style={{background:'rgba(5,7,15,0.97)',border:'1px solid rgba(34,211,238,0.2)',backdropFilter:'blur(24px)',boxShadow:'0 24px 60px rgba(0,0,0,0.9)'}}>
            {validation.status==='loading' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 size={28} className="text-cyan-400 animate-spin"/>
                <p className="text-sm font-semibold text-slate-200">AI Değerlendiriyor...</p>
                <p className="text-xs text-slate-500 text-center">Bağlantı analiz ediliyor</p>
              </div>
            ) : validation.status==='valid' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle size={28} className="text-emerald-400"/>
                <p className="text-sm font-semibold text-slate-200">Bağlantı Uygun</p>
                <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
                <div className="w-full rounded-full h-1.5" style={{background:'rgba(255,255,255,0.06)'}}>
                  <div className="bg-emerald-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/>
                </div>
                <p className="text-xs text-emerald-400 font-medium">Kaydediliyor...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <AlertTriangle size={28} className="text-amber-400"/>
                <p className="text-sm font-semibold text-slate-200">Bağlantı Önerilmiyor</p>
                <p className="text-xs text-slate-400 text-center">{validation.reason}</p>
                <div className="w-full rounded-full h-1.5" style={{background:'rgba(255,255,255,0.06)'}}>
                  <div className="bg-amber-400 h-1.5 rounded-full" style={{width:`${validation.confidence}%`}}/>
                </div>
                <div className="flex gap-2 mt-1 w-full">
                  <button onClick={()=>setValidation(null)} className="flex-1 py-1.5 text-xs font-medium text-slate-400 rounded-lg" style={{border:'1px solid rgba(255,255,255,0.1)'}}>İptal</button>
                  <button onClick={()=>{const v=validation;setValidation(null);commitEdge(v.fromId,v.fromType,v.toId,v.toType);}} className="flex-1 py-1.5 text-xs font-medium text-amber-300 rounded-lg" style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)'}}>Yine de Bağla</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Topic picker */}
        {topicPicker && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 w-96 pointer-events-auto"
            style={{background:'rgba(5,7,15,0.97)',border:'1px solid rgba(34,211,238,0.2)',backdropFilter:'blur(24px)',boxShadow:'0 24px 60px rgba(0,0,0,0.9)'}}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className="text-cyan-400"/>
              <p className="text-sm font-semibold text-slate-200">Araştırma Konusu Eşleştir</p>
              <button onClick={()=>setTopicPicker(null)} className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
            </div>
            {topicPicker.neededTopics.length>0&&(
              <div className="mb-3">
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 font-mono">Zorunlu Konular</p>
                <div className="flex flex-col gap-1">
                  {topicPicker.neededTopics.map(t=>(
                    <button key={t} onClick={()=>saveTopicMapping(t,'needed')}
                      className="text-left text-xs px-3 py-2 rounded-lg text-cyan-300 hover:text-cyan-200 flex items-center gap-2"
                      style={{background:'rgba(34,211,238,0.05)',border:'1px solid rgba(34,211,238,0.15)'}}>
                      <Tag size={10}/>{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {topicPicker.optionalTopics.length>0&&(
              <div className="mb-3">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 font-mono">Opsiyonel Konular</p>
                <div className="flex flex-col gap-1">
                  {topicPicker.optionalTopics.map(t=>(
                    <button key={t} onClick={()=>saveTopicMapping(t,'optional')}
                      className="text-left text-xs px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 flex items-center gap-2"
                      style={{background:'rgba(251,191,36,0.05)',border:'1px solid rgba(251,191,36,0.15)'}}>
                      <Tag size={10}/>{t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={()=>setTopicPicker(null)} className="w-full py-2 text-xs text-slate-500 hover:text-slate-400 rounded-lg" style={{border:'1px solid rgba(255,255,255,0.08)'}}>
              Eşleştirme yapma
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
