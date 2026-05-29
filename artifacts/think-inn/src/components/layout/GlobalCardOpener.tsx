import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListResearch, useListIdeas, type Research, type Idea } from "@workspace/api-client-react";
import { CardDetailModal } from "@/components/modals/CardDetailModal";
import { ProjectAnalysisModal } from "@/components/modals/ProjectAnalysisModal";

/**
 * Uygulamanın tamamında "think-inn:open-card" event'i fırlatıldığında
 * (örn. chat'te savedItems badge'ine tıklandığında) ilgili
 * CardDetailModal'ı açar.
 *
 * Event payload: { type: "research" | "idea", id: number }
 */
export function GlobalCardOpener() {
  const [detail, setDetail] = useState<{ id: number; type: "research" | "idea" } | null>(null);
  const [projectIdeaId, setProjectIdeaId] = useState<number | null>(null);

  const { data: researchList } = useListResearch();
  const { data: ideaList } = useListIdeas();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: "research" | "idea"; id: number }>;
      const { type, id } = ce.detail || {};
      if (!type || !id) return;
      setDetail({ type, id });
      // Cache invalidate — kart güncel veriyle açılsın
      queryClient.invalidateQueries({ queryKey: [`/api/${type === "research" ? "research" : "ideas"}`] });
    };
    window.addEventListener("think-inn:open-card", handler);
    return () => window.removeEventListener("think-inn:open-card", handler);
  }, [queryClient]);

  // Canlı item — liste güncellendikçe modal'da yansır
  const liveItem = detail
    ? detail.type === "research"
      ? (researchList ?? []).find((r) => r.id === detail.id) ?? null
      : (ideaList ?? []).find((i) => i.id === detail.id) ?? null
    : null;

  const activeIdea = projectIdeaId
    ? (ideaList ?? []).find((i) => i.id === projectIdeaId)
    : null;

  return (
    <>
      {liveItem && detail && (
        <CardDetailModal
          item={liveItem as Research | Idea}
          type={detail.type}
          allResearch={researchList ?? []}
          onClose={() => setDetail(null)}
          onOpenProject={(ideaId) => {
            setDetail(null);
            setProjectIdeaId(ideaId);
          }}
        />
      )}

      {activeIdea && (
        <ProjectAnalysisModal
          idea={activeIdea as Idea}
          onClose={() => setProjectIdeaId(null)}
        />
      )}
    </>
  );
}
