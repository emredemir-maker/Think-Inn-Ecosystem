import { useState } from "react";
import {
  FileText, Lightbulb, ThumbsUp, Users, Bot, ArrowRight,
  Sparkles, Search, Share2, BarChart3, Building2, Zap,
  ChevronRight, Star, TrendingUp
} from "lucide-react";

type Tab = "research" | "ideas" | "architecture" | "analyses";

const research = [
  { id: 1, title: "Kuantum Hesaplama ile Optimizasyon Algoritmaları", summary: "Kuantum hesaplama yöntemlerinin endüstriyel optimizasyon problemlerine uygulanması.", tags: ["kuantum", "optimizasyon", "algoritma"], author: "Dr. Ayşe Kaya", date: "24 Mar 2026", votes: 12 },
  { id: 2, title: "AI Destekli Süreç Otomasyonu: Kurumsal Dönüşüm", summary: "Yapay zeka destekli otomasyon sistemlerinin kurumsal süreçlere entegrasyonu.", tags: ["yapay-zeka", "otomasyon", "kurumsal"], author: "Prof. Mehmet Yılmaz", date: "24 Mar 2026", votes: 8 },
];

const ideas = [
  { id: 1, title: "Üretim Hattı Verimliliği için ML Tabanlı Tahmin Sistemi", summary: "Makine öğrenmesi kullanılarak üretim hattı verimliliğinin artırılması.", tags: ["ml", "üretim", "verimlilik"], author: "Kemal Demir", votes: 24, collaborators: 3, status: "hot" },
  { id: 2, title: "Müşteri Deneyimi Kişiselleştirme Platformu", summary: "Müşteri davranışlarını analiz eden ve kişiselleştirilmiş deneyimler sunan platform.", tags: ["cx", "kişiselleştirme", "ai"], author: "Zeynep Arslan", votes: 18, collaborators: 5, status: "new" },
  { id: 3, title: "Tedarik Zinciri Şeffaflığı için Blockchain Çözümü", summary: "Tedarik zincirinin şeffaflığını artırmak için blockchain teknolojisinin kullanımı.", tags: ["blockchain", "tedarik", "şeffaflık"], author: "Ali Öz", votes: 15, collaborators: 2, status: "normal" },
];

export function KaranlikLab() {
  const [activeTab, setActiveTab] = useState<Tab>("research");
  const [aiMsg, setAiMsg] = useState("");

  const TABS = [
    { id: "research" as Tab, label: "Araştırma", icon: FileText, count: 2, color: "cyan" },
    { id: "ideas" as Tab, label: "Fikir", icon: Lightbulb, count: 3, color: "amber" },
    { id: "architecture" as Tab, label: "Mimari Yapı", icon: Building2, count: 0, color: "violet" },
    { id: "analyses" as Tab, label: "Analizler", icon: BarChart3, count: 0, color: "emerald" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0f", fontFamily: "Inter, sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: "#1e1e2e", background: "#0d0d18" }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
            <Zap size={13} className="text-white" />
          </div>
          <span className="font-bold text-sm" style={{ color: "#f1f5f9" }}>Think-Inn</span>
          <span style={{ color: "#2d2d44" }}>|</span>
          <span className="text-xs" style={{ color: "#64748b" }}>Kurumsal İnovasyon Ekosistemi</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#0f2d1a", color: "#34d399" }}>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />Çevrimiçi
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#1a1a2e", color: "#818cf8" }}>
            <TrendingUp size={10} />Sistem: Aktif
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#1a1a2e" }}>
            <Bot size={13} style={{ color: "#818cf8" }} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Vitrine header */}
          <div className="px-6 pt-5 pb-0" style={{ background: "#0a0a0f" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold" style={{ color: "#f1f5f9" }}>İnovasyon Vitrini</h1>
                <p className="text-xs mt-0.5" style={{ color: "#475569" }}>Keşfedin, değerlendirin ve iş birliği yapın.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs" style={{ border: "1px solid #1e1e2e", background: "#0d0d18", color: "#64748b" }}>
                  <Search size={11} />
                  <span>Ara...</span>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "#1e1e3a", color: "#818cf8", border: "1px solid #2d2d5e" }}>
                  <Share2 size={11} />Genel Harita
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b" style={{ borderColor: "#1e1e2e" }}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all relative"
                    style={{ color: active ? "#f1f5f9" : "#475569", borderBottom: active ? "2px solid #6366f1" : "2px solid transparent" }}>
                    <tab.icon size={12} style={{ color: active ? "#818cf8" : "#475569" }} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: active ? "#1e1e3a" : "#1a1a2e", color: active ? "#818cf8" : "#475569" }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: "#0a0a0f" }}>
            {activeTab === "research" && (
              <div className="grid grid-cols-2 gap-4">
                {research.map(item => (
                  <div key={item.id} className="rounded-2xl border p-5 cursor-pointer transition-all hover:scale-[1.01]"
                    style={{ background: "#0d0d18", border: "1px solid #1e1e2e", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3730a3"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2e"; }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "#1e1e3a", color: "#818cf8" }}>
                        📄 Araştırma · published
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#475569" }}>
                        <ThumbsUp size={10} />{item.votes}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-2 leading-snug" style={{ color: "#e2e8f0" }}>{item.title}</h3>
                    <p className="text-xs mb-3 leading-relaxed line-clamp-2" style={{ color: "#475569" }}>{item.summary}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#1a1a2e", color: "#6366f1" }}>{t}</span>)}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#1e1e2e" }}>
                      <span className="text-[10px] flex items-center gap-1.5" style={{ color: "#475569" }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "#1e1e3a", color: "#818cf8" }}>
                          {item.author[0]}
                        </div>
                        {item.author}
                      </span>
                      <span className="text-[10px]" style={{ color: "#334155" }}>{item.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "ideas" && (
              <div className="grid grid-cols-2 gap-4">
                {ideas.map(item => (
                  <div key={item.id} className="rounded-2xl border p-5 cursor-pointer transition-all hover:scale-[1.01]"
                    style={{ background: "#0d0d18", border: "1px solid #1e1e2e" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#78350f"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2e"; }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#1f1708", color: "#d97706" }}>
                        💡 Fikir
                        {item.status === "hot" && <span className="ml-1" style={{ color: "#ef4444" }}>🔥</span>}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#475569" }}>
                        <ThumbsUp size={10} />{item.votes}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-2 leading-snug" style={{ color: "#e2e8f0" }}>{item.title}</h3>
                    <p className="text-xs mb-3 leading-relaxed line-clamp-2" style={{ color: "#475569" }}>{item.summary}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#1f1708", color: "#d97706" }}>{t}</span>)}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#1e1e2e" }}>
                      <span className="text-[10px] flex items-center gap-1.5" style={{ color: "#475569" }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "#1f1708", color: "#d97706" }}>
                          {item.author[0]}
                        </div>
                        {item.author}
                      </span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: "#334155" }}>
                        <Users size={9} />{item.collaborators}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(activeTab === "architecture" || activeTab === "analyses") && (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#1a1a2e" }}>
                  {activeTab === "architecture" ? <Building2 size={20} style={{ color: "#818cf8" }} /> : <BarChart3 size={20} style={{ color: "#818cf8" }} />}
                </div>
                <p className="text-sm font-medium" style={{ color: "#475569" }}>Henüz içerik yok</p>
                <p className="text-xs" style={{ color: "#334155" }}>AI asistanla oluşturmaya başlayın</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-80 flex flex-col border-l" style={{ background: "#0d0d18", borderColor: "#1e1e2e" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                <Bot size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#f1f5f9" }}>İnovasyon Asistanı</p>
                <p className="text-[10px] font-medium" style={{ color: "#34d399" }}>● Çevrimiçi</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#1a1a2e" }}>
              <Sparkles size={20} style={{ color: "#818cf8" }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>Nasıl yardımcı olabilirim?</p>
            <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>Bir fikir veya araştırma konusu girin.</p>
            <div className="mt-4 w-full space-y-1.5">
              {["Yeni araştırma ekle", "Benzer fikirler bul", "Analiz oluştur"].map(s => (
                <button key={s} className="w-full text-xs text-left px-3 py-2 rounded-xl flex items-center gap-2 transition-all"
                  style={{ background: "#1a1a2e", color: "#64748b", border: "1px solid #1e1e2e" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1e1e3a"; (e.currentTarget as HTMLElement).style.color = "#818cf8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#1a1a2e"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}>
                  <ChevronRight size={10} />{s}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 border-t" style={{ borderColor: "#1e1e2e" }}>
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 text-xs resize-none outline-none rounded-xl px-3 py-2"
                style={{ background: "#1a1a2e", border: "1px solid #1e1e2e", color: "#e2e8f0" }}
                rows={2} placeholder="Mesajınızı yazın..."
                value={aiMsg} onChange={e => setAiMsg(e.target.value)} />
              <button className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                <ArrowRight size={13} />
              </button>
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: "#334155" }}>Shift+Enter yeni satır</p>
          </div>
        </div>
      </div>
    </div>
  );
}
