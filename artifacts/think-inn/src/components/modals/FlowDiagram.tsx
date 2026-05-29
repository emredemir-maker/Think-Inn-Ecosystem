import { useRef, useState, useEffect, useMemo } from "react";
import {
  Users, MonitorSmartphone, Workflow, Server, Cloud, Database,
  ZoomIn, ZoomOut, Maximize,
} from "lucide-react";

/**
 * FlowDiagram — backend'in ürettiği yapısal mimari akış şemasını (architecturalAnalysis.flowDiagram)
 * SOLDAN SAĞA, katmanlı ve okunur bir görsel olarak çizer. Saf SVG (kenarlar) + HTML (düğüm kartları);
 * ağır 3B/graf bağımlılığı yok. Zoom + pan (sürükle) destekli — kullanıcı yakınlaşıp kartları okur.
 * Katman sırası (soldan sağa): kullanıcı → önyüz → süreç → sunucu → harici → veri.
 */

type FlowNode = { id: string; label: string; type?: string; description?: string; layer?: string };
type FlowEdge = { from: string; to: string; label?: string; animated?: boolean };
export type FlowData = { nodes: FlowNode[]; edges: FlowEdge[] };

const LAYER_META: Record<string, { label: string; color: string; Icon: any }> = {
  user:     { label: "Kullanıcı", color: "#64708B", Icon: Users },
  frontend: { label: "Önyüz",     color: "#1463F3", Icon: MonitorSmartphone },
  process:  { label: "Süreç",     color: "#FFB020", Icon: Workflow },
  backend:  { label: "Sunucu",    color: "#7A5CFF", Icon: Server },
  external: { label: "Harici",    color: "#18C9E8", Icon: Cloud },
  database: { label: "Veri",      color: "#20C997", Icon: Database },
};
const LAYER_ORDER = ["user", "frontend", "process", "backend", "external", "database"];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normLayer(n: FlowNode): string {
  const l = (n.layer || n.type || "").toLowerCase();
  if (LAYER_META[l]) return l;
  if (/(front|ui|web|client|spa|mobile)/.test(l)) return "frontend";
  if (/(back|api|server|service|orchestr|gateway|auth)/.test(l)) return "backend";
  if (/(data|db|storage|cache|queue|sql|mongo|redis)/.test(l)) return "database";
  if (/(user|actor|person|admin)/.test(l)) return "user";
  if (/(ext|cloud|third|partner|saas|llm|gemini|openai)/.test(l)) return "external";
  return "process";
}

const NODE_W = 156; // düğüm kartı genişliği (px, sanal uzay)

export default function FlowDiagram({ data }: { data: FlowData }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];

  // ── Soldan sağa katmanlı yerleşim (sanal piksel uzayı) ──
  const { pos, VW, VH, presentLayers } = useMemo(() => {
    const byLayer: Record<string, FlowNode[]> = {};
    nodes.forEach((n) => { (byLayer[normLayer(n)] ||= []).push(n); });
    const present = LAYER_ORDER.filter((l) => byLayer[l]?.length);
    const cols = Math.max(1, present.length);
    const maxRows = Math.max(1, ...present.map((l) => byLayer[l].length));
    const vw = Math.max(820, cols * 250);
    const vh = Math.max(320, maxRows * 132);
    const p: Record<string, { x: number; y: number }> = {};
    present.forEach((l, ci) => {
      const x = ((ci + 1) / (cols + 1)) * vw;
      const col = byLayer[l];
      col.forEach((n, j) => { p[n.id] = { x, y: ((j + 1) / (col.length + 1)) * vh }; });
    });
    return { pos: p, VW: vw, VH: vh, presentLayers: present };
  }, [nodes]);

  // ── Zoom + pan görünümü ──
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const inited = useRef(false);
  const drag = useRef({ on: false, sx: 0, sy: 0, px: 0, py: 0 });

  // ── Düğüm konumları: hesaplanan yerleşim + kullanıcının sürükleyerek verdiği override'lar ──
  const [nodePos, setNodePos] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => { setNodePos({}); }, [data]); // veri değişince override'ları sıfırla
  const eff = (id: string) => nodePos[id] || pos[id]; // etkin (görünen) konum
  const nodeDrag = useRef({ on: false, id: "", sx: 0, sy: 0, bx: 0, by: 0 });

  // İlk açılışta genişliğe sığdır
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const z = clamp(w / VW, 0.35, 1);
      setView({ z, x: (w - VW * z) / 2, y: Math.max(12, (h - VH * z) / 2) });
    };
    if (!inited.current) { fit(); inited.current = true; }
    const ro = new ResizeObserver(() => { if (!drag.current.on) fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [VW, VH]);

  const zoomAt = (factor: number, ox: number, oy: number) =>
    setView((v) => {
      const z = clamp(v.z * factor, 0.35, 3);
      const f = z / v.z;
      return { z, x: ox - (ox - v.x) * f, y: oy - (oy - v.y) * f };
    });

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const r = viewportRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, px: view.x, py: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return;
    setView((v) => ({ ...v, x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current.on = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* yoksay */ }
  };
  const fitReset = () => {
    const el = viewportRef.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const z = clamp(w / VW, 0.35, 1);
    setView({ z, x: (w - VW * z) / 2, y: Math.max(12, (h - VH * z) / 2) });
  };

  // ── Düğüm sürükleme — tek düğümü taşır (sahne pan'ından bağımsız) ──
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); // viewport pan'ı başlamasın
    const p = eff(id);
    nodeDrag.current = { on: true, id, sx: e.clientX, sy: e.clientY, bx: p.x, by: p.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onNodeMove = (e: React.PointerEvent, id: string) => {
    if (!nodeDrag.current.on || nodeDrag.current.id !== id) return;
    const z = viewRef.current.z || 1; // ekran delta'sını sahne ölçeğine çevir
    const dx = (e.clientX - nodeDrag.current.sx) / z;
    const dy = (e.clientY - nodeDrag.current.sy) / z;
    setNodePos((m) => ({ ...m, [id]: { x: nodeDrag.current.bx + dx, y: nodeDrag.current.by + dy } }));
  };
  const onNodeUp = (e: React.PointerEvent) => {
    nodeDrag.current.on = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* yoksay */ }
  };

  if (nodes.length === 0) return null;

  return (
    <div>
      <div
        ref={viewportRef}
        className={"flow-viewport" + (drag.current.on ? " grabbing" : "")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Zoom kontrolleri — pointerdown'ı durdur ki viewport sürüklemesi click'i çalmasın */}
        <div className="flow-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { const r = viewportRef.current!.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); }} title="Yakınlaştır"><ZoomIn size={16} /></button>
          <button type="button" onClick={() => { const r = viewportRef.current!.getBoundingClientRect(); zoomAt(0.83, r.width / 2, r.height / 2); }} title="Uzaklaştır"><ZoomOut size={16} /></button>
          <button type="button" onClick={() => fitReset()} title="Sığdır"><Maximize size={16} /></button>
        </div>

        {/* Sahne — zoom/pan transform'u burada */}
        <div
          className="flow-stage"
          style={{ width: VW, height: VH, transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
        >
          {/* Kenarlar */}
          <svg className="flow-edges" width={VW} height={VH}>
            <defs>
              <linearGradient id="flowEdgeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#18C9E8" />
                <stop offset="0.5" stopColor="#1463F3" />
                <stop offset="1" stopColor="#7A5CFF" />
              </linearGradient>
            </defs>
            {edges.map((e, i) => {
              const a = eff(e.from), b = eff(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={"flow-edge" + (e.animated ? " animated" : "")}
                  stroke={e.animated ? "#18C9E8" : "url(#flowEdgeGrad)"}
                  strokeWidth={e.animated ? 2 : 1.5}
                />
              );
            })}
          </svg>

          {/* Kenar etiketleri */}
          {edges.map((e, i) => {
            const a = eff(e.from), b = eff(e.to);
            if (!a || !b || !e.label) return null;
            return (
              <div key={"l" + i} className="flow-edge-label" style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}>
                {e.label}
              </div>
            );
          })}

          {/* Düğüm kartları — tek tek sürüklenebilir */}
          {nodes.map((n) => {
            const p = eff(n.id);
            if (!p) return null;
            const meta = LAYER_META[normLayer(n)];
            const Ic = meta.Icon;
            return (
              <div
                key={n.id}
                className="flow-node"
                style={{ left: p.x, top: p.y, width: NODE_W, cursor: "grab", touchAction: "none" }}
                onPointerDown={(e) => onNodeDown(e, n.id)}
                onPointerMove={(e) => onNodeMove(e, n.id)}
                onPointerUp={onNodeUp}
              >
                <div className="fn-ic" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  <Ic size={16} />
                </div>
                <div className="fn-label">{n.label}</div>
                {n.description && <div className="fn-desc">{n.description}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flow-legend">
        {presentLayers.map((l) => (
          <span key={l}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: LAYER_META[l].color }} />
            {LAYER_META[l].label}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "#94A0B8" }}>Tekerlek: yakınlaş · Sürükle: kaydır</span>
      </div>
    </div>
  );
}
