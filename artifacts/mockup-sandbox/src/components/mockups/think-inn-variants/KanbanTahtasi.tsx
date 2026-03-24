import { useState } from "react";
import {
  FileText, Lightbulb, ThumbsUp, Users, Bot, ArrowRight,
  Sparkles, Plus, MoreHorizontal, CheckCircle, Eye,
  Clock, Zap, AlertCircle
} from "lucide-react";

type Stage = "taslak" | "inceleme" | "yayinda" | "arsiv";

const STAGES: { id: Stage; label: string; color: string; bg: string; border: string; desc: string }[] = [
  { id: "taslak", label: "Taslak", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", desc: "Henüz paylaşılmamış" },
  { id: "inceleme", label: "İnceleme", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", desc: "Değerlendiriliyor" },
  { id: "yayinda", label: "Yayında", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", desc: "Aktif & görünür" },
  { id: "arsiv", label: "Arşiv", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", desc: "Tamamlandı" },
];

const STAGE_ICONS: Record<Stage, React.ComponentType<{ size?: number; className?: string }>> = {
  taslak: Clock,
  inceleme: AlertCircle,
  yayinda: CheckCircle,
  arsiv: Eye,
};

type Card = {
  id: number; type: "research" | "idea"; title: string; tags: string[];
  author: string; votes: number; collaborators?: number; stage: Stage; priority?: "high";
};

const CARDS: Card[] = [
  { id: 1, type: "research", title: "Sürdürülebilir Malzeme Sentezi", tags: ["malzeme", "sürdürülebilir"], author: "Dr. Can Yıldız", votes: 3, stage: "taslak" },
  { id: 2, type: "idea", title: "Temassız Ödeme Sistemi", tags: ["fintech", "ux"], author: "Selin Kurt", votes: 7, collaborators: 2, stage: "taslak" },
  { id: 3, type: "research", title: "Kuantum Hesaplama ile Optimizasyon", tags: ["kuantum", "optimizasyon"], author: "Dr. Ayşe Kaya", votes: 12, stage: "inceleme", priority: "high" },
  { id: 4, type: "idea", title: "Tedarik Zinciri Blockchain", tags: ["blockchain", "tedarik"], author: "Ali Öz", votes: 15, collaborators: 2, stage: "inceleme" },
  { id: 5, type: "research", title: "AI Destekli Süreç Otomasyonu", tags: ["yapay-zeka", "otomasyon"], author: "Prof. Mehmet Yılmaz", votes: 8, stage: "yayinda" },
  { id: 6, type: "idea", title: "ML Tabanlı Üretim Tahmin", tags: ["ml", "üretim"], author: "Kemal Demir", votes: 24, collaborators: 3, stage: "yayinda", priority: "high" },
  { id: 7, type: "idea", title: "Müşteri Kişiselleştirme Platformu", tags: ["cx", "kişiselleştirme"], author: "Zeynep Arslan", votes: 18, collaborators: 5, stage: "yayinda" },
  { id: 8, type: "research", title: "IoT Sensör Ağı Analizi", tags: ["iot", "sensör"], author: "Dr. Murat Yıldız", votes: 6, stage: "arsiv" },
];

export function KanbanTahtasi() {
  const [cards, setCards] = useState<Card[]>(CARDS);
  const [aiMsg, setAiMsg] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  const cardsByStage = (stage: Stage) => cards.filter(c => c.stage === stage);

  const handleDrop = (stage: Stage) => {
    if (dragging !== null) {
      setCards(prev => prev.map(c => c.id === dragging ? { ...c, stage } : c));
      setDragging(null); setDragOver(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><Zap size={13} className="text-white" /></div>
          <span className="font-bold text-sm text-gray-900">Think-Inn</span>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-500">İnovasyon Tahtası</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            <Plus size={11} />Yeni Ekle
          </button>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center"><Bot size={13} className="text-indigo-600" /></div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {STAGES.map(stage => {
              const StageIcon = STAGE_ICONS[stage.id];
              const stageCards = cardsByStage(stage.id);
              const isDropTarget = dragOver === stage.id;

              return (
                <div key={stage.id}
                  className={`w-64 flex flex-col rounded-2xl border-2 transition-all ${isDropTarget ? 'border-indigo-400 bg-indigo-50/50' : `${stage.border} bg-white/50`}`}
                  style={{ minHeight: "500px" }}
                  onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${stage.bg} ${stage.border.replace('border-', 'border-b-')}`}>
                    <div className="flex items-center gap-2">
                      <StageIcon size={12} className={stage.color} />
                      <span className={`text-xs font-bold ${stage.color}`}>{stage.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stage.bg} ${stage.color} border ${stage.border}`}>{stageCards.length}</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={13} /></button>
                  </div>
                  <p className="text-[10px] text-gray-400 px-3 py-1.5 border-b border-dashed border-gray-100">{stage.desc}</p>

                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {stageCards.map(card => (
                      <div key={card.id}
                        className={`bg-white rounded-xl border p-3 cursor-grab shadow-sm hover:shadow-md transition-all ${card.priority === 'high' ? 'border-l-2 border-l-indigo-500 border-gray-200' : 'border-gray-200'}`}
                        draggable
                        onDragStart={() => setDragging(card.id)}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        style={{ opacity: dragging === card.id ? 0.4 : 1 }}
                      >
                        {/* Card type badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${card.type === 'research' ? 'text-indigo-600' : 'text-amber-600'}`}>
                            {card.type === 'research' ? <FileText size={9} /> : <Lightbulb size={9} />}
                            {card.type === 'research' ? 'Araştırma' : 'Fikir'}
                          </span>
                          {card.priority === 'high' && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">⚡ Öncelikli</span>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{card.title}</h4>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {card.tags.slice(0, 2).map(t => (
                            <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${card.type === 'research' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{t}</span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${card.type === 'research' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                              {card.author[0]}
                            </div>
                            {card.author.split(' ')[card.author.split(' ').length - 1]}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            {card.collaborators && <span className="flex items-center gap-0.5"><Users size={8} />{card.collaborators}</span>}
                            <span className="flex items-center gap-0.5"><ThumbsUp size={8} />{card.votes}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {stageCards.length === 0 && (
                      <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                        <p className="text-[10px]">Buraya sürükleyin</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-72 border-l border-slate-100 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center"><Bot size={13} className="text-white" /></div>
              <div>
                <p className="text-xs font-semibold text-gray-900">İnovasyon Asistanı</p>
                <p className="text-[10px] text-green-600 font-medium">● Çevrimiçi</p>
              </div>
            </div>
          </div>

          {/* Pipeline summary */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pipeline Özeti</p>
            <div className="space-y-1.5">
              {STAGES.map(s => {
                const count = cardsByStage(s.id).length;
                const total = cards.length;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium w-16 ${s.color}`}>{s.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${(count/total)*100}%`, background: s.id === 'taslak' ? '#94a3b8' : s.id === 'inceleme' ? '#f59e0b' : s.id === 'yayinda' ? '#22c55e' : '#cbd5e1' }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-2">
              <Sparkles size={16} className="text-indigo-400" />
            </div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Nasıl yardımcı olabilirim?</p>
            <p className="text-xs text-gray-400 leading-relaxed">Tahta analizi, önceliklendirme veya yeni içerik oluşturma.</p>
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
