import { useState } from "react";
import {
  FileText, Lightbulb, ThumbsUp, Users, Share2, Bot,
  ArrowRight, Sparkles, Activity, Clock, MessageSquare,
  TrendingUp, Flame, GitMerge
} from "lucide-react";

const feedItems = [
  { id: 1, type: "new_research" as const, actor: "Dr. Ayşe Kaya", time: "2 saat önce", title: "Kuantum Hesaplama ile Optimizasyon Algoritmaları", tags: ["kuantum", "optimizasyon"], votes: 12, color: "indigo" },
  { id: 2, type: "idea_voted" as const, actor: "Kemal Demir", time: "4 saat önce", title: "ML Tabanlı Üretim Tahmin Sistemi", votes: 24, delta: "+6", color: "amber" },
  { id: 3, type: "linked" as const, time: "5 saat önce", from: "AI Destekli Otomasyon", to: "Süreç İyileştirme Fikri", color: "violet" },
  { id: 4, type: "new_idea" as const, actor: "Zeynep Arslan", time: "6 saat önce", title: "Müşteri Deneyimi Kişiselleştirme Platformu", tags: ["cx", "ai"], votes: 18, collaborators: 5, color: "amber" },
  { id: 5, type: "new_research" as const, actor: "Prof. Mehmet Yılmaz", time: "1 gün önce", title: "AI Destekli Süreç Otomasyonu", tags: ["yapay-zeka", "kurumsal"], votes: 8, color: "indigo" },
  { id: 6, type: "idea_voted" as const, actor: "Ali Öz", time: "1 gün önce", title: "Tedarik Zinciri Blockchain", votes: 15, delta: "+3", color: "amber" },
];

const TABS = ["Tümü", "Araştırma", "Fikirler", "Bağlantılar"] as const;

export function InovasyonFeed() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Tümü");
  const [aiMsg, setAiMsg] = useState("");

  const filtered = feedItems.filter(item => {
    if (activeTab === "Araştırma") return item.type === "new_research";
    if (activeTab === "Fikirler") return item.type === "new_idea" || item.type === "idea_voted";
    if (activeTab === "Bağlantılar") return item.type === "linked";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-['Inter']" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Think-Inn</span>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-500">Ekosistem Akışı</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full font-medium">
            <Flame size={11} /> 3 yeni etkinlik
          </div>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center"><Bot size={13} className="text-indigo-600" /></div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)]">
        {/* Feed */}
        <div className="flex-1 flex flex-col">
          {/* Stats bar */}
          <div className="bg-white border-b border-slate-100 px-6 py-3">
            <div className="flex items-center gap-6">
              {[
                { icon: TrendingUp, label: "Bu hafta büyüme", val: "+23%", color: "text-green-600" },
                { icon: FileText, label: "Araştırma", val: "2 yeni" },
                { icon: Lightbulb, label: "Fikir", val: "3 aktif" },
                { icon: GitMerge, label: "Bağlantı", val: "5 yeni" },
              ].map(({ icon: Icon, label, val, color = "text-gray-900" }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{label}:</span>
                  <span className={`text-xs font-bold ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4 pb-2 flex gap-1">
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-slate-100'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Timeline feed */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-2 bottom-2 w-px bg-slate-200" />

              <div className="space-y-3">
                {filtered.map(item => (
                  <div key={item.id} className="relative flex gap-4 group">
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.type === 'new_research' ? 'bg-indigo-100' :
                      item.type === 'linked' ? 'bg-violet-100' : 'bg-amber-100'
                    }`}>
                      {item.type === 'new_research' && <FileText size={14} className="text-indigo-600" />}
                      {item.type === 'new_idea' && <Lightbulb size={14} className="text-amber-600" />}
                      {item.type === 'idea_voted' && <ThumbsUp size={14} className="text-amber-600" />}
                      {item.type === 'linked' && <GitMerge size={14} className="text-violet-600" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer">
                      {item.type === 'new_research' && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Yeni Araştırma</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/>{item.time}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-gray-500">{item.actor}</span>
                            {item.tags?.map(t => <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{t}</span>)}
                            <span className="ml-auto flex items-center gap-1 text-xs text-gray-400"><ThumbsUp size={9}/>{item.votes}</span>
                          </div>
                        </>
                      )}
                      {(item.type === 'new_idea') && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Yeni Fikir</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/>{item.time}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">{item.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">{item.actor}</span>
                            {item.tags?.map(t => <span key={t} className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">{t}</span>)}
                            <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                              <Users size={9}/>{item.collaborators}
                              <span className="ml-1 flex items-center gap-1"><ThumbsUp size={9}/>{item.votes}</span>
                            </span>
                          </div>
                        </>
                      )}
                      {item.type === 'idea_voted' && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Oy Güncellendi</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/>{item.time}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500">{item.actor} oyladı</span>
                            <span className="ml-auto flex items-center gap-2 text-xs">
                              <span className="text-green-600 font-bold">{item.delta}</span>
                              <span className="flex items-center gap-1 text-gray-400"><ThumbsUp size={9}/>{item.votes}</span>
                            </span>
                          </div>
                        </>
                      )}
                      {item.type === 'linked' && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Bağlantı Kuruldu</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/>{item.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-medium">{item.from}</span>
                            <ArrowRight size={12} className="text-violet-400 flex-shrink-0" />
                            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-medium">{item.to}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-80 border-l border-slate-100 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100">
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
            <p className="text-sm font-semibold text-gray-700 mb-1">Ekosistemi analiz edeyim mi?</p>
            <p className="text-xs text-gray-400 leading-relaxed">Akıştaki trendleri, bağlantıları ve fırsatları analiz edebilirim.</p>
          </div>
          <div className="p-3 border-t border-slate-100">
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
