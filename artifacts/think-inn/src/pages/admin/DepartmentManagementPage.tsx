import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Pencil, Trash2, Check, X, AlertTriangle,
  ToggleLeft, ToggleRight, ChevronLeft
} from "lucide-react";
import { useAuth, authFetch } from "@/lib/auth-context";
import { useLocation } from "wouter";

interface Department {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export default function DepartmentManagementPage() {
  const { isRole } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: depts = [], isLoading } = useQuery<Department[]>({
    queryKey: ["/api/admin/departments"],
    queryFn: () => authFetch<Department[]>("/admin/departments"),
  });

  const createMut = useMutation({
    mutationFn: (d: { name: string; description: string }) => authFetch("/admin/departments", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/departments"] }); setCreating(false); setNewName(""); setNewDesc(""); setErr(null); },
    onError: (e: any) => setErr(e.message ?? "Hata oluştu"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: { id: number; name?: string; description?: string; isActive?: boolean }) =>
      authFetch(`/admin/departments/${id}`, { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/departments"] }); setEditId(null); setErr(null); },
    onError: (e: any) => setErr(e.message ?? "Hata oluştu"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => authFetch(`/admin/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/departments"] }); setDeleteId(null); },
  });

  if (!isRole("super_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#04050f" }}>
        <p className="text-red-400">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse 100% 60% at 50% 0%, #0a0e2e 0%, #04050f 60%)" }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/admin/users")}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 size={20} className="text-indigo-400" /> Departman Yönetimi
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Kayıt formunda görünecek departmanları yönetin
            </p>
          </div>
          <button
            onClick={() => { setCreating(true); setErr(null); }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}
          >
            <Plus size={14} /> Yeni Departman
          </button>
        </div>

        {/* Error */}
        {err && (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
            <AlertTriangle size={14} /> {err}
          </div>
        )}

        {/* Create form */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4 p-5 rounded-2xl overflow-hidden"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <h3 className="text-sm font-semibold text-white mb-3">Yeni Departman Ekle</h3>
              <div className="space-y-3">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Departman adı *"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                />
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Açıklama (isteğe bağlı)"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => createMut.mutate({ name: newName.trim(), description: newDesc.trim() })}
                    disabled={!newName.trim() || createMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(99,102,241,0.8)", color: "#fff", opacity: !newName.trim() ? 0.5 : 1 }}
                  >
                    <Check size={13} /> Kaydet
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                  >
                    <X size={13} /> İptal
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-500">Yükleniyor...</div>
        ) : depts.length === 0 ? (
          <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Building2 size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Henüz departman eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {depts.map(dept => (
              <motion.div
                key={dept.id}
                layout
                className="p-4 rounded-2xl flex items-start gap-4"
                style={{
                  background: dept.isActive ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  opacity: dept.isActive ? 1 : 0.6,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
                >
                  <Building2 size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  {editId === dept.id ? (
                    <div className="space-y-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.3)", color: "#fff" }}
                      />
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Açıklama"
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateMut.mutate({ id: dept.id, name: editName.trim(), description: editDesc.trim() })}
                          disabled={!editName.trim()}
                          className="px-3 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(99,102,241,0.6)", color: "#fff" }}
                        >
                          <Check size={12} className="inline mr-1" /> Kaydet
                        </button>
                        <button onClick={() => setEditId(null)} className="px-3 py-1 rounded-lg text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{dept.name}</span>
                        {!dept.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>Pasif</span>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{dept.description}</p>
                      )}
                    </>
                  )}
                </div>

                {editId !== dept.id && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateMut.mutate({ id: dept.id, isActive: !dept.isActive })}
                      className="p-1.5 rounded-lg transition-colors"
                      title={dept.isActive ? "Pasif yap" : "Aktif yap"}
                      style={{ color: dept.isActive ? "#34d399" : "rgba(255,255,255,0.2)" }}
                    >
                      {dept.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button
                      onClick={() => { setEditId(dept.id); setEditName(dept.name); setEditDesc(dept.description); }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "rgba(99,102,241,0.6)" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(dept.id)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "rgba(239,68,68,0.5)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete confirm dialog */}
        <AnimatePresence>
          {deleteId !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.7)" }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="p-6 rounded-2xl max-w-sm w-full"
                style={{ background: "#0a0e2e", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Departmanı Sil</h3>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Bu işlem geri alınamaz</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => deleteMut.mutate(deleteId)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(239,68,68,0.8)", color: "#fff" }}
                  >
                    Sil
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 py-2 rounded-xl text-sm"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                  >
                    İptal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
