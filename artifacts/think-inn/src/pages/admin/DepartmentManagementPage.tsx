import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Pencil, Trash2, Check, X, AlertTriangle,
  ToggleLeft, ToggleRight, ChevronLeft,
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
      <div className="flex min-h-full items-center justify-center bg-background">
        <p className="text-error">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-10 pb-16 pt-7">
        {/* Page head */}
        <div className="mb-7 flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/users")}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-outline-variant bg-white text-on-surface-variant transition-colors hover:border-outline-strong hover:text-primary"
            aria-label="Geri"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <span className="overline">Yönetim</span>
            <h1 className="flex items-center gap-2 font-display text-[28px] font-bold tracking-[-0.02em] text-on-surface">
              <Building2 size={22} className="text-primary" /> Departman Yönetimi
            </h1>
            <p className="mt-0.5 text-[13px] text-on-surface-variant">Kayıt formunda görünecek departmanları yönetin</p>
          </div>
          <button
            onClick={() => { setCreating(true); setErr(null); }}
            className="ml-auto flex items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]"
          >
            <Plus size={16} /> Yeni Departman
          </button>
        </div>

        {/* Error */}
        {err && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-error/20 bg-error/[0.06] px-4 py-3 text-[13px] text-error">
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
              className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] p-5"
            >
              <h3 className="mb-3 font-heading text-[14px] font-bold text-on-surface">Yeni Departman Ekle</h3>
              <div className="space-y-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Departman adı *" className={inputCls} />
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Açıklama (isteğe bağlı)" className={inputCls} />
                <div className="flex gap-2">
                  <button
                    onClick={() => createMut.mutate({ name: newName.trim(), description: newDesc.trim() })}
                    disabled={!newName.trim() || createMut.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#0e54d8] disabled:opacity-50"
                  >
                    <Check size={13} /> Kaydet
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}
                    className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-4 py-2 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-background"
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
          <div className="py-16 text-center text-[13px] text-on-surface-variant">Yükleniyor...</div>
        ) : depts.length === 0 ? (
          <div className="hub-empty">
            <div className="ico"><Building2 size={26} /></div>
            <div className="t">Henüz departman eklenmemiş</div>
            <div className="p">"Yeni Departman" ile kayıt formunda görünecek departmanları ekleyin.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {depts.map((dept) => (
              <motion.div
                key={dept.id}
                layout
                className="flex items-start gap-4 rounded-2xl border border-outline-variant bg-white p-4 shadow-[0_1px_2px_rgba(7,27,58,0.04)]"
                style={{ opacity: dept.isActive ? 1 : 0.65 }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(20,99,243,0.10)", color: "#1463F3" }}>
                  <Building2 size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  {editId === dept.id ? (
                    <div className="space-y-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Açıklama" className={inputCls} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateMut.mutate({ id: dept.id, name: editName.trim(), description: editDesc.trim() })}
                          disabled={!editName.trim()}
                          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                        >
                          <Check size={12} className="mr-1 inline" /> Kaydet
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded-lg px-3 py-1.5 text-[12px] text-on-surface-variant hover:bg-background">İptal</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-[14px] font-bold text-on-surface">{dept.name}</span>
                        {!dept.isActive && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.10)", color: "#B0292B" }}>Pasif</span>
                        )}
                      </div>
                      {dept.description && <p className="mt-0.5 text-[12px] text-on-surface-variant">{dept.description}</p>}
                    </>
                  )}
                </div>

                {editId !== dept.id && (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => updateMut.mutate({ id: dept.id, isActive: !dept.isActive })}
                      className="rounded-lg p-1.5 transition-colors hover:bg-background"
                      title={dept.isActive ? "Pasif yap" : "Aktif yap"}
                      style={{ color: dept.isActive ? "#0F8C66" : "#94A0B8" }}
                    >
                      {dept.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => { setEditId(dept.id); setEditName(dept.name); setEditDesc(dept.description); }}
                      className="rounded-lg p-1.5 text-primary/70 transition-colors hover:bg-background hover:text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(dept.id)}
                      className="rounded-lg p-1.5 text-error/60 transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 size={14} />
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: "rgba(7,27,58,0.40)" }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl border border-outline-variant bg-white p-6 shadow-[0_28px_90px_rgba(7,27,58,0.18)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(239,68,68,0.10)" }}>
                    <AlertTriangle size={18} className="text-error" />
                  </div>
                  <div>
                    <h3 className="font-heading text-[14px] font-bold text-on-surface">Departmanı Sil</h3>
                    <p className="text-[12px] text-on-surface-variant">Bu işlem geri alınamaz</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => deleteMut.mutate(deleteId)} className="flex-1 rounded-xl bg-error py-2 text-[14px] font-semibold text-white transition-opacity hover:opacity-90">Sil</button>
                  <button onClick={() => setDeleteId(null)} className="flex-1 rounded-xl border border-outline-variant bg-white py-2 text-[14px] font-semibold text-on-surface-variant transition-colors hover:bg-background">İptal</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
