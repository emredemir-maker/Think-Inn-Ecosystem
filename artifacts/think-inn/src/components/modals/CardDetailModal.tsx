import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Users, Circle, BookOpen, Sparkles, Lock, TrendingUp, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Research, Idea } from '@workspace/api-client-react';
import { CyberBadge } from '../ui/CyberBadge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function sendToChat(message: string) {
  window.dispatchEvent(new CustomEvent('think-inn:send-message', { detail: { message } }));
}

function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none text-gray-700 leading-relaxed
      prose-p:my-1.5 prose-p:leading-relaxed
      prose-strong:text-gray-900 prose-strong:font-semibold
      prose-ul:my-2 prose-li:my-0.5
      prose-ol:my-2
      prose-headings:text-gray-900
      ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function CardDetailModal({ item, type, allResearch = [], onClose }: {
  item: Research | Idea | null;
  type: 'research' | 'idea' | null;
  allResearch?: Research[];
  onClose: () => void;
}) {
  if (!item || !type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col z-10 overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <CyberBadge variant={type === 'research' ? 'purple' : 'cyan'}>
              {item.status}
            </CyberBadge>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <h1 className="text-3xl font-bold text-[#1a1a2e] mb-4">{item.title}</h1>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <Users size={16} />
                <span className="font-medium text-[#1a1a2e]">{item.authorName}</span>
              </div>
              <span>•</span>
              <span>{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: tr })}</span>
            </div>

            {type === 'research' ? (
              <ResearchDetail research={item as Research} />
            ) : (
              <IdeaDetail idea={item as Idea} allResearch={allResearch} onClose={onClose} />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ResearchDetail({ research }: { research: Research }) {
  const hasImage = !!research.coverImageB64;
  const imageSrc = hasImage
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : null;

  return (
    <div className="space-y-8">
      {imageSrc && (
        <div className="w-full h-64 rounded-xl overflow-hidden mb-8">
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-6">
        {research.summary && (
          <section className="pl-4 border-l-4 border-indigo-500">
            <h3 className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase mb-3">Özet</h3>
            <MarkdownContent content={research.summary} />
          </section>
        )}

        {research.findings && (
          <section className="pl-4 border-l-4 border-emerald-500">
            <h3 className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase mb-3">Bulgular</h3>
            <MarkdownContent content={research.findings} />
          </section>
        )}

        {research.technicalAnalysis && (
          <section className="pl-4 border-l-4 border-blue-500">
            <h3 className="text-[10px] font-bold text-blue-500 tracking-widest uppercase mb-3">Teknik Analiz</h3>
            <MarkdownContent content={research.technicalAnalysis} />
          </section>
        )}
      </div>

      {research.tags && research.tags.length > 0 && (
        <div className="pt-6 mt-8 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Etiketler</h4>
          <div className="flex flex-wrap gap-2">
            {research.tags.map(tag => (
              <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type EvalScores = {
  commercialFeasibility: number;
  marketNeed: number;
  technicalDifficulty: number;
  trendAlignment: number;
  riskGovernance: number;
  summary: string;
  pivotSuggestion?: string;
};

const SCORE_AXES = [
  { key: 'commercialFeasibility', label: 'Ticari Fizibilite', icon: '🏦' },
  { key: 'marketNeed', label: 'Pazar İhtiyacı', icon: '📊' },
  { key: 'technicalDifficulty', label: 'Teknik Zorluk', icon: '⚙️' },
  { key: 'trendAlignment', label: 'Trend Uyumu', icon: '📈' },
  { key: 'riskGovernance', label: 'Risk & Yönetişim', icon: '🔐' },
] as const;

function ScoreBar({ score }: { score: number }) {
  const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-6 text-right ${
        score >= 7 ? 'text-green-600' : score >= 5 ? 'text-amber-600' : 'text-red-500'
      }`}>{score}</span>
    </div>
  );
}

function EvaluationPanel({ idea }: { idea: Idea }) {
  const scores = (idea as any).evaluationScores as EvalScores | null;
  const evaluatedAt = (idea as any).evaluatedAt;

  if (!evaluatedAt && !scores) {
    return (
      <div className="border border-indigo-100 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 bg-indigo-50/50 border-b border-indigo-100">
          <TrendingUp size={15} className="text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">Otonom Değerlendirme</span>
        </div>
        <div className="px-5 py-5 flex items-center gap-3 text-gray-500">
          <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />
          <span className="text-sm">Değerlendirme ajanı analiz yapıyor, kısa süre sonra hazır olacak...</span>
        </div>
      </div>
    );
  }

  if (!scores) return null;

  const avgScore = Object.values({
    a: scores.commercialFeasibility,
    b: scores.marketNeed,
    c: scores.technicalDifficulty,
    d: scores.trendAlignment,
    e: scores.riskGovernance,
  }).reduce((s, v) => s + v, 0) / 5;

  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-50/50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-700">Otonom Değerlendirme</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
          avgScore >= 7 ? 'bg-green-100 text-green-700' :
          avgScore >= 5 ? 'bg-amber-100 text-amber-700' :
          'bg-red-50 text-red-600'
        }`}>
          Ort. {avgScore.toFixed(1)}/10
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {SCORE_AXES.map(({ key, label, icon }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm w-4">{icon}</span>
            <span className="text-xs text-gray-600 w-32 shrink-0">{label}</span>
            <ScoreBar score={scores[key]} />
          </div>
        ))}
      </div>

      {scores.summary && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-500 leading-relaxed italic">{scores.summary}</p>
        </div>
      )}

      {scores.pivotSuggestion && (
        <div className="px-5 pb-4 pt-0">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2.5">
            <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-amber-600 tracking-wider uppercase mb-1">Pivot Önerisi</p>
              <p className="text-xs text-amber-800 leading-relaxed">{scores.pivotSuggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaDetail({ idea, allResearch, onClose }: { idea: Idea; allResearch: Research[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isReEvaluating, setIsReEvaluating] = useState(false);

  const linkedResearchIds: number[] = idea.researchIds ?? [];
  // neededResearchTopics = AI-determined uncovered topics (updated on each evaluation)
  // Covered topics are removed by the background evaluation agent — no client-side guessing
  const requiredTopics: string[] = (idea as any).neededResearchTopics ?? [];
  const optionalTopics: string[] = (idea as any).optionalResearchTopics ?? [];
  const hasNoTopics = requiredTopics.length === 0 && optionalTopics.length === 0;

  // Resolve actual linked research objects by ID
  const linkedResearchItems = linkedResearchIds
    .map(id => allResearch.find(r => r.id === id))
    .filter(Boolean) as Research[];

  const canAnalyze = linkedResearchItems.length > 0 || requiredTopics.length === 0;

  const handleGenerateAnalysis = () => {
    onClose();
    sendToChat(`"${idea.title}" fikri için mimari şema ve fonksiyonel analiz oluştur.`);
  };

  const handleReEvaluate = useCallback(async () => {
    if (isReEvaluating) return;
    setIsReEvaluating(true);
    try {
      await fetch(`/api/ideas/${idea.id}/re-evaluate`, { method: 'POST' });
      // Invalidate queries so polling/spinner re-activates
      await queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
    } finally {
      setIsReEvaluating(false);
    }
  }, [idea.id, isReEvaluating, queryClient]);

  return (
    <div className="space-y-6">

      {/* Research Panel */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Araştırma Konuları</span>
          </div>
          <div className="flex items-center gap-2">
            {requiredTopics.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {requiredTopics.length} açık zorunlu konu
              </span>
            )}
            {requiredTopics.length === 0 && linkedResearchItems.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                Tüm konular karşılandı
              </span>
            )}
            <button
              onClick={handleReEvaluate}
              disabled={isReEvaluating}
              title="Bağlı araştırmaları dikkate alarak yeniden değerlendir"
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={isReEvaluating ? 'animate-spin' : ''} />
              {isReEvaluating ? 'Yeniden değerlendiriliyor...' : 'Yeniden Değerlendir'}
            </button>
          </div>
        </div>

        {/* Actual linked research — real titles */}
        {linkedResearchItems.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-green-50/60 border-b border-green-100">
              <span className="text-[10px] font-bold text-green-700 tracking-wider uppercase">Bağlı Araştırmalar</span>
            </div>
            <ul className="divide-y divide-gray-50/80">
              {linkedResearchItems.map(r => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3 bg-green-50/20">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 leading-snug">{r.title}</p>
                    {r.summary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.summary}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Linked IDs that couldn't be resolved (still loading or deleted) */}
        {linkedResearchIds.length > 0 && linkedResearchItems.length < linkedResearchIds.length && (
          <div className="px-5 py-2.5 bg-amber-50/40 border-b border-amber-100 flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-600">
              {linkedResearchIds.length - linkedResearchItems.length} araştırma yüklenemedi
            </span>
          </div>
        )}

        {/* Required topics — keyword-matched to show coverage */}
        {requiredTopics.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-gray-50/80 border-b border-gray-100">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Zorunlu Araştırma Konuları</span>
            </div>
            <ul className="divide-y divide-gray-50/80">
              {requiredTopics.map((topic, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 bg-white">
                  <Circle size={16} className="text-red-300 mt-0.5 shrink-0" />
                  <span className="text-sm leading-snug text-gray-700">{topic}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Optional topics */}
        {optionalTopics.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-gray-50/80 border-t border-b border-gray-100">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase">Opsiyonel Araştırma Konuları</span>
            </div>
            <ul className="divide-y divide-gray-50/80">
              {optionalTopics.map((topic, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 bg-white">
                  <Circle size={16} className="text-blue-200 mt-0.5 shrink-0" />
                  <span className="text-sm leading-snug text-gray-500">{topic}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {hasNoTopics && linkedResearchIds.length === 0 && (
          <div className="px-5 py-4 flex items-center gap-2 text-amber-500">
            <AlertTriangle size={15} />
            <span className="text-sm">Araştırma konuları henüz belirlenmedi.</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 flex-1">
            {canAnalyze
              ? 'Mimari ve fonksiyonel analiz oluşturabilirsiniz.'
              : 'En az bir araştırma eklendiğinde analiz oluşturulabilir.'}
          </p>
          <button
            onClick={handleGenerateAnalysis}
            disabled={!canAnalyze}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shrink-0 ${
              canAnalyze
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canAnalyze ? <Sparkles size={13} /> : <Lock size={13} />}
            Analiz Oluştur
          </button>
        </div>
      </div>

      {/* Autonomous Evaluation Panel */}
      <EvaluationPanel idea={idea} />

      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Açıklama</h4>
        <MarkdownContent content={idea.description} />
      </div>

      {idea.roadmap && idea.roadmap.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Yapılacaklar</h4>
          <ol className="list-decimal pl-5 text-gray-700 space-y-2">
            {idea.roadmap.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {idea.collaborators && idea.collaborators.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">İş Birlikçiler</h4>
          <div className="flex flex-wrap gap-2">
            {idea.collaborators.map((collaborator, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {collaborator.charAt(0)}
                </div>
                <span>{collaborator}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {idea.tags && idea.tags.length > 0 && (
        <div className="pt-6 mt-8 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Etiketler</h4>
          <div className="flex flex-wrap gap-2">
            {idea.tags.map(tag => (
              <span key={tag} className="text-xs text-[#1a1a2e] bg-[#f3f4f6] px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
