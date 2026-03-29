import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Shield, ShieldAlert, Crown, User, Search, ChevronDown,
  ToggleLeft, ToggleRight, ChevronRight, X, AlertTriangle, CheckCircle,
  Clock, Mail, Calendar, Activity, Key, Eye
} from "lucide-react";
import { useAuth, authFetch } from "@/lib/auth-context";

// ── Types ────────────────────────────────────────────────────────────────────

type UserRole = "super_admin" | "moderator" | "master" | "user";

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string | null;
  lastActiveAt?: string | null;
  createdAt: string;
  bio?: string | null;
  pageAccess?: Array<{ page: string; granted: boolean }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: "Süper Admin", color: "rgba(239,68,68,0.8)", icon: <ShieldAlert size={11} /> },
  moderator:   { label: "Moderatör",   color: "rgba(245,158,11,0.8)", icon: <Shield size={11} /> },
  master:      { label: "Think-Inn Master", color: "rgba(139,92,246,0.8)", icon: <Crown size={11} /> },
  user:        { label: "Think-Inn User",   color: "rgba(99,102,241,0.7)",  icon: <User size={11} /> },
};

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function timeAgo(iso?: string | null) {
  if (!iso) return "Hiç";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}g önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { user: me, isRole } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: AdminUser; value?: string } | null>(null);
  const [reason, setReason] = useState("");

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (roleFilter) params.set("role", roleFilter);
  if (activeFilter !== "") params.set("isActive", activeFilter);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, activeFilter],
    queryFn: () => authFetch<AdminUser[]>(`/admin/users?${params}`),
    staleTime: 30_000,
  });

  const { data: selectedDetail } = useQuery({
    queryKey: ["admin-user", selectedUser?.id],
    queryFn: () => authFetch<AdminUser>(`/admin/users/${selectedUser!.id}`),
    enabled: !!selectedUser,
  });

  const mutRole = useMutation({
    mutationFn: ({ id, role, reason }: { id: number; role: string; reason?: string }) =>
      authFetch(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role, reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-user"] }); setConfirmAction(null); setReason(""); },
  });

  const mutActive = useMutation({
    mutationFn: ({ id, isActive, reason }: { id: number; isActive: boolean; reason?: string }) =>
      authFetch(`/admin/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ isActive, reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-user"] }); setConfirmAction(null); setReason(""); },
  });

  const users = usersData ?? [];

  if (!isRole("moderator")) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-400">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Left: User Table ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-200 flex items-center gap-2">
              <Users size={20} className="text-indigo-400" /> Kullanıcı Yönetimi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{users.length} kullanıcı</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, e-posta veya kullanıcı adı ara…"
              className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full"
            />
          </div>
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={[
            { value: "", label: "Tüm Roller" },
            { value: "super_admin", label: "Süper Admin" },
            { value: "moderator", label: "Moderatör" },
            { value: "master", label: "Master" },
            { value: "user", label: "User" },
          ]} />
          <FilterSelect value={activeFilter} onChange={setActiveFilter} options={[
            { value: "", label: "Tüm Durum" },
            { value: "true", label: "Aktif" },
            { value: "false", label: "Devre Dışı" },
          ]} />
        </div>

        {/* Table */}
        <div
          className="flex-1 overflow-auto rounded-2xl"
          style={{ border: "1px solid rgba(99,102,241,0.15)" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Yükleniyor…</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Kullanıcı bulunamadı</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(99,102,241,0.12)" }}>
                  {["Kullanıcı", "Rol", "Durum", "Son Aktif", "Katılım", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(99,102,241,0.07)",
                      background: selectedUser?.id === u.id ? "rgba(99,102,241,0.08)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (selectedUser?.id !== u.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { if (selectedUser?.id !== u.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)" }}
                        >
                          {u.displayName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{u.displayName}</p>
                          <p className="text-[11px] text-slate-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                        {u.isActive ? "Aktif" : "Devre Dışı"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{timeAgo(u.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-slate-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right: User Detail Panel ──────────────────────────────── */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="w-80 shrink-0 flex flex-col overflow-hidden"
            style={{
              background: "rgba(7,11,26,0.95)",
              borderLeft: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.12)" }}>
              <p className="text-sm font-semibold text-slate-300">Kullanıcı Detayı</p>
              <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-slate-300">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Avatar + name */}
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3"
                  style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))", border: "1px solid rgba(99,102,241,0.4)" }}
                >
                  {(selectedDetail ?? selectedUser).displayName[0]?.toUpperCase()}
                </div>
                <p className="font-bold text-slate-200">{(selectedDetail ?? selectedUser).displayName}</p>
                <p className="text-xs text-slate-500 mt-0.5">@{(selectedDetail ?? selectedUser).username}</p>
                <div className="mt-2 flex justify-center">
                  <RoleBadge role={(selectedDetail ?? selectedUser).role} />
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2">
                <InfoRow icon={<Mail size={12} />} label="E-posta" value={(selectedDetail ?? selectedUser).email} />
                <InfoRow icon={<Calendar size={12} />} label="Katılım" value={new Date((selectedDetail ?? selectedUser).createdAt).toLocaleDateString("tr-TR")} />
                <InfoRow icon={<Clock size={12} />} label="Son Aktif" value={timeAgo((selectedDetail ?? selectedUser).lastActiveAt)} />
                <InfoRow
                  icon={<Activity size={12} />}
                  label="Hesap"
                  value={(selectedDetail ?? selectedUser).isActive ? "Aktif" : "Devre Dışı"}
                  valueClass={(selectedDetail ?? selectedUser).isActive ? "text-emerald-400" : "text-red-400"}
                />
              </div>

              {/* Actions */}
              {isRole("super_admin") && (selectedDetail ?? selectedUser).id !== me?.id && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Rol Değiştir</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["super_admin", "moderator", "master", "user"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        disabled={(selectedDetail ?? selectedUser).role === r}
                        onClick={() => setConfirmAction({ type: "role", user: selectedDetail ?? selectedUser, value: r })}
                        className="px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30"
                        style={{
                          background: (selectedDetail ?? selectedUser).role === r ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${(selectedDetail ?? selectedUser).role === r ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                          color: (selectedDetail ?? selectedUser).role === r ? "#a5b4fc" : "#94a3b8",
                        }}
                      >
                        {ROLE_META[r].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(selectedDetail ?? selectedUser).id !== me?.id && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Hesap Durumu</p>
                  <button
                    onClick={() => setConfirmAction({ type: "active", user: selectedDetail ?? selectedUser, value: String(!(selectedDetail ?? selectedUser).isActive) })}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: (selectedDetail ?? selectedUser).isActive ? "rgba(239,68,68,0.08)" : "rgba(52,211,153,0.08)",
                      border: `1px solid ${(selectedDetail ?? selectedUser).isActive ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}`,
                      color: (selectedDetail ?? selectedUser).isActive ? "#f87171" : "#34d399",
                    }}
                  >
                    {(selectedDetail ?? selectedUser).isActive
                      ? <><ToggleRight size={15} /> Devre Dışı Bırak</>
                      : <><ToggleLeft size={15} /> Hesabı Etkinleştir</>}
                  </button>
                </div>
              )}

              {/* Page access (super_admin only) */}
              {isRole("super_admin") && selectedDetail?.pageAccess && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Sayfa Erişimi</p>
                  <PageAccessDisplay access={selectedDetail.pageAccess} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Dialog ────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0" style={{ background: "rgba(0,0,8,0.7)" }} onClick={() => setConfirmAction(null)} />
            <motion.div
              className="relative z-10 w-full max-w-sm p-6 rounded-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "rgba(7,11,26,0.98)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              <AlertTriangle size={24} className="text-amber-400 mb-3" />
              <p className="font-semibold text-slate-200 mb-1">
                {confirmAction.type === "role" ? "Rol Değiştir" : "Hesap Durumu Değiştir"}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                <span className="text-slate-200 font-medium">{confirmAction.user.displayName}</span>
                {confirmAction.type === "role"
                  ? ` kullanıcısının rolü ${ROLE_META[confirmAction.value as UserRole]?.label} olarak değiştirilecek.`
                  : confirmAction.value === "true"
                    ? " hesabı etkinleştirilecek."
                    : " hesabı devre dışı bırakılacak."}
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Neden? (isteğe bağlı)"
                rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm text-slate-300 placeholder:text-slate-600 outline-none mb-4 resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 rounded-xl text-sm text-slate-400 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === "role") {
                      mutRole.mutate({ id: confirmAction.user.id, role: confirmAction.value!, reason });
                    } else {
                      mutActive.mutate({ id: confirmAction.user.id, isActive: confirmAction.value === "true", reason });
                    }
                  }}
                  disabled={mutRole.isPending || mutActive.isPending}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.8),rgba(139,92,246,0.8))", border: "1px solid rgba(99,102,241,0.4)" }}
                >
                  {mutRole.isPending || mutActive.isPending ? "İşleniyor…" : "Onayla"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-slate-400 outline-none cursor-pointer pr-4 appearance-none"
      >
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#0a0e2e" }}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="text-slate-500 pointer-events-none absolute right-2.5" />
    </div>
  );
}

function InfoRow({ icon, label, value, valueClass }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.08)" }}
    >
      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {icon} {label}
      </span>
      <span className={`text-[12px] font-medium ${valueClass ?? "text-slate-300"}`}>{value}</span>
    </div>
  );
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Ana Sayfa",
  "/community": "Topluluk",
  "/admin/users": "Kullanıcı Yönetimi",
  "/admin/community": "Topluluk Yönetimi",
};

function PageAccessDisplay({ access }: { access: Array<{ page: string; granted: boolean }> }) {
  if (access.length === 0) {
    return <p className="text-xs text-slate-600 italic">Rol varsayılanları geçerli</p>;
  }
  return (
    <div className="space-y-1.5">
      {access.map(({ page, granted }) => (
        <div
          key={page}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.08)" }}
        >
          <span className="text-slate-400">{PAGE_LABELS[page] ?? page}</span>
          {granted
            ? <CheckCircle size={13} className="text-emerald-400" />
            : <X size={13} className="text-red-400" />}
        </div>
      ))}
    </div>
  );
}
