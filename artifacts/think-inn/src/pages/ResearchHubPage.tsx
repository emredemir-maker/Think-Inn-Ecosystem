import { useMemo, useState } from "react";
import { useListResearch, useListIdeas, type Research } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

/* Material Symbols ikon */
function Icon({
  name,
  size = 18,
  filled = false,
  className = "",
}: {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

/* ResearchHubPage — /research. Referans: liste satırı + tag cloud sidebar. */
export default function ResearchHubPage() {
  const { data: researchList, isLoading } = useListResearch();
  const { data: ideaList } = useListIdeas();
  const { user } = useAuth();
  const isAdmin = !!user;

  const research = researchList ?? [];
  const ideas = ideaList ?? [];

  const [activeCat, setActiveCat] = useState<string | null>(null);

  // Her araştırmaya bağlı fikir sayısı (gerçek: idea.researchIds bu research.id'yi içeriyor mu)
  const linkedIdeaCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of research) map.set(r.id, 0);
    for (const i of ideas) {
      for (const rid of i.researchIds ?? []) {
        map.set(rid, (map.get(rid) ?? 0) + 1);
      }
    }
    return map;
  }, [research, ideas]);

  // Kategori filtreleri (gerçek kategorilerden)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of research) {
      const c = (r as any).category;
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [research]);

  const filtered = useMemo(() => {
    const list = activeCat ? research.filter((r) => (r as any).category === activeCat) : research;
    // En son eklenen üstte
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [research, activeCat]);

  // Tag cloud (gerçek tag frekansı)
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of research) {
      for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [research]);

  // AI önerisi — en çok bağlı araştırma
  const topLinked = useMemo(() => {
    let best: { r: Research; count: number } | null = null;
    for (const r of research) {
      const c = linkedIdeaCount.get(r.id) ?? 0;
      if (!best || c > best.count) best = { r, count: c };
    }
    return best && best.count > 0 ? best : null;
  }, [research, linkedIdeaCount]);

  const openCard = (id: number) => {
    window.dispatchEvent(
      new CustomEvent("think-inn:open-card", { detail: { type: "research", id } })
    );
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-10 pb-16 pt-7">
        {/* Page head */}
        <div className="page-head">
          <div className="l">
            <span className="eyebrow">Araştırma Kütüphanesi</span>
            <h1>Araştırmalar</h1>
            <p>Otomatik özetlenmiş ve anahtar kelime çıkarımı yapılmış araştırma kaynakları. AI önerileri ile fikirlere bağlanır.</p>
          </div>
          {isAdmin && (
            <div className="page-actions">
              <button className="icon-btn" aria-label="Filtre">
                <Icon name="filter_list" size={18} />
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))}
                className="flex items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
              >
                <Icon name="upload" size={16} />
                Araştırma İçe Aktar
              </button>
            </div>
          )}
        </div>

        {/* Filter row */}
        {categories.length > 0 && (
          <div className="filter-row">
            <div className="filter-chips">
              <button
                onClick={() => setActiveCat(null)}
                className={"filter-chip" + (activeCat === null ? " active" : "")}
              >
                Tümü
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCat(activeCat === c ? null : c)}
                  className={"filter-chip" + (activeCat === c ? " active" : "")}
                >
                  {c}
                </button>
              ))}
            </div>
            <button className="sort-pill">
              <Icon name="swap_vert" size={14} className="text-on-surface-variant" />
              Sırala: <b className="ml-1 text-on-surface">Eklenme tarihi ↓</b>
            </button>
          </div>
        )}

        {/* Body: list + sidebar */}
        {isLoading ? (
          <div className="research-list">
            <div className="research-table">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="research-row animate-pulse" style={{ minHeight: 72 }} />
              ))}
            </div>
            <div className="tag-cloud animate-pulse" style={{ minHeight: 200 }} />
          </div>
        ) : research.length === 0 ? (
          <div className="hub-empty">
            <div className="ico">
              <Icon name="biotech" size={26} />
            </div>
            <div className="t">Henüz araştırma yok</div>
            <div className="p">
              AI asistanına bir makale veya araştırma metni yapıştır — özet, kategori ve etiketleri otomatik çıkarıp buraya ekler.
            </div>
          </div>
        ) : (
          <div className="research-list">
            {/* Liste */}
            <div className="research-table">
              {filtered.map((r) => {
                const count = linkedIdeaCount.get(r.id) ?? 0;
                return (
                  <div key={r.id} className="research-row" onClick={() => openCard(r.id)}>
                    <div className="ico">
                      <Icon name="menu_book" size={18} />
                    </div>
                    <div>
                      <div className="title">{r.title}</div>
                      <div className="meta">
                        <span>{r.authorName}</span>
                        {(r as any).category && (
                          <>
                            <span className="sep">·</span>
                            <span>{(r as any).category}</span>
                          </>
                        )}
                        {r.createdAt && (
                          <>
                            <span className="sep">·</span>
                            <span>
                              {formatDistanceToNow(new Date(r.createdAt), {
                                addSuffix: true,
                                locale: tr,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="links">
                      <span className="n">{count}</span>
                      <span>Bağlı Fikir</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sidebar: tag cloud + AI önerisi */}
            <div className="tag-cloud">
              <div className="title">Sık geçen etiketler</div>
              {tagCloud.length > 0 ? (
                <div className="tag-cloud-list">
                  {tagCloud.map(([t, n]) => (
                    <span key={t} className="cloud-tag">
                      #{t}
                      <span className="count">{n}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-on-surface-variant">
                  Etiket yok — araştırma eklendikçe burada birikir.
                </p>
              )}

              {topLinked && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 14,
                    background: "rgba(20,99,243,0.06)",
                    borderRadius: 12,
                    border: "1px solid rgba(20,99,243,0.18)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon name="auto_awesome" size={14} className="text-primary" />
                    <span
                      style={{
                        fontFamily: "Manrope, sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "#1463F3",
                      }}
                    >
                      AI ÖNERİSİ
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12.5,
                      color: "#4A5673",
                      lineHeight: 1.5,
                    }}
                  >
                    <b style={{ color: "#071B3A" }}>"{topLinked.r.title}"</b> en çok bağlantı kurulan
                    araştırma — <b style={{ color: "#071B3A" }}>{topLinked.count}</b> fikri besliyor.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
