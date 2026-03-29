import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, AlertTriangle, Users, Circle, BookOpen, Sparkles, Lock,
  TrendingUp, Lightbulb, Loader2, RefreshCw, ChevronDown, ChevronRight,
  GitBranch, Code2, Layers, LayoutTemplate, FileText, Tag, List, BarChart2,
  MessageSquare, Send, Shield, Crown, ShieldAlert, User as UserIcon,
} from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Research, Idea } from '@workspace/api-client-react';
import { CyberBadge } from '../ui/CyberBadge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth, authFetch } from '@/lib/auth-context';

function sendToChat(message: string) {
  window.dispatchEvent(new CustomEvent('think-inn:send-message', { detail: { message } }));
}

function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm max-w-none leading-relaxed
        prose-p:my-2 prose-p:leading-relaxed prose-p:text-slate-300
        prose-strong:text-slate-100 prose-strong:font-semibold
        prose-ul:my-2 prose-li:my-1 prose-li:text-slate-300
        prose-ol:my-2 prose-ol:text-slate-300
        prose-headings:text-slate-100 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
        prose-h2:text-base prose-h3:text-sm
        prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
        prose-code:text-cyan-300 prose-code:bg-cyan-900/30 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs
        prose-blockquote:border-l-indigo-500 prose-blockquote:text-slate-400
        prose-hr:border-slate-700
        ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ─── Tab definitions ────────────────────────────────────────────────────────

type IdeaTabId = 'overview' | 'research' | 'evaluation' | 'analysis' | 'community';

interface IdeaTab {
  id: IdeaTabId;
  label: string;
  icon: React.ElementType;
  accent: string;
}

const IDEA_TABS: IdeaTab[] = [
  { id: 'overview',    label: 'Genel Bakış',  icon: FileText,       accent: '#818cf8' },
  { id: 'research',    label: 'Araştırmalar', icon: BookOpen,       accent: '#34d399' },
  { id: 'evaluation',  label: 'Değerlendirme', icon: BarChart2,     accent: '#fbbf24' },
  { id: 'analysis',    label: 'AI Analiz',    icon: Layers,         accent: '#a78bfa' },
  { id: 'community',   label: 'Topluluk',     icon: MessageSquare, accent: '#22d3ee' },
];

// ─── Main export ─────────────────────────────────────────────────────────────

export function CardDetailModal({ item, type, allResearch = [], onClose, onOpenProject }: {
  item: Research | Idea | null;
  type: 'research' | 'idea' | null;
  allResearch?: Research[];
  onClose: () => void;
  onOpenProject?: (ideaId: number) => void;
}) {
  if (!item || !type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col z-10 overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(7,11,26,0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(99,102,241,0.22)',
            boxShadow: '0 28px 90px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Top accent line */}
          <div
            className="h-0.5 w-full shrink-0"
            style={{ background: type === 'idea' ? 'linear-gradient(90deg,#6366f1,#a78bfa,#22d3ee)' : 'linear-gradient(90deg,#a78bfa,#6366f1)' }}
          />

          {/* Header */}
          <div
            className="flex items-start justify-between px-6 py-4 shrink-0 gap-4"
            style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <CyberBadge variant={type === 'research' ? 'purple' : 'cyan'}>{item.status}</CyberBadge>
                <span className="text-[10px] text-slate-600 font-mono">#{item.id}</span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-slate-100 leading-snug">{item.title}</h1>
              <div className="flex items-center gap-2.5 mt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Users size={11} className="text-slate-600" />
                  <span className="text-slate-400 font-medium">{item.authorName}</span>
                </div>
                <span className="text-slate-700">·</span>
                <span className="font-mono">{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: tr })}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {type === 'research' ? (
              <div className="p-6">
                <ResearchDetail research={item as Research} />
              </div>
            ) : (
              <IdeaDetail
                idea={item as Idea}
                allResearch={allResearch}
                onClose={onClose}
                onOpenProject={onOpenProject}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Research detail ──────────────────────────────────────────────────────────

function ResearchDetail({ research }: { research: Research }) {
  const hasImage = !!(research as any).hasCoverImage || !!research.coverImageB64;
  const imageSrc = research.coverImageB64
    ? `data:${research.coverImageMimeType};base64,${research.coverImageB64}`
    : hasImage ? `/api/research/${research.id}/cover` : null;

  return (
    <div className="space-y-6">
      {imageSrc && (
        <div className="w-full h-52 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover" />
        </div>
      )}

      {research.summary && (
        <div
          className="rounded-xl px-5 py-4 relative overflow-hidden"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}
        >
          <div className="absolute top-0 left-0 w-0.5 h-full" style={{ background: 'linear-gradient(to bottom, #6366f1, #a78bfa)' }} />
          <p className="text-[9px] font-bold text-indigo-400 tracking-[0.18em] uppercase font-mono mb-2.5">Yönetici Özeti</p>
          <MarkdownContent content={research.summary} />
        </div>
      )}

      {research.findings && (
        <Section label="Bulgular" accent="#34d399" index="01">
          <MarkdownContent content={research.findings} />
        </Section>
      )}

      {research.technicalAnalysis && (
        <Section label="Teknik Analiz" accent="#22d3ee" index="02">
          <MarkdownContent content={research.technicalAnalysis} />
        </Section>
      )}

      {research.tags && research.tags.length > 0 && (
        <div className="pt-4" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="flex flex-wrap gap-2">
            {research.tags.map(tag => (
              <span
                key={tag}
                className="text-[11px] font-medium text-violet-400 px-3 py-1 rounded-full font-mono"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Community discussion */}
      <div className="pt-4" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={13} className="text-cyan-400" />
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Topluluk Tartışması</span>
        </div>
        <CommunityThreadPanel linkedType="research" linkedId={research.id} />
      </div>
    </div>
  );
}

// ─── Idea detail (tabbed) ─────────────────────────────────────────────────────

function IdeaDetail({ idea, allResearch, onClose, onOpenProject }: {
  idea: Idea;
  allResearch: Research[];
  onClose: () => void;
  onOpenProject?: (ideaId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [activeTab, setActiveTab] = useState<IdeaTabId>('overview');

  const linkedResearchIds: number[] = idea.researchIds ?? [];
  const requiredTopics: string[] = (idea as any).neededResearchTopics ?? [];
  const optionalTopics: string[] = (idea as any).optionalResearchTopics ?? [];
  const linkedResearchItems = linkedResearchIds
    .map(id => allResearch.find(r => r.id === id))
    .filter(Boolean) as Research[];

  const scores = (idea as any).evaluationScores as EvalScores | null;
  const analysis = (idea as any).architecturalAnalysis as ArchitecturalAnalysis | null;

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
      await queryClient.invalidateQueries({ queryKey: ['/api/ideas'] });
    } finally {
      setIsReEvaluating(false);
    }
  }, [idea.id, isReEvaluating, queryClient]);

  // Compute badge counts for tabs
  const researchBadge = linkedResearchItems.length > 0
    ? (requiredTopics.length === 0 ? null : requiredTopics.length)
    : (requiredTopics.length + optionalTopics.length > 0 ? requiredTopics.length || '!' : null);
  const evalBadge = scores ? null : '…';
  const analysisBadge = analysis ? null : null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
      >
        {IDEA_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'research' ? researchBadge : tab.id === 'evaluation' ? evalBadge : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200"
              style={{
                color: isActive ? tab.accent : 'rgb(100,116,139)',
                background: isActive ? `${tab.accent}12` : 'transparent',
                borderBottom: isActive ? `2px solid ${tab.accent}` : '2px solid transparent',
              }}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
              {badge !== null && (
                <span
                  className="ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tab.id === 'research' && requiredTopics.length > 0 ? 'rgba(251,191,36,0.15)' : `${tab.accent}18`,
                    color: tab.id === 'research' && requiredTopics.length > 0 ? '#fbbf24' : tab.accent,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab idea={idea} />
            )}
            {activeTab === 'research' && (
              <ResearchTab
                idea={idea}
                linkedResearchItems={linkedResearchItems}
                linkedResearchIds={linkedResearchIds}
                requiredTopics={requiredTopics}
                optionalTopics={optionalTopics}
                canAnalyze={canAnalyze}
                isReEvaluating={isReEvaluating}
                onReEvaluate={handleReEvaluate}
                onGenerateAnalysis={handleGenerateAnalysis}
                onClose={onClose}
                onOpenProject={onOpenProject}
              />
            )}
            {activeTab === 'evaluation' && (
              <EvaluationTab idea={idea} />
            )}
            {activeTab === 'analysis' && (
              <AnalysisTab idea={idea} />
            )}
            {activeTab === 'community' && (
              <CommunityThreadPanel linkedType="idea" linkedId={idea.id} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ idea }: { idea: Idea }) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}
      >
        <SectionHeader label="Açıklama" icon={<FileText size={13} className="text-indigo-400" />} />
        <div className="mt-3">
          <MarkdownContent content={idea.description} />
        </div>
      </div>

      {/* Roadmap */}
      {idea.roadmap && idea.roadmap.length > 0 && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)' }}
        >
          <SectionHeader label="Yol Haritası" icon={<List size={13} className="text-cyan-400" />} />
          <ol className="mt-3 space-y-2.5">
            {idea.roadmap.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono mt-0.5"
                  style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-slate-300 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Collaborators */}
      {idea.collaborators && idea.collaborators.length > 0 && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)' }}
        >
          <SectionHeader label="İş Birlikçiler" icon={<Users size={13} className="text-violet-400" />} />
          <div className="mt-3 flex flex-wrap gap-2">
            {idea.collaborators.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                >
                  {c.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {idea.tags && idea.tags.length > 0 && (
        <div>
          <SectionHeader label="Etiketler" icon={<Tag size={13} className="text-indigo-400" />} />
          <div className="mt-3 flex flex-wrap gap-2">
            {idea.tags.map(tag => (
              <span
                key={tag}
                className="text-xs font-medium text-indigo-300 px-3 py-1 rounded-full font-mono"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Research ────────────────────────────────────────────────────────────

function ResearchTab({
  idea, linkedResearchItems, linkedResearchIds, requiredTopics, optionalTopics,
  canAnalyze, isReEvaluating, onReEvaluate, onGenerateAnalysis, onClose, onOpenProject,
}: {
  idea: Idea;
  linkedResearchItems: Research[];
  linkedResearchIds: number[];
  requiredTopics: string[];
  optionalTopics: string[];
  canAnalyze: boolean;
  isReEvaluating: boolean;
  onReEvaluate: () => void;
  onGenerateAnalysis: () => void;
  onClose: () => void;
  onOpenProject?: (id: number) => void;
}) {
  const allCovered = requiredTopics.length === 0 && linkedResearchItems.length > 0;
  const hasNoTopics = requiredTopics.length === 0 && optionalTopics.length === 0;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: allCovered ? 'rgba(52,211,153,0.06)' : requiredTopics.length > 0 ? 'rgba(251,191,36,0.06)' : 'rgba(99,102,241,0.06)',
          border: `1px solid ${allCovered ? 'rgba(52,211,153,0.2)' : requiredTopics.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.15)'}`,
        }}
      >
        <div className="flex items-center gap-2">
          {allCovered ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : requiredTopics.length > 0 ? (
            <AlertTriangle size={14} className="text-amber-400" />
          ) : (
            <Circle size={14} className="text-slate-500" />
          )}
          <span className="text-sm font-semibold" style={{ color: allCovered ? '#34d399' : requiredTopics.length > 0 ? '#fbbf24' : 'rgb(148,163,184)' }}>
            {allCovered
              ? 'Tüm zorunlu konular karşılandı'
              : requiredTopics.length > 0
                ? `${requiredTopics.length} zorunlu konu eksik`
                : 'Araştırma konuları bekleniyor'}
          </span>
        </div>
        <button
          onClick={onReEvaluate}
          disabled={isReEvaluating}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
        >
          <RefreshCw size={11} className={isReEvaluating ? 'animate-spin' : ''} />
          {isReEvaluating ? 'Yenileniyor...' : 'Yeniden Değerlendir'}
        </button>
      </div>

      {/* Linked research */}
      {linkedResearchItems.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(52,211,153,0.18)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(52,211,153,0.07)', borderBottom: '1px solid rgba(52,211,153,0.12)' }}>
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 tracking-[0.15em] uppercase font-mono">
              Bağlı Araştırmalar ({linkedResearchItems.length})
            </span>
          </div>
          <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {linkedResearchItems.map(r => (
              <li
                key={r.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors"
                style={{ background: 'rgba(52,211,153,0.02)' }}
              >
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
                  <CheckCircle2 size={11} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 leading-snug">{r.title}</p>
                  {r.summary && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{r.summary}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unresolved IDs */}
      {linkedResearchIds.length > 0 && linkedResearchItems.length < linkedResearchIds.length && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400">{linkedResearchIds.length - linkedResearchItems.length} araştırma yüklenemedi</span>
        </div>
      )}

      {/* Required topics */}
      {requiredTopics.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(248,113,113,0.18)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(248,113,113,0.07)', borderBottom: '1px solid rgba(248,113,113,0.12)' }}>
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-400 tracking-[0.15em] uppercase font-mono">
              Zorunlu Araştırma Konuları ({requiredTopics.length})
            </span>
          </div>
          <ul className="divide-y divide-slate-800/50">
            {requiredTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.1)' }}>
                  <Circle size={9} className="text-red-400" />
                </div>
                <span className="text-sm text-slate-300 leading-relaxed">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional topics */}
      {optionalTopics.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
            <BookOpen size={12} className="text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 tracking-[0.15em] uppercase font-mono">
              Opsiyonel Araştırma Konuları ({optionalTopics.length})
            </span>
          </div>
          <ul className="divide-y divide-slate-800/50">
            {optionalTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <Circle size={9} className="text-indigo-400" />
                </div>
                <span className="text-sm text-slate-400 leading-relaxed">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {hasNoTopics && linkedResearchIds.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <span className="text-sm text-slate-400">Araştırma konuları henüz belirlenmedi.</span>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 gap-3">
        <p className="text-xs text-slate-500 flex-1">
          {canAnalyze
            ? 'Mimari ve fonksiyonel analiz oluşturabilirsiniz.'
            : 'En az bir araştırma eklendiğinde analiz oluşturulabilir.'}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {!!(idea as any).architecturalAnalysis && onOpenProject && (
            <button
              onClick={() => { onClose(); onOpenProject(idea.id); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}
            >
              <LayoutTemplate size={12} />
              Proje Kartı
            </button>
          )}
          <button
            onClick={onGenerateAnalysis}
            disabled={!canAnalyze}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
            style={
              canAnalyze
                ? { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8' }
                : { background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(99,102,241,0.1)', color: 'rgb(71,85,105)', cursor: 'not-allowed' }
            }
          >
            {canAnalyze ? <Sparkles size={12} /> : <Lock size={12} />}
            Analiz Oluştur
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Evaluation ──────────────────────────────────────────────────────────

type EvalScores = {
  commercialFeasibility: number;
  marketNeed: number;
  technicalDifficulty: number;
  trendAlignment: number;
  riskGovernance: number;
  summary: string;
  pivotSuggestion?: string;
};

const SCORE_AXES: { key: keyof Omit<EvalScores, 'summary' | 'pivotSuggestion'>; label: string; color: string }[] = [
  { key: 'commercialFeasibility', label: 'Ticari Fizibilite', color: '#34d399' },
  { key: 'marketNeed',            label: 'Pazar İhtiyacı',   color: '#818cf8' },
  { key: 'technicalDifficulty',   label: 'Teknik Zorluk',    color: '#22d3ee' },
  { key: 'trendAlignment',        label: 'Trend Uyumu',      color: '#a78bfa' },
  { key: 'riskGovernance',        label: 'Risk & Yönetişim', color: '#fbbf24' },
];

function ScoreBar({ score, color }: { score: number; color: string }) {
  const barColor = score >= 7 ? '#34d399' : score >= 5 ? '#fbbf24' : '#f87171';
  const textColor = score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.1)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: barColor, boxShadow: `0 0 8px ${barColor}60` }}
        />
      </div>
      <span className={`text-sm font-bold tabular-nums w-7 text-right font-mono ${textColor}`}>{score}</span>
    </div>
  );
}

function EvaluationTab({ idea }: { idea: Idea }) {
  const scores = (idea as any).evaluationScores as EvalScores | null;
  const evaluatedAt = (idea as any).evaluatedAt;

  if (!evaluatedAt && !scores) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Loader2 size={20} className="animate-spin text-indigo-400" />
        </div>
        <p className="text-sm text-slate-400">Değerlendirme ajanı analiz yapıyor...</p>
        <p className="text-xs text-slate-600">Bu işlem birkaç dakika sürebilir</p>
      </div>
    );
  }

  if (!scores) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <p className="text-sm text-slate-500">Değerlendirme sonucu bulunamadı.</p>
    </div>
  );

  const avgScore = (scores.commercialFeasibility + scores.marketNeed + scores.technicalDifficulty + scores.trendAlignment + scores.riskGovernance) / 5;
  const avgColor = avgScore >= 7 ? '#34d399' : avgScore >= 5 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-5">
      {/* Overall score hero */}
      <div
        className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex flex-col items-center justify-center shrink-0"
          style={{ background: `${avgColor}12`, border: `2px solid ${avgColor}40`, boxShadow: `0 0 20px ${avgColor}20` }}
        >
          <span className="text-xl font-bold font-mono" style={{ color: avgColor }}>{avgScore.toFixed(1)}</span>
          <span className="text-[9px] text-slate-500 font-mono">/10</span>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-mono mb-1">GENEL SKOR</p>
          <p className="text-base font-bold" style={{ color: avgColor }}>
            {avgScore >= 7 ? 'Güçlü Fikir' : avgScore >= 5 ? 'Potansiyelli' : 'Geliştirme Gerekli'}
          </p>
          {evaluatedAt && (
            <p className="text-xs text-slate-600 mt-1 font-mono">
              {new Date(evaluatedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Score bars */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(99,102,241,0.12)' }}
      >
        <div className="px-4 py-2.5" style={{ background: 'rgba(99,102,241,0.07)', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 tracking-[0.15em] uppercase font-mono">Kriter Puanları</span>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
          {SCORE_AXES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-40 shrink-0 font-medium">{label}</span>
              <ScoreBar score={scores[key]} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {scores.summary && (
        <div
          className="rounded-xl px-4 py-4"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}
        >
          <p className="text-[10px] font-bold text-indigo-400 tracking-[0.15em] uppercase font-mono mb-2">Değerlendirme Özeti</p>
          <p className="text-sm text-slate-300 leading-relaxed">{scores.summary}</p>
        </div>
      )}

      {/* Pivot suggestion */}
      {scores.pivotSuggestion && (
        <div
          className="rounded-xl px-4 py-4 flex gap-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)' }}
        >
          <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-amber-400 tracking-[0.15em] uppercase font-mono mb-1.5">Pivot Önerisi</p>
            <p className="text-sm text-slate-300 leading-relaxed">{scores.pivotSuggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Analysis ────────────────────────────────────────────────────────────

type ArchitecturalAnalysis = {
  functionalAnalysis: string;
  technicalAnalysis: string;
  architecturalPlan: string;
  generatedAt: string;
};

function CollapsibleSection({ title, icon, content, accentColor, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  content: string;
  accentColor: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${accentColor}22` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{ background: `${accentColor}08`, borderBottom: open ? `1px solid ${accentColor}18` : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-semibold text-slate-200">{title}</span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-slate-500" />
          : <ChevronRight size={14} className="text-slate-500" />
        }
      </button>
      {open && (
        <div className="px-4 py-4" style={{ background: `${accentColor}04` }}>
          <MarkdownContent content={content} />
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ idea }: { idea: Idea }) {
  const analysis = (idea as any).architecturalAnalysis as ArchitecturalAnalysis | null;

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
        >
          <Layers size={20} className="text-violet-400" />
        </div>
        <p className="text-sm text-slate-400">AI analizi henüz oluşturulmadı.</p>
        <p className="text-xs text-slate-600">Araştırma sekmesinden analiz başlatabilirsiniz.</p>
      </div>
    );
  }

  const generatedDate = analysis.generatedAt
    ? new Date(analysis.generatedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-4">
      {generatedDate && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 font-mono">Son güncelleme: {generatedDate}</span>
        </div>
      )}

      {analysis.functionalAnalysis && (
        <CollapsibleSection
          title="Fonksiyonel Analiz"
          icon={<CheckCircle2 size={13} className="text-emerald-400" />}
          content={analysis.functionalAnalysis}
          accentColor="#34d399"
        />
      )}

      {analysis.technicalAnalysis && (
        <CollapsibleSection
          title="Teknik Analiz"
          icon={<Code2 size={13} className="text-cyan-400" />}
          content={analysis.technicalAnalysis}
          accentColor="#22d3ee"
        />
      )}

      {analysis.architecturalPlan && (
        <CollapsibleSection
          title="Mimari Plan"
          icon={<GitBranch size={13} className="text-violet-400" />}
          content={analysis.architecturalPlan}
          accentColor="#a78bfa"
        />
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-0.5">
      {icon}
      <span className="text-[10px] font-bold text-slate-500 tracking-[0.15em] uppercase font-mono">{label}</span>
    </div>
  );
}

function Section({ label, accent, index, children }: {
  label: string;
  accent: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase font-mono" style={{ color: accent }}>
          {index} // {label}
        </span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}40, transparent)` }} />
      </div>
      {children}
    </section>
  );
}

// ─── Community Thread Panel ───────────────────────────────────────────────────

interface CommunityPost {
  id: number;
  content: string;
  parentPostId?: number;
  reactionCount: number;
  isSolution: boolean;
  createdAt: string;
  authorId: number;
  authorDisplayName: string;
  authorUsername: string;
  authorRole: string;
}

interface CommunityThread {
  id: number;
  title: string;
  replyCount: number;
  isLocked: boolean;
  createdAt: string;
}

const ROLE_ICON_MAP: Record<string, React.ReactNode> = {
  super_admin: <ShieldAlert size={10} className="text-red-400" />,
  moderator:   <Shield size={10} className="text-amber-400" />,
  master:      <Crown size={10} className="text-violet-400" />,
  user:        <UserIcon size={10} className="text-slate-500" />,
};

function threadTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

function CommunityThreadPanel({ linkedType, linkedId }: {
  linkedType: 'idea' | 'research';
  linkedId: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadEndpoint = linkedType === 'idea'
    ? `/community/thread-by-idea/${linkedId}`
    : `/community/thread-by-research/${linkedId}`;

  const { data: thread, isLoading: loadingThread } = useQuery<CommunityThread>({
    queryKey: ['community-linked-thread', linkedType, linkedId],
    queryFn: () => authFetch<CommunityThread>(threadEndpoint),
    retry: 1,
  });

  const { data: posts, isLoading: loadingPosts } = useQuery<CommunityPost[]>({
    queryKey: ['community-posts', thread?.id],
    queryFn: () => authFetch<CommunityPost[]>(`/community/threads/${thread!.id}/posts`),
    enabled: !!thread,
    staleTime: 20_000,
  });

  const mutPost = useMutation({
    mutationFn: (text: string) =>
      authFetch(`/community/threads/${thread!.id}/posts`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-posts', thread?.id] });
      qc.invalidateQueries({ queryKey: ['community-linked-thread', linkedType, linkedId] });
      setContent('');
    },
  });

  useEffect(() => {
    if (posts?.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts?.length]);

  if (loadingThread) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-slate-600 italic">
        Tartışma henüz oluşturulmadı…
      </div>
    );
  }

  const allPosts = posts ?? [];

  return (
    <div className="space-y-3">
      {/* Thread stats */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><MessageSquare size={10} /> {thread.replyCount} yanıt</span>
        {thread.isLocked && <span className="flex items-center gap-1 text-red-400"><Lock size={10} /> Kilitli</span>}
      </div>

      {/* Posts list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(34,211,238,0.12)', background: 'rgba(34,211,238,0.03)' }}
      >
        {loadingPosts ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={14} className="text-cyan-400 animate-spin" />
          </div>
        ) : allPosts.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-600">
            Henüz yorum yok. İlk yorumu yaz!
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(34,211,238,0.08)' }}>
            {allPosts.map(post => (
              <div key={post.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: 'rgba(34,211,238,0.2)', border: '1px solid rgba(34,211,238,0.3)' }}
                  >
                    {post.authorDisplayName[0]?.toUpperCase()}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    {ROLE_ICON_MAP[post.authorRole]} {post.authorDisplayName}
                  </span>
                  {post.isSolution && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 ml-1">
                      <CheckCircle2 size={9} /> Çözüm
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-slate-600">{threadTimeAgo(post.createdAt)}</span>
                </div>
                <p className="text-[12px] text-slate-300 leading-relaxed pl-8 whitespace-pre-wrap">{post.content}</p>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {user && !thread.isLocked ? (
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (content.trim()) mutPost.mutate(content); } }}
            placeholder="Yorumunuzu yazın… (Ctrl+Enter gönderir)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,211,238,0.18)' }}
          />
          <button
            onClick={() => { if (content.trim()) mutPost.mutate(content); }}
            disabled={!content.trim() || mutPost.isPending}
            className="px-3 rounded-xl text-cyan-400 disabled:opacity-30 transition-all shrink-0 self-end pb-2"
            style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}
          >
            {mutPost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      ) : !user ? (
        <p className="text-[11px] text-slate-600 italic text-center">Yorum yazmak için giriş yapın</p>
      ) : null}
    </div>
  );
}
