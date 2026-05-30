import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Eye, EyeOff, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo, BrandMark, Wordmark } from "@/components/brand/BrandLogo";

/* Material Symbols ikon (brand hub ikonları için) */
function Icon({ name, size = 18, filled = false, className = "" }: {
  name: string; size?: number; filled?: boolean; className?: string;
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

/* Sol panelde gösterilen marka özellikleri */
const HIGHLIGHTS = [
  { icon: "lightbulb", label: "Fikirler", desc: "Olgunluk skoruyla fikir kütüphanesi" },
  { icon: "biotech", label: "Araştırmalar", desc: "AI özetli kaynaklar, fikirlere bağlı" },
  { icon: "account_tree", label: "Projeler", desc: "Mimari analizden lansmana" },
  { icon: "hub", label: "Ekosistem Haritası", desc: "Tüm bağlantılar tek grafta" },
];

export default function AuthPage() {
  const { user, login, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zaten giriş yapılmışsa panele yönlendir
  useEffect(() => {
    if (!authLoading && user) navigate("/");
  }, [user, authLoading, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız. Bilgileri kontrol edin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      {/* ════════ Sol panel — brand gradient showcase (sadece geniş ekran) ════════ */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-14 lg:flex"
        style={{ width: "50%", flex: "0 0 50%" }}
      >
        {/* Brand gradient zemin */}
        <div className="brand-gradient absolute inset-0" />
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* Yumuşak ışık lekeleri */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        {/* Logo — koyu gradient panelde beyaz chip + beyaz wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <BrandMark size={30} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Wordmark fontSize={22} onDark />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              AI Innovation Ecosystem
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display text-[44px] font-bold leading-[1.08] tracking-[-0.025em] text-white"
            >
              Her fikir bir<br />sohbetle başlar.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="text-[15px] leading-relaxed text-white/85"
              style={{ maxWidth: 440 }}
            >
              Kurumsal inovasyon ekosistemin: fikirleri, araştırmaları ve projeleri
              AI orkestratörü ile yapılandır, olgunlaştır ve görselleştir.
            </motion.p>
          </div>

          {/* Özellik kartları */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="grid grid-cols-2 gap-3"
          >
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.label}
                className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon name={h.icon} size={18} className="text-white" filled />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-white">{h.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-white/70">{h.desc}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Alt bilgi */}
        <div className="relative z-10 flex items-center gap-6 text-[12px] text-white/70">
          <span className="flex items-center gap-1.5">
            <Icon name="shield" size={14} /> Güvenli erişim
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="auto_awesome" size={14} /> Gemini 3.5
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="workspace_premium" size={14} /> Kurumsal
          </span>
        </div>
      </div>

      {/* ════════ Sağ panel — login kartı ════════ */}
      <div
        className="relative flex items-center justify-center px-6 py-10"
        style={{ flex: "1 1 0%", minWidth: 0 }}
      >
        {/* Mobil için hafif dot zemin */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50 lg:hidden"
          style={{
            backgroundImage: "radial-gradient(rgba(20,99,243,0.10) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10"
          style={{ width: "100%", maxWidth: 420 }}
        >
          {/* Mobil logo */}
          <div className="mb-8 flex items-center justify-center lg:hidden">
            <BrandLogo size="sm" />
          </div>

          {/* Kart */}
          <div className="rounded-[24px] border border-outline-variant bg-white p-8 shadow-[0_18px_50px_rgba(7,27,58,0.10)]">
            {/* Header */}
            <div className="mb-6">
              <span className="eyebrow">Yönetici Erişimi</span>
              <h2 className="mt-2 font-display text-[26px] font-bold tracking-[-0.02em] text-on-surface">
                Tekrar hoş geldin
              </h2>
              <p className="mt-1.5 text-[14px] text-on-surface-variant">
                İçerik yönetmek için yönetici hesabınla giriş yap.
              </p>
            </div>

            {/* Hata */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mb-4 flex items-center gap-2 rounded-xl border border-error/25 bg-error-container/40 px-3.5 py-2.5 text-[13px] font-medium text-error"
                >
                  <AlertCircle size={15} className="shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* E-posta */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-on-surface">E-posta</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@infoset.app"
                    autoComplete="email"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-3 pl-11 pr-4 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-all focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              {/* Şifre */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-on-surface">Şifre</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-3 pl-11 pr-11 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-all focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Giriş butonu */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8] hover:shadow-[0_10px_24px_rgba(20,99,243,0.36)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <motion.div
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                ) : (
                  <>
                    <span>Giriş Yap</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Public bilgi notu */}
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
              <Icon name="visibility" size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
              <p className="text-[12px] leading-relaxed text-on-surface-variant">
                Yalnızca yöneticiler içerik ekleyip düzenleyebilir. Ziyaretçiler fikirleri,
                araştırmaları ve projeleri salt-okunur görüntüler.
              </p>
            </div>
          </div>

          {/* Geri dön */}
          <button
            onClick={() => navigate("/")}
            className="mx-auto mt-6 flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowRight size={14} className="rotate-180" />
            Vitrine geri dön
          </button>
        </motion.div>
      </div>
    </div>
  );
}
