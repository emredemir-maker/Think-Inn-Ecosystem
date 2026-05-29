/**
 * MindMap.jsx — 3B Bilgi Grafı (SAF CANVAS, elle 3B projeksiyon).
 *
 * Referans: design_handoff_tum_uygulama/app/PageMap.jsx
 *   - react-force-graph-3d / three.js KULLANILMAZ. Tüm matematik burada.
 *   - Fibonacci küre yerleşimi + Y/X rotasyon matrisleri + FOV=720 perspektif.
 *   - Sürekli sakin dönüş (SPIN_SPEED) + sürükle momentum easing.
 *   - BEYAZ sahne (marka kararı), cyan→blue→violet kenar gradyanı, açık-cyan AI parçacığı.
 *
 * Veri: dışarıdan `data = { nodes, links }` (gerçek DB'den, buildGraph çıktısı).
 *   Şema DEĞİŞMEZ. Sahneye sentetik bir "Innovation Hub" merkezi eklenir ve
 *   tüm düğümler merkeze ışınla (spoke) + gerçek links ile bağlanır.
 */
import { useRef, useState, useEffect } from "react";
import { Search } from "lucide-react";
import NodeDetail from "./NodeDetail";

// Düğüm renk haritası — tipe göre (think-Inn marka tablosu 13)
const NODE_COLORS = {
  idea: "#1463F3", // Primary Blue
  research: "#18C9E8", // Cyan Accent
  project: "#7A5CFF", // Violet Accent
  community: "#20C997", // marka semantik yeşil
  center: "#1463F3", // Primary Blue
};

const SPIN_SPEED = 0.0016; // otomatik dönüş hızı (rad/kare) — sakin tempo
const R = 230; // fibonacci küre yarıçapı
const FOV = 720; // perspektif odak uzaklığı

const LEGEND = [
  ["Fikir", "#1463F3"],
  ["Araştırma", "#18C9E8"],
  ["Proje", "#7A5CFF"],
  ["Topluluk", "#20C997"],
];

// hex → rgba
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
// yuvarlatılmış dikdörtgen (etiket kapsülü)
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Y ve X ekseni rotasyonu
function rotate(p, ax, ay) {
  const cy = Math.cos(ay), sy = Math.sin(ay);
  let x = p.x * cy - p.z * sy;
  let z = p.x * sy + p.z * cy;
  const cx = Math.cos(ax), sx = Math.sin(ax);
  let y = p.y * cx - z * sx;
  z = p.y * sx + z * cx;
  return { x, y, z };
}

export default function MindMap({ data }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const projRef = useRef({}); // id -> {sx,sy,rad,depth,s}
  const rot = useRef({ ax: -0.35, ay: 0.4, vy: SPIN_SPEED, vx: 0 });
  const drag = useRef({ on: false, lx: 0, ly: 0, moved: 0 });
  const zoom = useRef(1);
  const hover = useRef(null);

  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const selRef = useRef(selected);
  selRef.current = selected;

  // ── Sahne grafiğini hazırla: sentetik merkez + gerçek düğümler ────────────
  // useRef ile sakla ki her frame'de yeniden hesaplanmasın; data değişince güncellenir.
  const sceneRef = useRef({ nodes: [], edges: [], pos: {}, flow: [] });
  useEffect(() => {
    const dataNodes = data?.nodes ?? [];
    const dataLinks = data?.links ?? [];

    // Fibonacci küre — tüm gerçek düğümler yüzeyde. Sentetik merkez "hub" düğümü YOK
    // (referans PageMap.jsx gibi); düğümler yalnızca gerçek bağlantılarıyla bağlanır.
    const N = Math.max(1, dataNodes.length);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pos = {};
    dataNodes.forEach((n, i) => {
      const y = N === 1 ? 0 : 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      pos[n.id] = { x: Math.cos(theta) * r * R, y: y * R * 0.92, z: Math.sin(theta) * r * R };
    });

    // Kenarlar: yalnızca gerçek links (merkeze ışın/spoke yok)
    const edges = [];
    for (const l of dataLinks) {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (pos[s] && pos[t]) edges.push([s, t]);
    }

    // AI akışı: gerçek kenarlardan ilk 2'si (varsa) — açık cyan parçacık
    const flow = edges.slice(0, 2);

    sceneRef.current = { nodes: dataNodes, edges, pos, flow };
  }, [data]);

  const setZoom = (d) => {
    zoom.current = Math.min(1.9, Math.max(0.55, zoom.current + d));
  };

  // ── Canvas çizim döngüsü + etkileşim ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    let raf, W = 0, H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let t = 0;
    const frame = () => {
      t += 1;
      const { nodes, edges, pos, flow } = sceneRef.current;
      const r = rot.current;
      // Boştayken sürekli sakin dönüş; momentum yumuşakça SPIN_SPEED'e oturur
      if (!drag.current.on) {
        r.ay += r.vy; r.ax += r.vx; r.vx *= 0.94;
        r.vy += (SPIN_SPEED - r.vy) * 0.03;
      }
      const cx = W / 2, cy = H / 2 + 8;

      ctx.clearRect(0, 0, W, H);
      if (nodes.length === 0) { raf = requestAnimationFrame(frame); return; }

      // Tüm düğümleri projekte et
      const proj = {};
      nodes.forEach((n) => {
        const p = rotate(pos[n.id] || { x: 0, y: 0, z: 0 }, r.ax, r.ay);
        const s = (FOV / (FOV + p.z)) * zoom.current;
        const baseR = n.type === "center" ? 30 : 17;
        proj[n.id] = { sx: cx + p.x * s, sy: cy + p.y * s, depth: p.z, rad: baseR * s, s };
      });
      projRef.current = proj;

      const sel = selRef.current, hov = hover.current;
      const isLit = (id) => {
        if (!sel) return false;
        if (id === sel.id) return true;
        return edges.some(([a, b]) => (a === sel.id && b === id) || (b === sel.id && a === id));
      };

      // ── Kenarlar (arkadan öne, ortalama derinliğe göre) ──
      const edrawn = edges
        .map(([a, b]) => {
          const A = proj[a], B = proj[b];
          return A && B ? { a, b, A, B, mid: (A.depth + B.depth) / 2 } : null;
        })
        .filter(Boolean)
        .sort((u, v) => u.mid - v.mid);

      edrawn.forEach(({ a, b, A, B }) => {
        const lit = sel && (a === sel.id || b === sel.id);
        const dn = (A.depth + B.depth) / 2;
        const alpha = (0.1 + 0.22 * (1 - (dn + R) / (2 * R))) * (sel ? (lit ? 2.4 : 0.5) : 1);
        // Marka akışı: cyan → blue → violet
        const g = ctx.createLinearGradient(A.sx, A.sy, B.sx, B.sy);
        g.addColorStop(0, "#18C9E8");
        g.addColorStop(0.5, "#1463F3");
        g.addColorStop(1, "#7A5CFF");
        ctx.strokeStyle = g;
        ctx.globalAlpha = Math.min(0.9, Math.max(0.04, alpha));
        ctx.lineWidth = Math.max(0.6, 1.5 * ((A.s + B.s) / 2));
        ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // ── AI-önerdiği kenarlarda akan parçacık (açık cyan) ──
      flow.forEach(([a, b], k) => {
        const A = proj[a], B = proj[b];
        if (!A || !B) return;
        const frac = (t * 0.012 + k * 0.5) % 1;
        const px = A.sx + (B.sx - A.sx) * frac;
        const py = A.sy + (B.sy - A.sy) * frac;
        const rr = 3.2 * ((A.s + B.s) / 2);
        const gg = ctx.createRadialGradient(px, py, 0, px, py, rr * 3);
        gg.addColorStop(0, "rgba(24,201,232,0.95)");
        gg.addColorStop(1, "rgba(24,201,232,0)");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(px, py, rr * 3, 0, Math.PI * 2); ctx.fill();
      });

      // ── Düğümler (arkadan öne) ──
      const order = nodes.slice().sort((u, v) => proj[u.id].depth - proj[v.id].depth);
      order.forEach((n) => {
        const P = proj[n.id];
        const col = NODE_COLORS[n.type] || "#1463F3";
        const dimmed = sel && !isLit(n.id);
        const depthFade = 0.45 + 0.55 * (1 - (P.depth + R) / (2 * R));
        const a = depthFade * (dimmed ? 0.35 : 1);

        // glow
        const glowR = P.rad * (n.type === "center" ? 3.4 : 2.6);
        const gl = ctx.createRadialGradient(P.sx, P.sy, 0, P.sx, P.sy, glowR);
        gl.addColorStop(0, hexA(col, 0.42 * a));
        gl.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(P.sx, P.sy, glowR, 0, Math.PI * 2); ctx.fill();

        // disk
        ctx.globalAlpha = a;
        if (n.type === "center") {
          const cg = ctx.createLinearGradient(P.sx - P.rad, P.sy - P.rad, P.sx + P.rad, P.sy + P.rad);
          cg.addColorStop(0, "#18C9E8"); cg.addColorStop(0.5, "#1463F3"); cg.addColorStop(1, "#7A5CFF");
          ctx.fillStyle = cg;
        } else {
          ctx.fillStyle = "#fff";
        }
        ctx.beginPath(); ctx.arc(P.sx, P.sy, P.rad, 0, Math.PI * 2); ctx.fill();

        if (n.type !== "center") {
          // renkli halka + iç nokta
          ctx.lineWidth = Math.max(1.4, 2.4 * P.s);
          ctx.strokeStyle = col;
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(P.sx, P.sy, P.rad * 0.42, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(P.sx, P.sy, P.rad * 0.32, 0, Math.PI * 2); ctx.fill();
        }

        // seçim / hover halkası
        if ((sel && n.id === sel.id) || hov === n.id) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2;
          ctx.strokeStyle = col;
          const pr = P.rad + 6 + (sel && n.id === sel.id ? 2 * Math.sin(t * 0.08) + 2 : 0);
          ctx.beginPath(); ctx.arc(P.sx, P.sy, pr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // etiket (merkez / seçili / hover / yakın düğümde görünür)
        const showLabel = n.type === "center" || (sel && n.id === sel.id) || hov === n.id || P.s > 1.02;
        if (showLabel) {
          const fs = Math.max(10, 11 * P.s);
          ctx.font = "600 " + fs + "px Inter, Manrope, system-ui, sans-serif";
          // Uzun başlıklar haritada üst üste binmesin — kısalt (… ile)
          const rawLabel = n.name || "";
          const label = rawLabel.length > 26 ? rawLabel.slice(0, 26).trimEnd() + "…" : rawLabel;
          const tw = ctx.measureText(label).width;
          const ly = P.sy + P.rad + 9;
          ctx.globalAlpha = Math.min(1, a + 0.15);
          roundRect(ctx, P.sx - tw / 2 - 8, ly, tw + 16, fs + 9, 999);
          ctx.fillStyle = "rgba(255,255,255,0.94)";
          ctx.fill();
          ctx.strokeStyle = "rgba(232,238,249,1)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#071B3A";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(label, P.sx, ly + (fs + 9) / 2 + 0.5);
          ctx.globalAlpha = 1;
        }
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── Etkileşim ──
    const pick = (mx, my) => {
      let best = null, bd = 1e9;
      const proj = projRef.current;
      for (const id in proj) {
        const P = proj[id];
        const d = Math.hypot(P.sx - mx, P.sy - my);
        if (d < P.rad + 8 && d < bd) { bd = d; best = id; }
      }
      return best ? sceneRef.current.nodes.find((n) => n.id === best) : null;
    };
    const getXY = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e) => {
      const [x, y] = getXY(e);
      drag.current = { on: true, lx: x, ly: y, moved: 0 };
      canvas.style.cursor = "grabbing";
      // Pointer yakalama — sürükleme sırasında imleç canvas dışına/overlay üstüne
      // taşsa bile move/up olayları güvenle canvas'a gelsin (sol-sağ dönüş garanti).
      try { canvas.setPointerCapture(e.pointerId); } catch { /* yoksay */ }
    };
    const move = (e) => {
      const [x, y] = getXY(e);
      if (drag.current.on) {
        const dx = x - drag.current.lx, dy = y - drag.current.ly;
        drag.current.lx = x; drag.current.ly = y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        // Sol-sağ (Y ekseni) ve yukarı-aşağı (X ekseni) dönüş — referans spec: 0.006 rad/px
        rot.current.ay += dx * 0.006;
        rot.current.ax += dy * 0.006;
        // Yukarı-aşağı eğim ±1.25'e clamp (referans spec)
        rot.current.ax = Math.max(-1.25, Math.min(1.25, rot.current.ax));
        rot.current.vx = dy * 0.0008;
        rot.current.vy = dx * 0.0012 || rot.current.vy;
      } else {
        const n = pick(x, y);
        hover.current = n ? n.id : null;
        canvas.style.cursor = n ? "pointer" : "grab";
      }
    };
    const up = (e) => {
      if (drag.current.on && drag.current.moved < 6) {
        const [x, y] = getXY(e);
        const n = pick(x, y);
        if (n) setSelected(n);
      }
      if (drag.current.on && Math.abs(rot.current.vy) < 0.001) rot.current.vy = SPIN_SPEED;
      drag.current.on = false;
      canvas.style.cursor = "grab";
      try { if (e.pointerId != null) canvas.releasePointerCapture(e.pointerId); } catch { /* yoksay */ }
    };
    const wheel = (e) => { e.preventDefault(); setZoom(-e.deltaY * 0.0012); };

    // Başlıktaki zoom +/− ve tam ekran butonları event ile MindMap'e ulaşır (referans PageHead aksiyonları)
    const onZoomEvt = (e) => setZoom((e.detail && e.detail.delta) || 0);
    const onFsEvt = () => {
      if (!wrap) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else wrap.requestFullscreen?.();
    };

    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("think-inn:map-zoom", onZoomEvt);
    window.addEventListener("think-inn:map-fullscreen", onFsEvt);
    canvas.style.cursor = "grab";

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("think-inn:map-zoom", onZoomEvt);
      window.removeEventListener("think-inn:map-fullscreen", onFsEvt);
    };
  }, []);

  // Seçili düğümün komşuları (NodeDetail için) — gerçek kenarlardan
  const neighborCount = selected
    ? sceneRef.current.edges.filter(([a, b]) => a === selected.id || b === selected.id).length
    : 0;
  const selectedNeighbors = selected
    ? sceneRef.current.edges
        .filter(([a, b]) => a === selected.id || b === selected.id)
        .map(([a, b]) => (a === selected.id ? b : a))
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .map((id) => sceneRef.current.nodes.find((n) => n.id === id))
        .filter(Boolean)
    : [];

  // Arama: ismi sorguyu içeren ilk düğümü seç (Enter)
  const runSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const found = sceneRef.current.nodes.find((n) => (n.name || "").toLowerCase().includes(q));
    if (found) setSelected(found);
  };

  // "Detayı Aç" → tam-sayfa kart detayını aç (gerçek DB id'si node.raw.id'de)
  const openDetail = (n) => {
    if (!n || !n.raw) return;
    const id = n.raw.id;
    if (n.type === "research") window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: "research", id } }));
    else if (n.type === "idea" || n.type === "project") window.dispatchEvent(new CustomEvent("think-inn:open-card", { detail: { type: "idea", id } }));
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: "#fff",
        // mavi nokta-grid + hafif mavi radyal (referans .map-page-shell)
        backgroundImage:
          "radial-gradient(circle at 50% 46%, rgba(20,99,243,0.06), transparent 60%), radial-gradient(rgba(20,99,243,0.10) 1px, transparent 1px)",
        backgroundSize: "100% 100%, 22px 22px",
        touchAction: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* ── Üst katman: arama (sol) + legend (sağ) — referans .map-page-overlay ── */}
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-4">
        <div className="pointer-events-auto flex min-w-[280px] items-center gap-2.5 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 shadow-[0_4px_12px_rgba(7,27,58,0.05)]">
          <Search size={16} className="text-[#94A0B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="Düğüm ara..."
            className="w-full bg-transparent text-[13px] text-on-surface placeholder:text-[#94A0B8] outline-none"
          />
        </div>
        <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 shadow-[0_4px_12px_rgba(7,27,58,0.05)]">
          {LEGEND.map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Alt ipucu ── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-[11px] font-semibold text-[#94A0B8] shadow-[0_4px_12px_rgba(7,27,58,0.05)]">
        Sürükle: döndür · Tekerlek: zoom · Tıkla: seç
      </div>

      {/* ── Detay paneli (sağda) ── */}
      <NodeDetail
        node={selected}
        neighborCount={neighborCount}
        neighbors={selectedNeighbors}
        onSelect={(n) => setSelected(n)}
        onOpenDetail={openDetail}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
