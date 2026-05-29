/**
 * NodeDetail.jsx — Seçili düğümün detay paneli (BEYAZ sahne, marka renkleri).
 * Düğüm tipine (research / idea / project / community) göre farklı alanlar.
 * Referans .map-detail: beyaz panel, navy metin, tip renkli vurgu.
 */

// Tip → marka rengi + Türkçe etiket + ikon (tablo 13)
const TYPE_META = {
  research: { color: "#18C9E8", label: "Araştırma", icon: "biotech" },
  idea: { color: "#1463F3", label: "Fikir", icon: "lightbulb" },
  project: { color: "#7A5CFF", label: "Proje", icon: "account_tree" },
  community: { color: "#20C997", label: "Topluluk", icon: "groups" },
  center: { color: "#1463F3", label: "Merkez", icon: "hub" },
};

function Icon({ name, size = 18, filled = false, color }) {
  return (
    <span
      className="material-symbols-outlined select-none leading-none"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

export default function NodeDetail({ node, neighborCount, neighbors = [], onSelect, onOpenDetail, onClose }) {
  if (!node) return null;
  const meta = TYPE_META[node.type] ?? TYPE_META.idea;
  const raw = node.raw ?? {};

  return (
    <aside
      className="absolute right-4 top-20 bottom-4 z-20 flex w-[320px] flex-col overflow-hidden rounded-2xl border bg-white"
      style={{
        borderColor: "#E8EEF9",
        boxShadow: "0 16px 40px rgba(7,27,58,0.10)",
      }}
    >
      {/* Üst renk şeridi — tip rengi */}
      <div className="h-1 w-full shrink-0" style={{ background: meta.color }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${meta.color}1a`, color: meta.color }}
          >
            <Icon name={meta.icon} size={13} color={meta.color} filled />
            {meta.label}
          </div>
          <h3 className="mt-2 font-heading text-[16px] font-bold leading-snug text-on-surface">
            {node.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-background"
          aria-label="Kapat"
        >
          <Icon name="close" size={18} color="currentColor" />
        </button>
      </div>

      {/* Gövde — tipe göre alanlar */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 custom-scrollbar">
        {/* Bağlantı sayısı */}
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
          <Icon name="hub" size={18} color={meta.color} />
          <div>
            <div className="text-[18px] font-bold leading-none text-on-surface">{neighborCount}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Bağlantı
            </div>
          </div>
        </div>

        {/* RESEARCH */}
        {node.type === "research" && (
          <>
            {raw.source && <Field label="Kaynak" value={raw.source} />}
            {raw.category && <Field label="Kategori" value={raw.category} />}
            {(raw.summary || raw.description) && (
              <Field label="Özet" value={raw.summary || raw.description} multiline />
            )}
          </>
        )}

        {/* IDEA */}
        {node.type === "idea" && (
          <>
            {raw.category && <Field label="Kategori" value={raw.category} />}
            {raw.description && <Field label="Açıklama" value={raw.description} multiline />}
            {Array.isArray(raw.tags) && raw.tags.length > 0 && (
              <TagsField label="Etiketler" tags={raw.tags} color={meta.color} />
            )}
          </>
        )}

        {/* PROJECT */}
        {node.type === "project" && (
          <>
            {raw.stage && <Field label="Aşama" value={raw.stage} />}
            {raw.description && <Field label="Açıklama" value={raw.description} multiline />}
            {raw.status && <Field label="Durum" value={raw.status} />}
          </>
        )}

        {/* Bağlı düğümler — komşu listesi (referans .map-detail). Tıkla → o düğüme geç */}
        {neighbors.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Bağlı Düğümler
            </div>
            <div className="flex flex-col gap-1.5">
              {neighbors.slice(0, 6).map((n) => {
                const c = (TYPE_META[n.type] ?? TYPE_META.idea).color;
                return (
                  <button
                    key={n.id}
                    onClick={() => onSelect?.(n)}
                    className="flex items-center gap-2.5 rounded-lg border border-outline-variant bg-white px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-background"
                  >
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                    <span className="truncate text-[12.5px] font-medium text-on-surface">{n.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer — Detayı Aç (tam-sayfa kart detayı). Topluluk için detay sayfası yok. */}
      <div className="shrink-0 border-t border-outline-variant px-5 py-3">
        {node.type !== "community" ? (
          <button
            onClick={() => onOpenDetail?.(node)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
          >
            <Icon name="open_in_full" size={15} color="#fff" /> Detayı Aç
          </button>
        ) : (
          <p className="text-center text-[11px] text-on-surface-variant">Bağlı düğüme tıkla → seç</p>
        )}
      </div>
    </aside>
  );
}

function Field({ label, value, multiline }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <div className={`text-[13px] leading-relaxed text-on-surface ${multiline ? "" : "truncate"}`}>
        {value}
      </div>
    </div>
  );
}

function TagsField({ label, tags, color }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}
