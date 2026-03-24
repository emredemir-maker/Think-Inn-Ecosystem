import React, { useState } from "react";
import { useCreateResearch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, FileText, Loader2, Plus, Tag } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  onClose: () => void;
}

export function AddResearchModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const { mutate: createResearch, isPending } = useCreateResearch();

  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Başlık zorunludur."); return; }
    if (!authorName.trim()) { setError("Yazar adı zorunludur."); return; }
    setError("");

    createResearch(
      {
        data: {
          title: title.trim(),
          authorName: authorName.trim(),
          summary: summary.trim(),
          findings: findings.trim(),
          technicalAnalysis: "",
          rawContent: findings.trim() || summary.trim(),
          tags,
          status: "published",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/research"] });
          onClose();
        },
        onError: () => setError("Araştırma kaydedilemedi. Lütfen tekrar deneyin."),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText size={15} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Yeni Araştırma</h2>
              <p className="text-[10px] text-gray-400">Ekosisteme araştırma ekle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Başlık */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Başlık <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Araştırma başlığını girin..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder-gray-300"
            />
          </div>

          {/* Yazar */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Yazar <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Ad Soyad / Unvan"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder-gray-300"
            />
          </div>

          {/* Özet */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Özet</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
              placeholder="Araştırmanın kısa özeti..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none placeholder-gray-300"
            />
          </div>

          {/* Bulgular */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bulgular / İçerik</label>
            <textarea
              value={findings}
              onChange={e => setFindings(e.target.value)}
              rows={4}
              placeholder="Ana bulgular, sonuçlar veya tam metin..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none placeholder-gray-300"
            />
          </div>

          {/* Etiketler */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Etiketler</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <Tag size={12} className="text-gray-300 flex-shrink-0" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="yapay-zeka, makine-öğrenmesi..."
                  className="flex-1 text-sm bg-transparent outline-none placeholder-gray-300"
                />
              </div>
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1.5">Enter veya virgülle etiket ekleyin</p>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {isPending ? "Kaydediliyor..." : "Araştırmayı Ekle"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
