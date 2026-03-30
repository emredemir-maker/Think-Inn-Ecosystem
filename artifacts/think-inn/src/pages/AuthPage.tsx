import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, Lightbulb, Users, BookOpen, Sparkles,
  ArrowRight, Shield, Zap, Network, Lock, User, Mail,
  AtSign, ChevronRight, Star
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ── Star field ────────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.7 + 0.1,
  duration: Math.random() * 4 + 2,
}));

// ── Features list ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Lightbulb, color: "#6366f1", label: "Fikir Yönetimi", desc: "Fikirlerini kaydet, geliştir ve değerlendir" },
  { icon: BookOpen,  color: "#34d399", label: "Araştırma Merkezi", desc: "Pazar araştırmalarını organize et" },
  { icon: Network,   color: "#f59e0b", label: "İlişki Grafiği", desc: "Fikirler arası bağlantıları görselleştir" },
  { icon: Users,     color: "#ec4899", label: "Topluluk", desc: "Fikirlerini toplulukla tartış" },
];

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all relative"
      style={{
        color: active ? "#fff" : "rgba(255,255,255,0.4)",
        background: active ? "rgba(99,102,241,0.2)" : "transparent",
        border: active ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
      }}
    >
      {children}
      {active && (
        <motion.div
          layoutId="tab-active"
          className="absolute inset-0 rounded-lg -z-10"
          style={{ background: "rgba(99,102,241,0.08)" }}
        />
      )}
    </button>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────

function Field({
  icon: Icon, label, type = "text", value, onChange, placeholder, autoComplete,
}: {
  icon: React.ElementType; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          }}
          onFocus={e => { (e.target.parentElement!.querySelector("input") as HTMLInputElement).style.borderColor = "rgba(99,102,241,0.5)"; }}
          onBlur={e => { (e.target.parentElement!.querySelector("input") as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { user, login, register, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regUsername, setRegUsername] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) navigate("/");
  }, [user, authLoading, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ username: regUsername, displayName: regDisplayName, email: regEmail, password: regPassword });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex overflow-hidden"
      style={{ background: "radial-gradient(ellipse 120% 80% at 50% 0%, #0a0e2e 0%, #04050f 55%, #000008 100%)" }}
    >
      {/* Star field */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {STARS.map(s => (
          <motion.div
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size,
              background: "#fff",
            }}
            animate={{ opacity: [s.opacity, s.opacity * 0.3, s.opacity] }}
            transition={{ duration: s.duration, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Nebula glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)" }} />
      </div>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] px-16 py-14 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}
          >
            <Lightbulb size={18} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">Think-Inn</span>
            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>BETA</span>
          </div>
        </div>

        {/* Hero */}
        <div className="space-y-8">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}
            >
              <Star size={11} fill="#a5b4fc" /> Fikir Yönetim Platformu
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-5xl font-bold leading-tight"
              style={{ color: "#fff" }}
            >
              Fikirlerini<br />
              <span style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                hayata geçir
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base leading-relaxed max-w-md"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Fikirlerini kaydet, araştır, değerlendir ve toplulukla tartış. Yapay zeka destekli analiz ile her fikri potansiyele dönüştür.
            </motion.p>
          </div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 gap-3"
          >
            {FEATURES.map(({ icon: Icon, color, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon size={13} style={{ color }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{desc}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-6">
          {[
            { icon: Shield, text: "Güvenli" },
            { icon: Zap, text: "Gemini 2.5 AI" },
            { icon: Sparkles, text: "Ücretsiz" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              <Icon size={12} /> {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Lightbulb size={16} className="text-white" />
            </div>
            <span className="text-white font-bold">Think-Inn</span>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">
                {tab === "login" ? "Tekrar hoş geldin" : "Aramıza katıl"}
              </h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {tab === "login"
                  ? "Hesabına giriş yaparak devam et"
                  : "Ücretsiz hesap oluştur, hemen başla"
                }
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.03)" }}>
              <TabBtn active={tab === "login"} onClick={() => { setTab("login"); setError(null); }}>Giriş Yap</TabBtn>
              <TabBtn active={tab === "register"} onClick={() => { setTab("register"); setError(null); }}>Kayıt Ol</TabBtn>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mb-4 px-3 py-2.5 rounded-lg text-sm flex items-center gap-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
                >
                  <Lock size={13} className="flex-shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <Field icon={Mail} label="E-posta" type="email" value={loginEmail} onChange={setLoginEmail} placeholder="ornek@email.com" autoComplete="email" />
                  <Field icon={Lock} label="Şifre" type="password" value={loginPassword} onChange={setLoginPassword} placeholder="••••••••" autoComplete="current-password" />

                  <button
                    type="submit"
                    disabled={loading || !loginEmail || !loginPassword}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-2"
                    style={{
                      background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      boxShadow: loading ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
                      opacity: (!loginEmail || !loginPassword) ? 0.5 : 1,
                    }}
                  >
                    {loading ? (
                      <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                    ) : (
                      <><span>Giriş Yap</span><ArrowRight size={15} /></>
                    )}
                  </button>

                  <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Hesabın yok mu?{" "}
                    <button type="button" onClick={() => setTab("register")} className="font-semibold transition-colors" style={{ color: "#818cf8" }}>
                      Kayıt ol
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRegister}
                  className="space-y-3.5"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Field icon={AtSign} label="Kullanıcı adı" value={regUsername} onChange={setRegUsername} placeholder="kullanici_adi" autoComplete="username" />
                    <Field icon={User} label="Görünen ad" value={regDisplayName} onChange={setRegDisplayName} placeholder="Ad Soyad" autoComplete="name" />
                  </div>
                  <Field icon={Mail} label="E-posta" type="email" value={regEmail} onChange={setRegEmail} placeholder="ornek@email.com" autoComplete="email" />
                  <Field icon={Lock} label="Şifre" type="password" value={regPassword} onChange={setRegPassword} placeholder="En az 8 karakter" autoComplete="new-password" />

                  <button
                    type="submit"
                    disabled={loading || !regUsername || !regDisplayName || !regEmail || !regPassword}
                    className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-1"
                    style={{
                      background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff",
                      boxShadow: loading ? "none" : "0 4px 20px rgba(99,102,241,0.3)",
                      opacity: (!regUsername || !regDisplayName || !regEmail || !regPassword) ? 0.5 : 1,
                    }}
                  >
                    {loading ? (
                      <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
                    ) : (
                      <><span>Hesap Oluştur</span><ChevronRight size={15} /></>
                    )}
                  </button>

                  <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Zaten hesabın var mı?{" "}
                    <button type="button" onClick={() => setTab("login")} className="font-semibold" style={{ color: "#818cf8" }}>
                      Giriş yap
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom note */}
          <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
            Think-Inn Beta — Fikirler burada şekillenir
          </p>
        </motion.div>
      </div>
    </div>
  );
}
