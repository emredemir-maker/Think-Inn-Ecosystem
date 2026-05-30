import { MessageSquareMore, Network, Users, Workflow, BrainCircuit } from "lucide-react";
import { BrandMark } from "./BrandLogo";

/* ════════════════════════════════════════════════════════════════════════
   ConceptStrip — logo konsept sayfasındaki "CONCEPT AT A GLANCE" 5 belirteci.
   Sayfa altı (footer) şeridi olarak kullanılır. Her belirteç: ikon + başlık.
   ════════════════════════════════════════════════════════════════════════ */

const ITEMS: Array<{ icon: any; title: string; tint: string }> = [
  { icon: MessageSquareMore, title: "AI-Öncelikli Sohbet", tint: "#18C9E8" },
  { icon: Network, title: "Bağlı Fikir & Araştırma", tint: "#1463F3" },
  { icon: Users, title: "İşbirlikçi Topluluk", tint: "#20C997" },
  { icon: Workflow, title: "Fikirden Projeye Dönüşüm", tint: "#7A5CFF" },
  { icon: BrainCircuit, title: "Akıllı Orkestratör", tint: "#0E54D8" },
];

export default function ConceptStrip() {
  const year = 2026; // sabit — derleme anında değil, marka altbilgisi
  return (
    <footer className="concept-strip">
      <div className="cs-inner">
        {/* Sol: marka + bir bakışta etiketi */}
        <div className="cs-brand">
          <BrandMark size={30} />
          <div className="cs-brand-tx">
            <span className="cs-brand-name">think-Inn</span>
            <span className="cs-brand-sub">Bir bakışta konsept</span>
          </div>
        </div>

        {/* Orta: 5 belirteç */}
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

      <div className="cs-baseline">
        © {year} think-Inn · AI Innovation Ecosystem
      </div>
    </footer>
  );
}
