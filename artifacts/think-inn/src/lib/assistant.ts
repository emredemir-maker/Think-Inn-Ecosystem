/* ════════════════════════════════════════════════════════════════════════
   Bağlam-farkında AI asistanı — revize/düzenle akışı.
   "AI ile Revize Et" / "Düzenle" butonları asistanı BAĞLAMLA açar:
   hangi öğe (fikir/proje), hangi bölüm (fonksiyonel/teknik/mimari/akış/tüm proje).
   Asistan bu bağlama göre yönlendirici bir soru sorar ve düzenlemeyi yapar.
   ════════════════════════════════════════════════════════════════════════ */

// section "project" → asistan önce "hangi bölüm?" diye sorar (bölüm seçtirir)
export type ReviseSection =
  | "functional"
  | "technical"
  | "architecturalPlan"
  | "flow"
  | "all"
  | "project";

export interface AssistantContext {
  intent: "revise";
  entityType: "project" | "idea";
  entityId: number;
  entityTitle: string;
  section: ReviseSection;
}

/** Asistanı verilen revize bağlamıyla aç (HUDLayout dinler → drawer açılır + context props). */
export function openAssistantRevise(ctx: AssistantContext) {
  window.dispatchEvent(new CustomEvent("think-inn:open-assistant", { detail: { context: ctx } }));
}

export const SECTION_LABEL: Record<ReviseSection, string> = {
  functional: "Fonksiyonel Analiz",
  technical: "Teknik Analiz",
  architecturalPlan: "Mimari Plan",
  flow: "Akış Şeması",
  all: "Tüm Proje",
  project: "Proje",
};
