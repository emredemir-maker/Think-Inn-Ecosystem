import React, { ReactNode, useState } from "react";
import { Activity, Zap, Fingerprint, Cpu, Users, MessageSquare, LogIn, LogOut, ChevronDown, Shield, Crown, ShieldAlert, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { LoginModal } from "@/components/auth/LoginModal";

type UserRole = "super_admin" | "moderator" | "master" | "user";

const ROLE_META: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: "Süper Admin", color: "#f87171", icon: <ShieldAlert size={11} /> },
  moderator:   { label: "Moderatör",   color: "#fbbf24", icon: <Shield size={11} /> },
  master:      { label: "Master",       color: "#a78bfa", icon: <Crown size={11} /> },
  user:        { label: "Kullanıcı",    color: "#818cf8", icon: <User size={11} /> },
};

export function HUDLayout({ children }: { children: ReactNode }) {
  const { user, logout, isRole } = useAuth();
  const [, navigate] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const roleMeta = user ? ROLE_META[user.role as UserRole] : null;

  return (
    <div className="h-screen w-full text-foreground flex flex-col overflow-hidden" style={{ background: '#060b18' }}>
      {/* Grid background overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          zIndex: 0,
        }}
      />
      {/* Radial top glow */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '40vh',
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center top, rgba(99,102,241,0.12) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      <header
        className="h-14 flex items-center px-6 justify-between shrink-0 z-10 relative"
        style={{
          background: 'rgba(6,11,24,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.2)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Scan-line at bottom of header */}
        <div
          className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6) 30%, rgba(34,211,238,0.5) 50%, rgba(99,102,241,0.6) 70%, transparent)',
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-lg blur-md opacity-30" />
              <div
                className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg text-white shadow-lg"
                style={{ boxShadow: '0 0 20px rgba(99,102,241,0.6)' }}
              >
                <Fingerprint size={18} />
              </div>
            </div>
            <div>
              <span
                className="font-bold text-lg text-slate-200 tracking-tight"
                style={{ textShadow: '0 0 20px rgba(99,102,241,0.4)' }}
              >
                Think-Inn
              </span>
              <span className="ml-2 text-[10px] font-semibold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Beta</span>
            </div>
          </button>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1 ml-4" style={{ borderLeft: "1px solid rgba(99,102,241,0.15)", paddingLeft: 16 }}>
            <NavLink icon={<Activity size={13} />} label="Vitrin" onClick={() => navigate("/")} />
            <NavLink icon={<MessageSquare size={13} />} label="Topluluk" onClick={() => navigate("/community")} />
            {isRole("moderator") && (
              <NavLink icon={<Users size={13} />} label="Kullanıcılar" onClick={() => navigate("/admin/users")} />
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 text-sm relative">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500">
            <Cpu size={13} className="text-indigo-400" />
            <span className="text-slate-500">Gemini 2.5</span>
          </div>
          <div className="h-4 w-px hidden md:block" style={{ background: 'rgba(99,102,241,0.2)' }} />
          <motion.div
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="hidden md:flex items-center gap-1.5 text-xs"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span
                className="relative inline-flex rounded-full h-2 w-2 bg-green-500"
                style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
              />
            </span>
            <span className="text-emerald-400 font-medium">Sistem Aktif</span>
          </motion.div>
          <div className="h-4 w-px hidden md:block" style={{ background: 'rgba(99,102,241,0.2)' }} />

          {/* Auth zone */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((p) => !p)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: "rgba(99,102,241,0.4)" }}
                >
                  {user.displayName[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-300 max-w-24 truncate">{user.displayName}</span>
                {roleMeta && (
                  <span className="text-[10px] font-semibold" style={{ color: roleMeta.color }}>
                    {roleMeta.icon}
                  </span>
                )}
                <ChevronDown size={11} className="text-slate-500" />
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
                      className="absolute right-0 top-full mt-2 z-50 w-48 rounded-2xl overflow-hidden"
                      style={{ background: "rgba(7,11,26,0.98)", border: "1px solid rgba(99,102,241,0.25)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
                    >
                      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                        <p className="text-sm font-semibold text-slate-200">{user.displayName}</p>
                        <p className="text-[11px] text-slate-500">@{user.username}</p>
                        {roleMeta && (
                          <span
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${roleMeta.color}22`, color: roleMeta.color, border: `1px solid ${roleMeta.color}33` }}
                          >
                            {roleMeta.icon} {roleMeta.label}
                          </span>
                        )}
                      </div>
                      {isRole("moderator") && (
                        <button
                          onClick={() => { navigate("/admin/users"); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors text-left"
                        >
                          <Users size={13} /> Kullanıcı Yönetimi
                        </button>
                      )}
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors text-left"
                      >
                        <LogOut size={13} /> Çıkış Yap
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 transition-all"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
            >
              <LogIn size={13} /> Giriş Yap
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex w-full h-full relative overflow-hidden" style={{ zIndex: 1 }}>
        {children}
      </main>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function NavLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
    >
      {icon} {label}
    </button>
  );
}
