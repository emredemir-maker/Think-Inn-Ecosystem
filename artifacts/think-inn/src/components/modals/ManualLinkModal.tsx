import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { X, Search, Sparkles, CheckCircle2, AlertTriangle, Loader2, Link2 } from "lucide-react";
import type { Research } from "@workspace/api-client-react";
import { API_ORIGIN } from "@/lib/api-config";

/**
 * ManualLinkModal — Admin bir fikre MANUEL olarak araştırma bağlar.
 * Akış: araştırma seç → AI doğrulama (validate-connection) → güven skoru göster
 *       → "Bağla" → PUT /api/ideas/:id (researchIds güncelle) → cache invalidate.
 *
 * Backend mantığına dokunmaz; mevcut endpoint'leri kullanır.
 */
type Validation = { valid: boolean; confidence: number; reason: string } | null;

export function ManualLinkModal({
  ideaId,
  ideaTitle,
  currentResearchIds,
  allResearch,
  onClose,
}: {
  ideaId: number;
  ideaTitle: string;
  currentResearchIds: number[];
  allResearch: Research[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Research | null>(null);
  const [validation, setValidation] = useState<Validation>(null);
  const [validating, setValidating] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Henüz bağlı OLMAYAN araştırmalar
  const available = useMemo(() => {
    const linked = new Set(currentResearchIds);
    const q = search.toLowerCase().trim();
    return allResearch
      .filter((r) => !linked.has(r.id))
      .filter((r) =>
        !q ? true : r.title.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q)
      );
  }, [allResearch, currentResearchIds, search]);

  // Araştırma seçilince AI doğrulaması
  async function pick(r: Research) {
    setSelected(r);
    setValidation(null);
    setError(null);
    setValidating(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/validate-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ researchId: r.id, ideaId }),
      });
      const data = await res.json();
      setValidation({
        valid: Boolean(data.valid),
        confidence: Number(data.confidence) || 50,
        reason: data.reason || "Değerlendirme alınamadı.",
      });
    } catch {
      // Doğrulama servisi başarısız → yine de bağlamaya izin ver
      setValidation({ valid: true, confidence: 50, reason: "Doğrulama yapılamadı, manuel bağlanabilir." });
    } finally {
      setValidating(false);
    }
  }

  // Bağlantıyı kaydet
  async function confirmLink() {
    if (!selected) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`${API_ORIGIN}/api/ideas/${ideaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ researchIds: [...currentResearchIds, selected.id] }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Bağlantı kaydedilemedi (${res.status})${t ? ": " + t.slice(0, 120) : ""}`);
      }
      // İlgili listeleri tazele → kart anında güncel görünsün
      qc.invalidateQueries({ queryKey: ["/api/ideas"] });
      qc.invalidateQueries({ queryKey: ["/api/research"] });
      qc.refetchQueries({ queryKey: ["/api/ideas"] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bağlantı kaydedilemedi.");
    } finally {
      setLinking(false);
    }
  }

  const confColor = (c: number) => (c >= 70 ? "#22C55E" : c >= 45 ? "#FFB020" : "#EF4444");

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#071B3A]/40 backdrop-blur-sm"
        />
        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          style={{ width: "100%", maxWidth: 520 }}
          className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-[18px] border border-outline-variant bg-white shadow-[0_28px_90px_rgba(7,27,58,0.18)]"
        >
          <div className="h-1 w-full shrink-0 brand-gradient" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                <Link2 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Manuel Bağlantı</span>
              </div>
              <h3 className="mt-1 truncate font-heading text-[16px] font-bold text-on-surface">
                "{ideaTitle}" fikrine araştırma bağla
              </h3>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-background"
            >
              <X size={16} />
            </button>
          </div>

          {/* Arama */}
          <div className="border-b border-outline-variant px-5 py-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Araştırma ara..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-2.5 pl-9 pr-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto px-5 py-3 custom-scrollbar">
            {available.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-on-surface-variant">
                {allResearch.length === 0
                  ? "Henüz araştırma yok. Önce AI asistanıyla araştırma ekle."
                  : "Bağlanacak başka araştırma kalmadı."}
              </div>
            ) : (
              <div className="space-y-2">
                {available.map((r) => {
                  const active = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => pick(r)}
                      className={[
                        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary/[0.06]"
                          : "border-outline-variant bg-white hover:border-primary/30 hover:bg-background",
                      ].join(" ")}
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "rgba(24,201,232,0.12)", color: "#0A8FA8" }}
                      >
                        <Sparkles size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold leading-snug text-on-surface">{r.title}</p>
                        {r.summary && (
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">
                            {r.summary}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI doğrulama + bağla */}
          {selected && (
            <div className="shrink-0 border-t border-outline-variant bg-surface-container-low px-5 py-4">
              {validating ? (
                <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                  <Loader2 size={15} className="animate-spin text-primary" />
                  AI bağlantıyı değerlendiriyor...
                </div>
              ) : validation ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    {validation.valid ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: confColor(validation.confidence) }} />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-risk" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-on-surface">
                          %{validation.confidence} uyum
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: `${confColor(validation.confidence)}1f`,
                            color: confColor(validation.confidence),
                          }}
                        >
                          {validation.valid ? "Uygun" : "Zayıf eşleşme"}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">
                        {validation.reason}
                      </p>
                    </div>
                  </div>

                  {error && (
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-error">
                      <AlertTriangle size={13} /> {error}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelected(null); setValidation(null); }}
                      className="flex-1 rounded-xl border border-outline-variant bg-white py-2.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:bg-background"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={confirmLink}
                      disabled={linking}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(20,99,243,0.30)] transition-all hover:bg-[#0e54d8] disabled:opacity-60"
                    >
                      {linking ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <>
                          <Link2 size={15} />
                          {validation.valid ? "Bağla" : "Yine de bağla"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
