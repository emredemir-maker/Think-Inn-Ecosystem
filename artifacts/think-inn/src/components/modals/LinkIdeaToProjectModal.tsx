import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { X, Search, Lightbulb, Loader2, Plus, Check } from "lucide-react";
import type { Idea } from "@workspace/api-client-react";
import { API_ORIGIN } from "@/lib/api-config";

/**
 * LinkIdeaToProjectModal — Admin bir PROJEYE birden fazla FİKİR bağlar (many-to-one).
 * Bağlama yönü: katkı veren fikrin relatedTo'suna proje id'si eklenir (fikir → projeyi besler).
 * Birden çok fikri tek tek "Bağla" ile ekleyebilir; PUT /api/ideas/:ideaId kullanır.
 */
export function LinkIdeaToProjectModal({
  projectId, projectTitle, allIdeas, onClose,
}: {
  projectId: number;
  projectTitle: string;
  allIdeas: Idea[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [justLinked, setJustLinked] = useState<Set<number>>(new Set());

  // Projeye zaten bağlı (besleyen) fikirler
  const linkedIds = useMemo(
    () => new Set(allIdeas.filter((i) => ((i as any).relatedTo ?? []).includes(projectId)).map((i) => i.id)),
    [allIdeas, projectId]
  );

  // Bağlanabilir saf fikirler — bu projenin kendisi değil, projeleşmemiş, henüz bağlı değil
  const available = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allIdeas
      .filter((i) => i.id !== projectId && !(i as any).architecturalAnalysis && !linkedIds.has(i.id))
      .filter((i) => (!q ? true : i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)));
  }, [allIdeas, projectId, linkedIds, search]);

  async function link(i: Idea) {
    setBusyId(i.id);
    try {
      const rel = Array.from(new Set([...(((i as any).relatedTo as number[]) ?? []), projectId]));
      const res = await fetch(`${API_ORIGIN}/api/ideas/${i.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ relatedTo: rel }),
      });
      if (res.ok) {
        setJustLinked((s) => new Set(s).add(i.id));
        qc.invalidateQueries({ queryKey: ["/api/ideas"] });
        await qc.refetchQueries({ queryKey: ["/api/ideas"] });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-[#071B3A]/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
          style={{ width: "100%", maxWidth: 520 }}
          className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-[18px] border border-outline-variant bg-white shadow-[0_28px_90px_rgba(7,27,58,0.18)]"
        >
          <div className="h-1 w-full shrink-0 brand-gradient" />
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-secondary">
                <Lightbulb size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Projeye Fikir Bağla</span>
              </div>
              <h3 className="mt-1 truncate font-heading text-[16px] font-bold text-on-surface">
                "{projectTitle}" projesini besleyen fikirler
              </h3>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-background">
              <X size={16} />
            </button>
          </div>

          <div className="border-b border-outline-variant px-5 py-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Fikir ara..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-2.5 pl-9 pr-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 custom-scrollbar">
            {available.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-on-surface-variant">
                Bağlanacak başka (projeleşmemiş) fikir yok.
              </div>
            ) : (
              <div className="space-y-2">
                {available.map((i) => {
                  const linked = justLinked.has(i.id);
                  return (
                    <div key={i.id} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-white px-3.5 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(20,99,243,0.10)", color: "#0E54D8" }}>
                        <Lightbulb size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-on-surface">{i.title}</p>
                        {i.description && <p className="line-clamp-1 text-[12px] text-on-surface-variant">{i.description}</p>}
                      </div>
                      <button
                        onClick={() => link(i)}
                        disabled={busyId === i.id || linked}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-[12px] font-semibold text-primary transition-all hover:bg-primary/[0.16] disabled:opacity-60"
                      >
                        {busyId === i.id ? <Loader2 size={13} className="animate-spin" /> : linked ? <Check size={13} /> : <Plus size={13} />}
                        {linked ? "Bağlandı" : "Bağla"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-outline-variant px-5 py-3 text-right">
            <button onClick={onClose} className="rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0e54d8]">
              Bitti
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
