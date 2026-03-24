import { useState } from "react";
import {
  Search, FileText, Lightbulb, Share2, BarChart3, Command,
  ThumbsUp, Users, Calendar, Tag, Zap, ArrowRight, Bot,
  ChevronRight, Sparkles, Filter, X
} from "lucide-react";

const research = [
  { id: 1, title: "Kuantum Hesaplama ile Optimizasyon Algoritmaları", tags: ["kuantum", "optimizasyon"], author: "Dr. Ayşe Kaya", date: "24 Mar 2026", votes: 12, type: "research" as const },
  { id: 2, title: "AI Destekli Süreç Otomasyonu: Kurumsal Dönüşüm", tags: ["yapay-zeka", "otomasyon"], author: "Prof. Mehmet Yılmaz", date: "24 Mar 2026", votes: 8, type: "research" as const },
];
const ideas = [
  { id: 1, title: "Üretim Hattı Verimliliği için ML Tabanlı Tahmin Sistemi", tags: ["ml", "üretim"], author: "Kemal Demir", votes: 24, collaborators: 3, type: "idea" as const },
  { id: 2, title: "Müşteri Deneyimi Kişiselleştirme Platformu", tags: ["cx", "kişiselleştirme"], author: "Zeynep Arslan", votes: 18, collaborators: 5, type: "idea" as const },
  { id: 3, title: "Tedarik Zinciri Şeffaflığı için Blockchain", tags: ["blockchain", "tedarik"], author: "Ali Öz", votes: 15, collaborators: 2, type: "idea" as const },
];

type ResultItem = typeof research[0] | typeof ideas[0];

const QUICK_FILTERS = ["Tümü", "Araştırma", "Fikir", "Mimari", "Bu hafta"] as const;

export function KomutaMerkezi() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tümü");
  const [focused, setFocused] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  const all: ResultItem[] = [...research, ...ideas];
  const filtered = all.filter(item =>
    !query || item.title.toLowerCase().includes(query.toLowerCase()) || item.tags.some(t => t.includes(query.toLowerCase()))
  ).filter(item => {
    if (activeFilter === "Araştırma") return item.type === "research";
    if (activeFilter === "Fikir") return item.type === "idea";
    return true;
  });

  const researchResults = filtered.filter(i => i.type === "research");
  const ideaResults = filtered.filter(i => i.type === "idea");

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Think-Inn</span>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-500">Kurumsal İnovasyon Ekosistemi</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />Çevrimiçi
          </span>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Bot size={14} />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)]">
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Command bar */}
          <div className="px-8 pt-8 pb-4">
            <div className={`relative transition-all ${focused ? 'scale-[1.01]' : ''}`}>
              <div className={`flex items-center gap-3 bg-white rounded-2xl border ${focused ? 'border-indigo-400 shadow-lg shadow-indigo-100' : 'border-gray-200 shadow-sm'} px-4 py-3`}>
                <Search size={18} className={focused ? "text-indigo-500" : "text-gray-400"} />
                <input
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  placeholder="Araştırma, fikir veya konu ara... ⌘K"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                {query && <button onClick={() => setQuery("")}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>}
                <div className="flex items-center gap-1 text-[10px] text-gray-300 font-mono border border-gray-100 px-1.5 py-0.5 rounded">
                  <Command size={9} />K
                </div>
              </div>
            </div>

            {/* Quick filters */}
            <div className="flex items-center gap-2 mt-3">
              <Filter size={12} className="text-gray-400" />
              {QUICK_FILTERS.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${activeFilter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                  {f}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400">{filtered.length} sonuç</span>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-8 pb-8">
            {!query && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Öne Çıkanlar</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Sparkles, label: "Yeni Fikirler", val: "3", color: "amber" },
                    { icon: FileText, label: "Araştırmalar", val: "2", color: "indigo" },
                    { icon: Users, label: "Aktif İşbirlikleri", val: "8", color: "green" },
                  ].map(({ icon: Icon, label, val, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
                      <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                        <Icon size={14} className={`text-${color}-600`} />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">{val}</div>
                        <div className="text-[10px] text-gray-500">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {researchResults.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={12} className="text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Araştırmalar</span>
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">{researchResults.length}</span>
                </div>
                <div className="space-y-2">
                  {researchResults.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{item.author}</span>
                          <span className="text-gray-200">·</span>
                          {item.tags.slice(0, 2).map(t => <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{t}</span>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><ThumbsUp size={10} />{item.votes}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ideaResults.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={12} className="text-amber-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fikirler</span>
                  <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">{ideaResults.length}</span>
                </div>
                <div className="space-y-2">
                  {ideaResults.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm hover:border-amber-200 hover:shadow-md transition-all cursor-pointer group">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Lightbulb size={14} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{item.author}</span>
                          <span className="text-gray-200">·</span>
                          {'collaborators' in item && <span className="text-xs flex items-center gap-1 text-gray-400"><Users size={9} />{item.collaborators}</span>}
                          {item.tags.slice(0, 2).map(t => <span key={t} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">{t}</span>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><ThumbsUp size={10} />{item.votes}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Chat */}
        <div className="w-80 border-l border-gray-100 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><Bot size={13} className="text-white" /></div>
              <div>
                <p className="text-xs font-semibold text-gray-900">İnovasyon Asistanı</p>
                <p className="text-[10px] text-green-600 font-medium">● Çevrimiçi</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
              <Sparkles size={20} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Nasıl yardımcı olabilirim?</p>
            <p className="text-xs text-gray-400 leading-relaxed">Araştırma ekle, fikir geliştir veya ekosistemi analiz et.</p>
            <div className="mt-4 w-full space-y-1.5">
              {["Yeni araştırma ekle", "Benzer fikirler bul", "İlişki haritasını göster"].map(s => (
                <button key={s} className="w-full text-xs text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 transition-colors flex items-center gap-2">
                  <ArrowRight size={10} />{s}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-end gap-2">
              <textarea className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:border-indigo-300 placeholder-gray-400 text-gray-800" rows={2} placeholder="Mesajınızı yazın..." value={aiMsg} onChange={e => setAiMsg(e.target.value)} />
              <button className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white hover:bg-indigo-700 transition-colors flex-shrink-0">
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
