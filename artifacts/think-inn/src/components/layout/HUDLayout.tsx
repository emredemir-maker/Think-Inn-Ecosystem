import { ReactNode, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { AssistantDrawer, AssistantFab } from "./AssistantDrawer";
import { CardDetailView } from "@/components/modals/CardDetailView";
import { BrandLogo } from "@/components/brand/BrandLogo";
import ConceptStrip from "@/components/brand/ConceptStrip";
import type { AssistantContext } from "@/lib/assistant";

type UserRole = "super_admin" | "moderator" | "master" | "user";

type NavItem = {
  key: string;
  label: string;
  icon: string;
  to: string;
  requiresRole?: UserRole;
};

function Icon({
  name,
  className = "",
  filled = false,
  size = 20,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
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

const ROLE_META: Record<UserRole, { label: string; tone: string; icon: string }> = {
  super_admin: { label: "Süper Admin", tone: "bg-error/10 text-error", icon: "shield" },
  moderator: { label: "Moderatör", tone: "bg-tertiary-fixed text-on-tertiary-fixed-variant", icon: "verified_user" },
  master: { label: "Master", tone: "bg-secondary-fixed text-on-secondary-fixed-variant", icon: "workspace_premium" },
  user: { label: "Kullanıcı", tone: "bg-surface-container-high text-on-surface-variant", icon: "person" },
};

/* Public (giriş yapılmamış) modda görünen sayfalar — salt-okunur vitrin */
const PUBLIC_LINKS: NavItem[] = [
  { key: "dashboard", label: "Panel", icon: "dashboard", to: "/" },
  { key: "ideas", label: "Fikirler", icon: "lightbulb", to: "/ideas" },
  { key: "research", label: "Araştırmalar", icon: "biotech", to: "/research" },
  { key: "projects", label: "Projeler", icon: "account_tree", to: "/projects" },
  { key: "map", label: "Harita", icon: "hub", to: "/map" },
];

/* Admin modda ek olarak görünen — Topluluk (henüz public'e açılmadı) */
const ADMIN_ONLY_LINKS: NavItem[] = [
  { key: "community", label: "Topluluk", icon: "groups", to: "/community" },
];

const ADMIN_LINKS: NavItem[] = [
  { key: "admin-users", label: "Kullanıcılar", icon: "manage_accounts", to: "/admin/users", requiresRole: "moderator" },
  { key: "admin-depts", label: "Departmanlar", icon: "business", to: "/admin/departments", requiresRole: "super_admin" },
];

export function HUDLayout({ children }: { children: ReactNode }) {
  const { user, logout, isRole } = useAuth();
  const [location, navigate] = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Asistan revize bağlamı — "AI ile Revize Et" / "Düzenle" butonları context taşır.
  // OrchestratorChat mount gecikmesi nedeniyle event yerine PROP ile geçilir.
  const [assistantContext, setAssistantContext] = useState<AssistantContext | null>(null);
  // Aşağı kaydırınca beliren "başa dön" butonu (ana içerik scroll'una bağlı)
  const [showTop, setShowTop] = useState(false);
  // Tam-sayfa detay (kart tıklanınca .main içeriğini devralır — referans davranışı)
  // view: hangi listeden açıldı → "idea" (Fikirler) fikir yüzü, "project" (Projeler) proje yüzü
  const [cardDetail, setCardDetail] = useState<{ type: "research" | "idea"; id: number; view?: "idea" | "project" } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // İki mod: admin (giriş yapılmış) = içerik ekleyebilir / public = salt-okunur vitrin.
  // LinkedIn'den gelen ziyaretçi giriş yapmamış → public read-only görür.
  const isAdmin = !!user;

  // Nav: public sadece vitrin sayfalarını görür; admin + Topluluk.
  const sideLinks = isAdmin ? [...PUBLIC_LINKS, ...ADMIN_ONLY_LINKS] : PUBLIC_LINKS;

  // Asistanı aç FAB — yalnızca admin (içerik üretir). Public'te gizli (read-only).
  const isWorkspaceRoute = location.startsWith("/workspace");
  const isAuthRoute = location === "/auth";
  const showAssistantFab = isAdmin && !isWorkspaceRoute && !isAuthRoute;

  // "Yeni Fikir" / harici tetikleyiciler asistan drawer'ını açsın.
  // detail.context varsa (revize/düzenle) bağlamı yakala → OrchestratorChat'e prop olarak iner.
  useEffect(() => {
    const handler = (e: Event) => {
      const ctx = (e as CustomEvent<{ context?: AssistantContext }>).detail?.context ?? null;
      setAssistantContext(ctx);
      setAssistantOpen(true);
    };
    window.addEventListener("think-inn:open-assistant", handler);
    return () => window.removeEventListener("think-inn:open-assistant", handler);
  }, []);

  // Kart açma event'i — tam-sayfa detayı tetikler (chat preview, kart grid, harita düğümü hepsi bunu fırlatır)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: "research" | "idea"; id: number; view?: "idea" | "project" }>;
      const { type, id, view } = ce.detail || ({} as any);
      if (!type || !id) return;
      setCardDetail({ type, id, view });
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("think-inn:open-card", handler);
    return () => window.removeEventListener("think-inn:open-card", handler);
  }, []);

  // Sidebar'dan başka sayfaya gidilince detay kapanır + başa dön butonu sıfırlanır
  useEffect(() => {
    setCardDetail(null);
    setShowTop(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location]);

  const roleMeta = user ? ROLE_META[user.role as UserRole] : null;

  const isActive = (item: NavItem) => {
    if (item.to === "/" && location === "/") return true;
    if (item.to.startsWith("/?")) return false;
    return location.startsWith(item.to.split("?")[0]) && item.to !== "/";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-background font-sans">
      {/* ============================== SideNavBar — Hub UI Kit pattern ============================== */}
      <aside className="hidden h-full w-[232px] shrink-0 flex-col bg-white md:flex border-r border-outline-variant px-[18px] py-[22px]">
        {/* Brand mark — think-Inn logosu (ağ ikonu + wordmark + tagline) */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center pb-7 pl-1 pt-1.5 text-left"
          aria-label="think-Inn ana sayfa"
        >
          <BrandLogo size="sm" />
        </button>

        {/* Main nav — public: vitrin sayfaları, admin: + Topluluk */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto custom-scrollbar">
          {sideLinks.map((item) => {
            const active = isActive(item);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.to)}
                className={[
                  "flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-[11px] text-left transition-all duration-200",
                  active
                    ? "border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 font-semibold text-primary shadow-[0_2px_8px_rgba(20,99,243,0.08)]"
                    : "border-transparent font-medium text-on-surface-variant hover:bg-background hover:text-on-surface",
                ].join(" ")}
              >
                <Icon name={item.icon} size={18} filled={active} />
                <span className="text-[14px]">{item.label}</span>
              </button>
            );
          })}

          {ADMIN_LINKS.some((i) => isRole(i.requiresRole!)) && (
            <div className="mt-4 border-t border-outline-variant pt-4">
              <p className="overline mb-2 px-3.5">Yönetim</p>
              {ADMIN_LINKS.filter((i) => isRole(i.requiresRole!)).map((item) => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.to)}
                  className={[
                    "flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-[11px] text-left transition-all duration-200",
                    isActive(item)
                      ? "border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 font-semibold text-primary shadow-[0_2px_8px_rgba(20,99,243,0.08)]"
                      : "border-transparent font-medium text-on-surface-variant hover:bg-background hover:text-on-surface",
                  ].join(" ")}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="text-[14px]">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* CTA — admin: "Yeni Girişim" (asistan), public: "Giriş Yap" */}
        {isAdmin ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("think-inn:open-assistant"))}
            className="mt-4 flex items-center justify-center gap-2 rounded-[12px] bg-primary px-[18px] py-[14px] text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0e54d8] hover:shadow-[0_10px_24px_rgba(20,99,243,0.36)] active:scale-95"
          >
            <Icon name="add" size={18} />
            <span>Yeni Girişim</span>
          </button>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="mt-4 flex items-center justify-center gap-2 rounded-[12px] border border-primary/25 bg-primary/[0.08] px-[18px] py-[14px] text-[14px] font-semibold text-primary transition-all duration-200 hover:bg-primary/[0.14]"
          >
            <Icon name="login" size={18} />
            <span>Yönetici Girişi</span>
          </button>
        )}

        {/* Settings + Help — sadece admin */}
        {isAdmin && (
          <div className="mt-2 space-y-0.5">
            <button className="flex w-full items-center gap-3 rounded-[10px] border border-transparent px-3.5 py-[11px] text-[14px] font-medium text-on-surface-variant transition-all duration-200 hover:bg-background hover:text-on-surface">
              <Icon name="settings" size={18} />
              <span>Ayarlar</span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-[10px] border border-transparent px-3.5 py-[11px] text-[14px] font-medium text-on-surface-variant transition-all duration-200 hover:bg-background hover:text-on-surface">
              <Icon name="help" size={18} />
              <span>Yardım</span>
            </button>
          </div>
        )}
      </aside>

      {/* ============================== Right column: slim top strip + main ============================== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — Hub pattern: search + bell + user */}
        <header className="flex h-[68px] w-full shrink-0 items-center justify-between gap-6 bg-background px-7">
          {/* Search — beyaz, ince border, 14px radius */}
          <div className="relative hidden flex-1 max-w-[560px] md:block">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="text"
              placeholder="Fikir, araştırma veya proje ara..."
              className="w-full rounded-[14px] border border-outline-variant bg-white py-3 pl-11 pr-4 text-[14px] text-on-surface placeholder:text-[#94A0B8] shadow-[0_1px_2px_rgba(7,27,58,0.04)] focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-[18px]">
            {/* Bell — 42px circle with notification dot */}
            <button className="relative flex h-[42px] w-[42px] items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant transition-colors hover:border-outline-strong">
              <Icon name="notifications" size={20} />
              <span className="absolute right-[11px] top-[9px] h-2 w-2 rounded-full bg-error border-2 border-white" />
            </button>

          {user ? (
            <div className="relative flex items-center gap-3 border-l border-outline-variant pl-[14px]">
              <div className="hidden flex-col items-end leading-tight lg:flex">
                <span className="font-heading text-[14px] font-bold text-on-surface">
                  {user.displayName}
                </span>
                {roleMeta && (
                  <span className="overline mt-0.5 text-[10px]">{roleMeta.label}</span>
                )}
              </div>
              <button
                onClick={() => setUserMenuOpen((p) => !p)}
                className="flex h-[42px] w-[42px] items-center justify-center rounded-full brand-gradient text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(20,99,243,0.30)]"
              >
                {user.displayName[0]?.toUpperCase()}
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 z-50 w-64 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/40"
                    >
                      <div className="px-4 py-3 border-b border-outline-variant/40">
                        <p className="font-headline-sm text-body-md font-bold text-on-surface">
                          {user.displayName}
                        </p>
                        <p className="text-[11px] text-outline">@{user.username}</p>
                        {roleMeta && (
                          <span
                            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${roleMeta.tone}`}
                          >
                            <Icon name={roleMeta.icon} size={12} /> {roleMeta.label}
                          </span>
                        )}
                      </div>
                      {isRole("moderator") && (
                        <button
                          onClick={() => { navigate("/admin/users"); setUserMenuOpen(false); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50"
                        >
                          <Icon name="manage_accounts" size={18} /> Kullanıcı Yönetimi
                        </button>
                      )}
                      {isRole("super_admin") && (
                        <button
                          onClick={() => { navigate("/admin/departments"); setUserMenuOpen(false); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50"
                        >
                          <Icon name="business" size={18} /> Departman Yönetimi
                        </button>
                      )}
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-body-sm text-body-sm text-error transition-colors hover:bg-error/10"
                      >
                        <Icon name="logout" size={18} /> Çıkış Yap
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary shadow-[0_4px_12px_rgba(20,99,243,0.30)] transition-all hover:opacity-90 active:scale-95"
            >
              <Icon name="login" size={16} />
              Giriş Yap
            </button>
          )}
          </div>
        </header>

        {/* Main content — kart detayı açıksa içeriği devralır (sidebar + topbar kalır) */}
        <main
          ref={mainRef}
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 320)}
          className="flex-1 overflow-y-auto pb-16 md:pb-0"
        >
          {cardDetail ? (
            <CardDetailView key={`${cardDetail.type}-${cardDetail.id}-${cardDetail.view ?? "auto"}`} detail={cardDetail} onClose={() => setCardDetail(null)} />
          ) : (
            children
          )}
          {/* Konsept şeridi — sayfa altı footer (dashboard'da hero altında olduğu için orada gizli; harita immersive) */}
          {location !== "/" && !location.startsWith("/map") && <ConceptStrip />}
        </main>
      </div>

      {/* ============================== AI Asistanı — FAB + Drawer ============================== */}
      {showAssistantFab && <AssistantFab onClick={() => { setAssistantContext(null); setAssistantOpen(true); }} />}
      <AssistantDrawer
        open={assistantOpen}
        context={assistantContext}
        onClose={() => { setAssistantOpen(false); setAssistantContext(null); }}
      />

      {/* Başa dön — aşağı kaydırınca belirir; asistan FAB varsa onun üstüne yığılır */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className={[
              "fixed right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface shadow-[0_8px_24px_rgba(7,27,58,0.16)] transition-colors hover:text-primary",
              "bottom-20",
              showAssistantFab ? "md:bottom-[88px]" : "md:bottom-6",
            ].join(" ")}
            aria-label="Başa dön"
            title="Başa dön"
          >
            <Icon name="arrow_upward" size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 z-40 flex h-16 w-full items-center justify-around bg-surface-container-lowest px-4 shadow-[0_-4px_20px_rgba(7,27,58,0.08)] md:hidden border-t border-outline-variant/30">
        {sideLinks.slice(0, 5).map((item, idx) => {
          const active = isActive(item);
          const isMid = idx === 2;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.to)}
              className={[
                "flex flex-col items-center justify-center gap-0.5 transition-all",
                isMid && active
                  ? "-mt-6 h-12 w-12 rounded-full bg-primary text-on-primary shadow-xl"
                  : active
                  ? "text-primary"
                  : "text-on-surface-variant",
              ].join(" ")}
            >
              <Icon name={item.icon} size={isMid && active ? 22 : 20} filled={active} />
              {!(isMid && active) && (
                <span className="text-[10px] font-bold">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
