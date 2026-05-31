import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OrchestratorChat } from "@/components/chat/OrchestratorChat";
import type { AssistantContext } from "@/lib/assistant";

/* Material Symbols ikon */
function Icon({
  name,
  size = 20,
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

/**
 * Global AI asistanı drawer'ı — Hub UI Kit ChatDrawer pattern.
 *
 * Yüzen "Asistanı aç" FAB butonuna tıklayınca sağdan slide-in olur.
 * İçeride mevcut OrchestratorChat çalışır → tüm Gemini entegrasyonu,
 * konversasyon geçmişi, custom `think-inn:send-message` event'i korunur.
 *
 * `/workspace` route'u hâlâ ayrı bir tam sayfa görünüm olarak kalır;
 * drawer hızlı erişim için.
 */
export function AssistantDrawer({ open, context, onClose }: { open: boolean; context?: AssistantContext | null; onClose: () => void }) {
  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#071B3A]/35 backdrop-blur-[2px]"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col bg-white shadow-[0_18px_60px_rgba(7,27,58,0.18)]"
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_rgba(20,99,243,0.30)]">
                  <Icon name="auto_awesome" size={18} filled />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-heading text-[15px] font-bold text-on-surface">
                    İnovasyon Asistanı
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
                    <span className="size-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    Çevrimiçi · Gemini 3.5
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-background"
                  title="Tam ekranda aç"
                  onClick={() => {
                    onClose();
                    // İsteğe bağlı: tam ekrana yönlendir
                    window.location.assign("/workspace");
                  }}
                >
                  <Icon name="open_in_full" size={18} />
                </button>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-background"
                  title="Kapat (Esc)"
                  onClick={onClose}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            </header>

            {/* Body — mevcut OrchestratorChat'i sar
                Tüm Gemini bağlantısı, useChatStream, conversation history burada çalışır */}
            <div className="flex-1 overflow-hidden">
              <OrchestratorChat reviseContext={context ?? null} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Sağ altta yüzen "Asistanı aç" FAB butonu — tasarım sistemindeki brand gradient pill.
 */
export function AssistantFab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", damping: 18, stiffness: 260 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="brand-gradient fixed bottom-6 right-6 z-30 flex items-center gap-2.5 rounded-full px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(20,99,243,0.35),0_4px_10px_rgba(122,92,255,0.20)]"
      aria-label="AI Asistanı aç"
    >
      <Icon name="auto_awesome" size={20} filled />
      <span>Asistanı aç</span>
    </motion.button>
  );
}
