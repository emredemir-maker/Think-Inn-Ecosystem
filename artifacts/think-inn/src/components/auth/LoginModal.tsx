import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogIn, UserPlus, Eye, EyeOff, Fingerprint, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "login" | "register";

export function LoginModal({ open, onClose }: Props) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(form.email, form.password);
      } else {
        await register({
          username: form.username,
          displayName: form.displayName,
          email: form.email,
          password: form.password,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,8,0.8)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            style={{
              background: "rgba(7,11,26,0.98)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 20,
              boxShadow: "0 0 60px rgba(99,102,241,0.15), 0 24px 64px rgba(0,0,0,0.7)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
                >
                  <Fingerprint size={18} className="text-indigo-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-200 text-base">Think-Inn</p>
                  <p className="text-[11px] text-slate-500">Ekosisteme giriş yap</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex mx-6 mt-4 gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              {(["login", "register"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={
                    tab === t
                      ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }
                      : { color: "#64748b", border: "1px solid transparent" }
                  }
                >
                  {t === "login" ? <LogIn size={13} /> : <UserPlus size={13} />}
                  {t === "login" ? "Giriş Yap" : "Kayıt Ol"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-3">
              {tab === "register" && (
                <>
                  <InputField label="Kullanıcı Adı" type="text" placeholder="ornek_kullanici" {...field("username")} />
                  <InputField label="Ad Soyad" type="text" placeholder="Adınız Soyadınız" {...field("displayName")} />
                </>
              )}
              <InputField label="E-posta" type="email" placeholder="ornek@email.com" {...field("email")} />
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Şifre</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    {...field("password")}
                    required
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-1"
                style={{
                  background: loading
                    ? "rgba(99,102,241,0.3)"
                    : "linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))",
                  border: "1px solid rgba(99,102,241,0.4)",
                  boxShadow: loading ? "none" : "0 0 20px rgba(99,102,241,0.2)",
                }}
              >
                {loading ? "İşleniyor…" : tab === "login" ? "Giriş Yap" : "Hesap Oluştur"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InputField({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
        className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none w-full"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(99,102,241,0.2)",
        }}
      />
    </div>
  );
}
