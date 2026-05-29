import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, AlertTriangle, Users, Circle, BookOpen, Sparkles, Lock,
  TrendingUp, Lightbulb, Loader2, RefreshCw, ChevronDown, ChevronRight,
  GitBranch, Code2, Layers, LayoutTemplate, FileText, Tag, List, BarChart2,
  MessageSquare, Send, Shield, Crown, ShieldAlert, User as UserIcon, Star,
} from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Research, Idea } from '@workspace/api-client-react';
import { CyberBadge } from '../ui/CyberBadge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth, authFetch } from '@/lib/auth-context';
import { API_ORIGIN } from '@/lib/api-config';
import { ManualLinkModal } from './ManualLinkModal';

function sendToChat(message: string) {
  window.dispatchEvent(new CustomEvent('think-inn:send-message', { detail: { message } }));
}

function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm max-w-none leading-relaxed
        prose-p:my-2 prose-p:leading-relaxed prose-p:text-on-surface-variant
        prose-strong:text-on-surface prose-strong:font-semibold
        prose-ul:my-2 prose-li:my-1 prose-li:text-on-surface-variant
        prose-ol:my-2 prose-ol:text-on-surface-variant
        prose-headings:text-on-surface prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
        prose-h2:text-base prose-h3:text-sm
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs
        prose-blockquote:border-l-primary prose-blockquote:text-on-surface-variant
        prose-hr:border-outline-variant
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
  icon: import('lucide-react').LucideIcon;
  accent: string;
}

const IDEA_TABS: IdeaTab[] = [
  { id: 'overview',    label: 'Genel Bakış',  icon: FileText,       accent: '#1463F3' },
  { id: 'research',    label: 'Araştırmalar', icon: BookOpen,       accent: '#20C997' },
  { id: 'evaluation',  label: 'Değerlendirme', icon: BarChart2,     accent: '#FFB020' },
  { id: 'analysis',    label: 'AI Analiz',    icon: Layers,         accent: '#7A5CFF' },
  { id: 'community',   label: 'Topluluk',     icon: MessageSquare, accent: '#18C9E8' },
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
        {/* Backdrop — Material You overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#071B3A]/35 backdrop-blur-sm"
        />

        {/* Panel — beyaz Material You yüzey */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="relative z-10 flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[24px] border border-outline-variant bg-white shadow-[0_40px_80px_rgba(7,27,58,0.30)]"
        >
          {/* Top accent line — brand gradient */}
          <div
            className="h-1 w-full shrink-0"
            style={{
              background:
                type === 'idea'
                  ? 'linear-gradient(90deg,#18C9E8,#1463F3,#7A5CFF)'
                  : 'linear-gradient(90deg,#7A5CFF,#1463F3)',
            }}
          />

          {/* Header — referans cm-head: kind ikon + eyebrow + başlık + oy/kapat */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant px-7 py-[22px]">
            <div className="flex min-w-0 flex-1 items-start gap-3.5">
              {/* Kind-renkli ikon kutusu */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={
                  type === 'research'
                    ? { background: 'rgba(24,201,232,0.12)', color: '#0A8FA8' }
                    : { background: 'rgba(20,99,243,0.10)', color: '#1463F3' }
                }
              >
                {type === 'research' ? <BookOpen size={24} /> : <Lightbulb size={24} />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  {type === 'research' ? 'ARAŞTIRMA' : (item as any).architecturalAnalysis ? 'PROJE' : 'FİKİR'}
                  {(item as any).category ? ` · ${(item as any).category}` : ''}
                </div>
                <h1 className="mt-1 font-heading text-[22px] font-bold leading-snug text-on-surface">
                  {item.title}
                </h1>
                <div className="mt-2 flex items-center gap-2.5 text-[12px] text-on-surface-variant">
                  <span className="flex items-center gap-1.5">
                    <Users size={11} className="text-outline" />
                    <span className="font-medium text-on-surface">{item.authorName}</span>
                  </span>
                  <span className="text-outline-variant">·</span>
                  <span>{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: tr })}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Oy göstergesi (referans cm-star) */}
              <span className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[12px] font-bold text-on-surface">
                <Star size={14} className="text-risk" />
                {Math.max(0, item.voteCount ?? 0)} oy
              </span>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant transition-colors hover:border-outline-strong hover:bg-background"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>
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
    : hasImage ? `${API_ORIGIN}/api/research/${research.id}/cover` : null;

  return (
    <div className="space-y-6">
      {imageSrc && (
        <div className="w-full h-52 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(20,99,243,0.15)' }}>
          <img src={imageSrc} alt={research.title} className="w-full h-full object-cover" />
        </div>
      )}

      {research.summary && (
        <div
          className="rounded-xl px-5 py-4 relative overflow-hidden"
          style={{ background: 'rgba(20,99,243,0.07)', border: '1px solid rgba(20,99,243,0.18)' }}
        >
          <div className="absolute top-0 left-0 w-0.5 h-full" style={{ background: 'linear-gradient(to bottom, #18C9E8, #7A5CFF)' }} />
          <p className="text-[9px] font-bold text-primary tracking-[0.18em] uppercase font-mono mb-2.5">Yönetici Özeti</p>
          <MarkdownContent content={research.summary} />
        </div>
      )}

      {research.findings && (
        <Section label="Bulgular" accent="#20C997" index="01">
          <MarkdownContent content={research.findings} />
        </Section>
      )}

      {research.technicalAnalysis && (
        <Section label="Teknik Analiz" accent="#18C9E8" index="02">
          <MarkdownContent content={research.technicalAnalysis} />
        </Section>
      )}

      {research.tags && research.tags.length > 0 && (
        <div className="pt-4" style={{ borderTop: '1px solid rgba(20,99,243,0.1)' }}>
          <div className="flex flex-wrap gap-2">
            {research.tags.map(tag => (
              <span
                key={tag}
                className="text-[11px] font-medium text-secondary px-3 py-1 rounded-full font-mono"
                style={{ background: 'rgba(122,92,255,0.08)', border: '1px solid rgba(122,92,255,0.2)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Community discussion */}
      <div className="pt-4" style={{ borderTop: '1px solid rgba(20,99,243,0.1)' }}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={13} className="text-tertiary" />
          <span className="text-[11px] font-bold text-tertiary uppercase tracking-wider">Topluluk Tartışması</span>
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
  const { user } = useAuth();
  const isAdmin = !!user;
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
      await fetch(`${API_ORIGIN}/api/ideas/${idea.id}/re-evaluate`, { method: 'POST' });
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
      {/* Tab bar — Material You */}
      <div className="flex shrink-0 items-center gap-1 border-b border-outline-variant bg-background/40 px-4 pb-0 pt-3">
        {IDEA_TABS.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'research' ? researchBadge : tab.id === 'evaluation' ? evalBadge : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'relative flex items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-xs font-semibold transition-all duration-200',
                isActive
                  ? 'border-b-2 border-primary bg-primary/[0.08] text-primary'
                  : 'border-b-2 border-transparent text-on-surface-variant hover:bg-background hover:text-on-surface',
              ].join(' ')}
            >
              <TabIcon size={13} />
              <span>{tab.label}</span>
              {badge !== null && (
                <span
                  className={[
                    'ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    tab.id === 'research' && requiredTopics.length > 0
                      ? 'bg-risk/15 text-risk'
                      : isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant',
                  ].join(' ')}
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
                isAdmin={isAdmin}
                allResearch={allResearch}
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
  // Gerçek istatistikler (mock yok)
  const links = (idea.relatedTo?.length ?? 0) + (idea.researchIds?.length ?? 0);
  const collaborators = idea.collaborators?.length ?? 0;
  const ev = (idea as any).evaluationScores as { commercialFeasibility: number; marketNeed: number; technicalDifficulty: number; trendAlignment: number; riskGovernance: number } | null;
  const maturity = ev
    ? Math.round(((ev.commercialFeasibility + ev.marketNeed + ev.technicalDifficulty + ev.trendAlignment + ev.riskGovernance) / 5) * 10)
    : Math.min(95, (idea.voteCount ?? 0) * 5 + links * 10);

  return (
    <div className="space-y-6">
      {/* İstatistik satırı (referans cm-stat-row) — gerçek veri */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Oy", v: String(Math.max(0, idea.voteCount ?? 0)) },
          { l: "Bağlantı", v: String(links) },
          { l: "Katkıda Bulunan", v: String(collaborators) },
          { l: "AI Olgunluk", v: `%${maturity}`, brand: true },
        ].map((s) => (
          <div key={s.l} className="rounded-[14px] border border-outline-variant bg-surface-container-low px-4 py-3 text-center">
            <div className={`font-display text-[22px] font-bold leading-none ${s.brand ? "text-primary" : "text-on-surface"}`}>{s.v}</div>
            <div className="overline mt-1.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ background: 'rgba(20,99,243,0.05)', border: '1px solid rgba(20,99,243,0.12)' }}
      >
        <SectionHeader label="Açıklama" icon={<FileText size={13} className="text-primary" />} />
        <div className="mt-3">
          <MarkdownContent content={idea.description} />
        </div>
      </div>

      {/* Roadmap */}
      {idea.roadmap && idea.roadmap.length > 0 && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(24,201,232,0.04)', border: '1px solid rgba(24,201,232,0.12)' }}
        >
          <SectionHeader label="Yol Haritası" icon={<List size={13} className="text-tertiary" />} />
          <ol className="mt-3 space-y-2.5">
            {idea.roadmap.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono mt-0.5"
                  style={{ background: 'rgba(24,201,232,0.12)', color: '#18C9E8', border: '1px solid rgba(24,201,232,0.2)' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm text-on-surface leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Collaborators */}
      {idea.collaborators && idea.collaborators.length > 0 && (
        <div
          className="rounded-xl px-5 py-4"
          style={{ background: 'rgba(122,92,255,0.04)', border: '1px solid rgba(122,92,255,0.12)' }}
        >
          <SectionHeader label="İş Birlikçiler" icon={<Users size={13} className="text-secondary" />} />
          <div className="mt-3 flex flex-wrap gap-2">
            {idea.collaborators.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{ background: 'rgba(122,92,255,0.08)', border: '1px solid rgba(122,92,255,0.15)' }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(122,92,255,0.2)', color: '#7A5CFF' }}
                >
                  {c.charAt(0).toUpperCase()}
                </div>
                <span className="text-on-surface">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {idea.tags && idea.tags.length > 0 && (
        <div>
          <SectionHeader label="Etiketler" icon={<Tag size={13} className="text-primary" />} />
          <div className="mt-3 flex flex-wrap gap-2">
            {idea.tags.map(tag => (
              <span
                key={tag}
                className="text-xs font-medium text-primary px-3 py-1 rounded-full font-mono"
                style={{ background: 'rgba(20,99,243,0.1)', border: '1px solid rgba(20,99,243,0.2)' }}
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
  idea, isAdmin, allResearch = [], linkedResearchItems, linkedResearchIds, requiredTopics, optionalTopics,
  canAnalyze, isReEvaluating, onReEvaluate, onGenerateAnalysis, onClose, onOpenProject,
}: {
  idea: Idea;
  isAdmin?: boolean;
  allResearch?: Research[];
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
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* Manuel bağlantı butonu — yalnızca admin (içerik düzenler) */}
      {isAdmin && (
        <button
          onClick={() => setShowLinkModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] py-3 text-[13px] font-semibold text-primary transition-all hover:border-primary/50 hover:bg-primary/[0.08]"
        >
          <Tag size={14} />
          Manuel Araştırma Bağla
        </button>
      )}

      {/* Manuel bağlantı modalı */}
      {showLinkModal && (
        <ManualLinkModal
          ideaId={idea.id}
          ideaTitle={idea.title}
          currentResearchIds={linkedResearchIds}
          allResearch={allResearch}
          onClose={() => setShowLinkModal(false)}
        />
      )}
      {/* Status bar */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: allCovered ? 'rgba(32,201,151,0.06)' : requiredTopics.length > 0 ? 'rgba(251,191,36,0.06)' : 'rgba(20,99,243,0.06)',
          border: `1px solid ${allCovered ? 'rgba(32,201,151,0.2)' : requiredTopics.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(20,99,243,0.15)'}`,
        }}
      >
        <div className="flex items-center gap-2">
          {allCovered ? (
            <CheckCircle2 size={14} className="text-[#157A3A]" />
          ) : requiredTopics.length > 0 ? (
            <AlertTriangle size={14} className="text-risk" />
          ) : (
            <Circle size={14} className="text-on-surface-variant" />
          )}
          <span className="text-sm font-semibold" style={{ color: allCovered ? '#20C997' : requiredTopics.length > 0 ? '#FFB020' : 'rgb(148,163,184)' }}>
            {allCovered
              ? 'Tüm zorunlu konular karşılandı'
              : requiredTopics.length > 0
                ? `${requiredTopics.length} zorunlu konu eksik`
                : 'Araştırma konuları bekleniyor'}
          </span>
        </div>
        {isAdmin && (
          <button
            onClick={onReEvaluate}
            disabled={isReEvaluating}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-all disabled:opacity-50"
            style={{ background: 'rgba(20,99,243,0.10)', border: '1px solid rgba(20,99,243,0.20)' }}
          >
            <RefreshCw size={11} className={isReEvaluating ? 'animate-spin' : ''} />
            {isReEvaluating ? 'Yenileniyor...' : 'Yeniden Değerlendir'}
          </button>
        )}
      </div>

      {/* Linked research */}
      {linkedResearchItems.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(32,201,151,0.18)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(32,201,151,0.07)', borderBottom: '1px solid rgba(32,201,151,0.12)' }}>
            <CheckCircle2 size={12} className="text-[#157A3A]" />
            <span className="text-[10px] font-bold text-[#157A3A] tracking-[0.15em] uppercase font-mono">
              Bağlı Araştırmalar ({linkedResearchItems.length})
            </span>
          </div>
          <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {linkedResearchItems.map(r => (
              <li
                key={r.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors"
                style={{ background: 'rgba(32,201,151,0.02)' }}
              >
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(32,201,151,0.12)' }}>
                  <CheckCircle2 size={11} className="text-[#157A3A]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-snug">{r.title}</p>
                  {r.summary && (
                    <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">{r.summary}</p>
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
          <AlertTriangle size={12} className="text-risk shrink-0" />
          <span className="text-xs text-risk">{linkedResearchIds.length - linkedResearchItems.length} araştırma yüklenemedi</span>
        </div>
      )}

      {/* Required topics */}
      {requiredTopics.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.18)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
            <AlertTriangle size={12} className="text-error" />
            <span className="text-[10px] font-bold text-error tracking-[0.15em] uppercase font-mono">
              Zorunlu Araştırma Konuları ({requiredTopics.length})
            </span>
          </div>
          <ul className="divide-y divide-outline-variant/50">
            {requiredTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <Circle size={9} className="text-error" />
                </div>
                <span className="text-sm text-on-surface leading-relaxed">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional topics */}
      {optionalTopics.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(20,99,243,0.15)' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(20,99,243,0.06)', borderBottom: '1px solid rgba(20,99,243,0.1)' }}>
            <BookOpen size={12} className="text-primary" />
            <span className="text-[10px] font-bold text-primary tracking-[0.15em] uppercase font-mono">
              Opsiyonel Araştırma Konuları ({optionalTopics.length})
            </span>
          </div>
          <ul className="divide-y divide-outline-variant/50">
            {optionalTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(20,99,243,0.08)' }}>
                  <Circle size={9} className="text-primary" />
                </div>
                <span className="text-sm text-on-surface-variant leading-relaxed">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {hasNoTopics && linkedResearchIds.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-4 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <AlertTriangle size={15} className="text-risk shrink-0" />
          <span className="text-sm text-on-surface-variant">Araştırma konuları henüz belirlenmedi.</span>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {isAdmin && (
          <p className="flex-1 text-xs text-on-surface-variant">
            {canAnalyze
              ? 'Mimari ve fonksiyonel analiz oluşturabilirsiniz.'
              : 'En az bir araştırma eklendiğinde analiz oluşturulabilir.'}
          </p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Proje Kartı — proje görünümü herkese açık (read-only) */}
          {!!(idea as any).architecturalAnalysis && onOpenProject && (
            <button
              onClick={() => { onClose(); onOpenProject(idea.id); }}
              className="flex items-center gap-1.5 rounded-lg border border-secondary/25 bg-secondary/[0.10] px-3.5 py-2 text-xs font-semibold text-secondary transition-all"
            >
              <LayoutTemplate size={12} />
              Proje Kartı
            </button>
          )}
          {/* Analiz Oluştur — yalnızca admin (içerik üretir) */}
          {isAdmin && (
            <button
              onClick={onGenerateAnalysis}
              disabled={!canAnalyze}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
              style={
                canAnalyze
                  ? { background: 'rgba(20,99,243,0.12)', border: '1px solid rgba(20,99,243,0.30)', color: '#1463F3' }
                  : { background: '#F4F7FE', border: '1px solid #E8EEF9', color: '#94A0B8', cursor: 'not-allowed' }
              }
            >
              {canAnalyze ? <Sparkles size={12} /> : <Lock size={12} />}
              Derin Analiz Başlat
            </button>
          )}
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
  { key: 'commercialFeasibility', label: 'Ticari Fizibilite', color: '#20C997' },
  { key: 'marketNeed',            label: 'Pazar İhtiyacı',   color: '#1463F3' },
  { key: 'technicalDifficulty',   label: 'Teknik Zorluk',    color: '#18C9E8' },
  { key: 'trendAlignment',        label: 'Trend Uyumu',      color: '#7A5CFF' },
  { key: 'riskGovernance',        label: 'Risk & Yönetişim', color: '#FFB020' },
];

function ScoreBar({ score }: { score: number; color?: string }) {
  // Renk eşik: 7+ yeşil, 5+ amber, altı kırmızı
  const barColor = score >= 7 ? '#22C55E' : score >= 5 ? '#FFB020' : '#EF4444';
  const labelColor = score >= 7 ? 'text-[#157A3A]' : score >= 5 ? 'text-[#B0292B]/80' : 'text-error';
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: barColor }}
        />
      </div>
      <span className={`w-8 text-right text-sm font-bold tabular-nums ${labelColor}`}>
        {score}
      </span>
    </div>
  );
}

function EvaluationTab({ idea }: { idea: Idea }) {
  const scores = (idea as any).evaluationScores as EvalScores | null;
  const evaluatedAt = (idea as any).evaluatedAt;

  if (!evaluatedAt && !scores) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-full shadow-md">
          <Loader2 size={22} className="animate-spin text-white" />
        </div>
        <p className="font-heading text-[15px] font-bold text-on-surface">
          Değerlendirme ajanı analiz yapıyor...
        </p>
        <p className="text-[12px] text-on-surface-variant">
          AI fikrini puanlıyor — bu işlem birkaç dakika sürebilir
        </p>
      </div>
    );
  }

  if (!scores) return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <p className="text-sm text-on-surface-variant">Değerlendirme sonucu bulunamadı.</p>
    </div>
  );

  const avgScore = (scores.commercialFeasibility + scores.marketNeed + scores.technicalDifficulty + scores.trendAlignment + scores.riskGovernance) / 5;
  const avgColor = avgScore >= 7 ? '#22C55E' : avgScore >= 5 ? '#FFB020' : '#EF4444';
  const verdict = avgScore >= 7 ? 'Güçlü Fikir' : avgScore >= 5 ? 'Potansiyelli' : 'Geliştirme Gerekli';

  return (
    <div className="space-y-5">
      {/* Overall score hero */}
      <div className="flex items-center gap-5 rounded-[14px] border border-outline-variant bg-white p-5 shadow-sm">
        <div
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full"
          style={{
            background: `${avgColor}15`,
            border: `3px solid ${avgColor}40`,
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: avgColor }}>
            {avgScore.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold text-on-surface-variant">/10</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="overline mb-1">Genel Skor</div>
          <div className="font-heading text-[18px] font-bold" style={{ color: avgColor }}>
            {verdict}
          </div>
          {evaluatedAt && (
            <p className="mt-1 text-[11px] text-outline">
              {new Date(evaluatedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{' '}
              tarihli değerlendirme
            </p>
          )}
        </div>
      </div>

      {/* Score bars */}
      <div className="overflow-hidden rounded-[14px] border border-outline-variant">
        <div className="border-b border-outline-variant bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-primary" />
            <span className="overline">Kriter Puanları</span>
          </div>
        </div>
        <div className="space-y-4 bg-white px-4 py-4">
          {SCORE_AXES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-[13px] font-semibold text-on-surface">
                {label}
              </span>
              <ScoreBar score={scores[key]} />
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {scores.summary && (
        <div className="rounded-[14px] border border-primary/20 bg-primary/[0.05] px-5 py-4">
          <div className="overline mb-2 flex items-center gap-1.5 text-primary">
            <Sparkles size={12} />
            Değerlendirme Özeti
          </div>
          <p className="text-[13px] leading-relaxed text-on-surface">{scores.summary}</p>
        </div>
      )}

      {/* Pivot suggestion */}
      {scores.pivotSuggestion && (
        <div
          className="rounded-xl px-4 py-4 flex gap-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)' }}
        >
          <Lightbulb size={14} className="text-risk mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-risk tracking-[0.15em] uppercase font-mono mb-1.5">Pivot Önerisi</p>
            <p className="text-sm text-on-surface leading-relaxed">{scores.pivotSuggestion}</p>
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
          <span className="text-sm font-semibold text-on-surface">{title}</span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-on-surface-variant" />
          : <ChevronRight size={14} className="text-on-surface-variant" />
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
          style={{ background: 'rgba(122,92,255,0.1)', border: '1px solid rgba(122,92,255,0.2)' }}
        >
          <Layers size={20} className="text-secondary" />
        </div>
        <p className="text-sm text-on-surface-variant">AI analizi henüz oluşturulmadı.</p>
        <p className="text-xs text-outline">Araştırma sekmesinden analiz başlatabilirsiniz.</p>
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
          <span className="text-[10px] text-outline font-mono">Son güncelleme: {generatedDate}</span>
        </div>
      )}

      {analysis.functionalAnalysis && (
        <CollapsibleSection
          title="Fonksiyonel Analiz"
          icon={<CheckCircle2 size={13} className="text-[#157A3A]" />}
          content={analysis.functionalAnalysis}
          accentColor="#20C997"
        />
      )}

      {analysis.technicalAnalysis && (
        <CollapsibleSection
          title="Teknik Analiz"
          icon={<Code2 size={13} className="text-tertiary" />}
          content={analysis.technicalAnalysis}
          accentColor="#18C9E8"
        />
      )}

      {analysis.architecturalPlan && (
        <CollapsibleSection
          title="Mimari Plan"
          icon={<GitBranch size={13} className="text-secondary" />}
          content={analysis.architecturalPlan}
          accentColor="#7A5CFF"
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
      <span className="text-[10px] font-bold text-on-surface-variant tracking-[0.15em] uppercase font-mono">{label}</span>
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
  super_admin: <ShieldAlert size={10} className="text-error" />,
  moderator:   <Shield size={10} className="text-risk" />,
  master:      <Crown size={10} className="text-secondary" />,
  user:        <UserIcon size={10} className="text-on-surface-variant" />,
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
        <Loader2 size={16} className="text-tertiary animate-spin" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-outline italic">
        Tartışma henüz oluşturulmadı…
      </div>
    );
  }

  const allPosts = posts ?? [];

  return (
    <div className="space-y-3">
      {/* Thread stats */}
      <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1"><MessageSquare size={10} /> {thread.replyCount} yanıt</span>
        {thread.isLocked && <span className="flex items-center gap-1 text-error"><Lock size={10} /> Kilitli</span>}
      </div>

      {/* Posts list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(24,201,232,0.12)', background: 'rgba(24,201,232,0.03)' }}
      >
        {loadingPosts ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={14} className="text-tertiary animate-spin" />
          </div>
        ) : allPosts.length === 0 ? (
          <div className="text-center py-6 text-xs text-outline">
            Henüz yorum yok. İlk yorumu yaz!
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(24,201,232,0.08)' }}>
            {allPosts.map(post => (
              <div key={post.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: 'rgba(24,201,232,0.2)', border: '1px solid rgba(24,201,232,0.3)' }}
                  >
                    {post.authorDisplayName[0]?.toUpperCase()}
                  </div>
                  <span className="text-[11px] font-semibold text-on-surface flex items-center gap-1">
                    {ROLE_ICON_MAP[post.authorRole]} {post.authorDisplayName}
                  </span>
                  {post.isSolution && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#157A3A] ml-1">
                      <CheckCircle2 size={9} /> Çözüm
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-outline">{threadTimeAgo(post.createdAt)}</span>
                </div>
                <p className="text-[12px] text-on-surface leading-relaxed pl-8 whitespace-pre-wrap">{post.content}</p>
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
            className="flex-1 px-3 py-2 rounded-xl text-xs text-on-surface placeholder:text-outline outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(24,201,232,0.18)' }}
          />
          <button
            onClick={() => { if (content.trim()) mutPost.mutate(content); }}
            disabled={!content.trim() || mutPost.isPending}
            className="px-3 rounded-xl text-tertiary disabled:opacity-30 transition-all shrink-0 self-end pb-2"
            style={{ background: 'rgba(24,201,232,0.08)', border: '1px solid rgba(24,201,232,0.2)' }}
          >
            {mutPost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      ) : !user ? (
        <p className="text-[11px] text-outline italic text-center">Yorum yazmak için giriş yapın</p>
      ) : null}
    </div>
  );
}
