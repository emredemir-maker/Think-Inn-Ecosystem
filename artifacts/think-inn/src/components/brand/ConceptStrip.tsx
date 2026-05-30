import { MessageSquareMore, Network, Users, Workflow, BrainCircuit } from "lucide-react";
import { BrandMark } from "./BrandLogo";

/* ════════════════════════════════════════════════════════════════════════
   ConceptStrip — logo konsept sayfasındaki "CONCEPT AT A GLANCE" 5 belirteci.
   variant="hero"   → hero altında, kart şeklinde belirgin şerit
   variant="footer" → sayfa altı ince şerit (marka + telif satırı)
   Renkler brand guide UI kodlamasıyla uyumlu (cyan/mavi/yeşil/mor).
   ════════════════════════════════════════════════════════════════════════ */

const ITEMS: Array<{ icon: any; title: string; tint: string }> = [
  { icon: MessageSquareMore, title: "AI-Öncelikli Sohbet", tint: "#18C9E8" },
  { icon: Network, title: "Bağlı Fikir & Araştırma", tint: "#1463F3" },
  { icon: Users, title: "İşbirlikçi Topluluk", tint: "#20C997" },
  { icon: Workflow, title: "Fikirden Projeye Dönüşüm", tint: "#7A5CFF" },
  { icon: BrainCircuit, title: "Akıllı Orkestratör", tint: "#0E54D8" },
];

export default function ConceptStrip({ variant = "footer" }: { variant?: "footer" | "hero" }) {
  if (variant === "hero") {
    return (
      <section className="concept-hero" aria-label="Bir bakışta konsept">
        <span className="ch-eyebrow">Bir Bakışta Konsept</span>
        <div className="ch-items">
          {ITEMS.map(({ icon: Ic, title, tint }) => (
            <div key={title} className="ch-item">
              <span className="ch-ic" style={{ color: tint, background: tint + "14", borderColor: tint + "33" }}>
                <Ic size={20} strokeWidth={2} />
              </span>
              <span className="ch-label">{title}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // footer (varsayılan)
  return (
    <footer className="concept-strip">
      <div className="cs-inner">
        <div className="cs-brand">
          <BrandMark size={30} />
          <div className="cs-brand-tx">
            <span className="cs-brand-name">think-Inn</span>
            <span className="cs-brand-sub">Bir bakışta konsept</span>
          </div>
        </div>
        <div className="cs-items">
          {ITEMS.map(({ icon: Ic, title, tint }) => (
            <div key={title} className="cs-item">
              <span className="cs-ic" style={{ color: tint, background: tint + "14", borderColor: tint + "33" }}>
                <Ic size={17} strokeWidth={2} />
              </span>
              <span className="cs-label">{title}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cs-baseline">© 2026 think-Inn · AI Innovation Ecosystem</div>
    </footer>
  );
}
