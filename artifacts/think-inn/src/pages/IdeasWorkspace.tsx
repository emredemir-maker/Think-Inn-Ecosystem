import { useMemo } from "react";
import { useListIdeas, useListResearch } from "@workspace/api-client-react";
import { OrchestratorChat } from "@/components/chat/OrchestratorChat";

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
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}

/* Sağ kenar: en son eklenen fikir + canlı insight'lar (gerçek DB verisi) */
function IdeaDraftCard() {
  const { data: ideaList } = useListIdeas();
  const { data: researchList } = useListResearch();
  const ideas = ideaList ?? [];
  const research = researchList ?? [];

  const latestIdea = useMemo(
    () =>
      ideas.length
        ? [...ideas].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0]
        : null,
    [ideas]
  );

  // Canlı insight'lar: gerçek bağlantı sayıları üzerinden türetilir, mock değil
  const insights: string[] = useMemo(() => {
    const list: string[] = [];
    if (latestIdea) {
      if ((latestIdea.relatedTo?.length ?? 0) === 0) {
        list.push("Henüz başka fikre bağlanmamış. Harita'dan ilişki kurabilirsin.");
      } else {
        list.push(`Bu fikir ${latestIdea.relatedTo!.length} fikre bağlı.`);
      }
      if ((latestIdea.researchIds?.length ?? 0) === 0) {
        list.push("Destekleyici araştırma yok — araştırma metni paylaşmayı dene.");
      } else {
        list.push(
          `${latestIdea.researchIds!.length} araştırma bu fikri besliyor.`
        );
      }
    } else {
      list.push("Henüz aktif fikir yok. Sohbete bir fikir yapıştır, ben analiz edip kaydedeyim.");
      if (research.length > 0) {
        list.push(`${research.length} araştırma kütüphanende, ilk fikrini bağlayabiliriz.`);
      }
    }
    return list;
  }, [latestIdea, research.length]);

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col gap-4 overflow-y-auto bg-surface px-4 py-4 border-l border-outline-variant/40 xl:flex custom-scrollbar">
      {/* IDEA DRAFT card */}
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

        <header className="flex items-start justify-between mb-3">
          <h3 className="font-label-md text-label-md font-bold uppercase tracking-widest text-on-surface-variant">
            Idea Draft
          </h3>

          {/* Hexagon score (relatedTo + researchIds toplamı; gerçek veri, mock değil) */}
          <div
            className="flex h-14 w-12 flex-col items-center justify-center bg-gradient-to-br from-tertiary-fixed-dim to-primary text-white shadow-md"
            style={{
              clipPath:
                "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
            }}
          >
            <span className="text-[9px] font-bold opacity-80 leading-none">
              SKOR
            </span>
            <span className="text-body-md font-bold leading-none">
              {latestIdea
                ? (latestIdea.voteCount ?? 0) +
                  (latestIdea.relatedTo?.length ?? 0) +
                  (latestIdea.researchIds?.length ?? 0)
                : 0}
            </span>
          </div>
        </header>

        {latestIdea ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="font-label-md text-label-md text-outline block mb-1 uppercase tracking-wider">
                  Başlık
                </label>
                <h4 className="font-headline-sm text-body-md font-bold text-on-surface leading-tight">
                  {latestIdea.title}
                </h4>
              </div>

              <div>
                <label className="font-label-md text-label-md text-outline block mb-1 uppercase tracking-wider">
                  Özet
                </label>
                <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-4">
                  {latestIdea.description}
                </p>
              </div>

              {latestIdea.tags && latestIdea.tags.length > 0 && (
                <div className="border-t border-outline-variant/30 pt-3">
                  <label className="font-label-md text-label-md text-outline block mb-2 uppercase tracking-wider">
                    Etiketler
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {latestIdea.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-outline-variant/30 bg-surface-variant/40 px-2.5 py-1 text-[11px] font-bold text-on-surface-variant"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-outline-variant/30 pt-3 space-y-2">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-md text-label-md">İlişkili Fikir</span>
                  <span className="text-body-sm font-bold text-primary">
                    {latestIdea.relatedTo?.length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-md text-label-md">Araştırma</span>
                  <span className="text-body-sm font-bold text-tertiary">
                    {latestIdea.researchIds?.length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-md text-label-md">Oy</span>
                  <span className="text-body-sm font-bold text-on-surface">
                    {latestIdea.voteCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-on-surface py-2.5 font-bold text-white text-label-md font-label-md transition-all hover:opacity-90 active:scale-95">
              <Icon name="open_in_new" size={16} />
              Detayları Aç
            </button>
          </>
        ) : (
          <div className="py-6 text-center">
            <Icon
              name="edit_note"
              size={36}
              className="text-outline mx-auto mb-2"
            />
            <h4 className="font-headline-sm text-body-md font-bold text-on-surface mb-1">
              Henüz aktif taslak yok
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sohbete bir fikir veya araştırma metni paylaş, ilk taslağın burada şekillenecek.
            </p>
          </div>
        )}
      </div>

      {/* Live AI Insights */}
      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Icon name="insights" size={18} />
          <h4 className="font-label-md text-label-md font-bold uppercase tracking-wider">
            Live AI Insights
          </h4>
        </div>
        <ul className="space-y-2">
          {insights.map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary-fixed-dim" />
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* Ideas Workspace — mockup'taki "chat + draft" sayfası */
export default function IdeasWorkspace() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Üst başlık — "Ideas Workspace" + Share Session */}
      <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface px-6 py-3">
        <div className="flex items-center gap-2 text-primary">
          <Icon name="lightbulb" size={18} filled />
          <h1 className="font-headline-sm text-headline-sm font-bold tracking-tight">
            Ideas Workspace
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant/50">
            <Icon name="notifications" size={18} />
          </button>
          <button className="flex items-center gap-1.5 rounded-full bg-primary-container/10 px-3 py-1.5 text-label-md font-label-md font-bold text-primary border border-primary/15 transition-all hover:bg-primary-container/20">
            <Icon name="share" size={14} />
            Share Session
          </button>
        </div>
      </header>

      {/* Gövde — chat (sol) + draft card (sağ) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat — ana kolon */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <OrchestratorChat />
        </div>

        {/* Sağ aside: gerçek-zamanlı taslak + insight'lar */}
        <IdeaDraftCard />
      </div>
    </div>
  );
}
