import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Users, Circle, BookOpen } from 'lucide-react';
import { Research, Idea } from '@workspace/api-client-react';
import { CyberBadge } from '../ui/CyberBadge';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

export function CardDetailModal({ item, type, onClose }: {
  item: Research | Idea | null;
  type: 'research' | 'idea' | null;
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
              <IdeaDetail idea={item as Idea} />
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

function IdeaDetail({ idea }: { idea: Idea }) {
  const linkedCount = idea.researchIds?.length ?? 0;
  const topics: string[] = (idea as any).neededResearchTopics ?? [];
  const totalTopics = topics.length;
  const coveredCount = Math.min(linkedCount, totalTopics);
  const allCovered = totalTopics > 0 && coveredCount >= totalTopics;

  return (
    <div className="space-y-8">

      {/* Research Topics Checklist */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Araştırma Konuları</span>
          </div>
          {totalTopics > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              allCovered
                ? 'bg-green-100 text-green-700'
                : coveredCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}>
              {coveredCount}/{totalTopics} araştırıldı
            </span>
          )}
        </div>

        {totalTopics > 0 ? (
          <ul className="divide-y divide-gray-50">
            {topics.map((topic, i) => {
              const covered = i < coveredCount;
              return (
                <li key={i} className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${
                  covered ? 'bg-green-50/40' : 'bg-white'
                }`}>
                  {covered ? (
                    <CheckCircle2 size={17} className="text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle size={17} className="text-gray-300 mt-0.5 shrink-0" />
                  )}
                  <span className={`text-sm leading-snug ${covered ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                    {topic}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-4">
            {linkedCount > 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 size={16} />
                <span className="text-sm font-medium">{linkedCount} araştırma bağlı</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle size={16} />
                <span className="text-sm">Araştırma konuları henüz belirlenmedi.</span>
              </div>
            )}
          </div>
        )}

        <div className={`px-5 py-3 border-t ${allCovered ? 'border-green-100 bg-green-50/40' : 'border-gray-100 bg-gray-50/60'}`}>
          {allCovered ? (
            <p className="text-xs text-green-700">
              Tüm konular araştırıldı — asistana mimari şema veya fonksiyonel analiz isteyebilirsiniz.
            </p>
          ) : totalTopics > 0 ? (
            <p className="text-xs text-gray-500">
              Kalan konular araştırıldıktan sonra asistandan mimari şema ve fonksiyonel analiz talep edebilirsiniz.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Araştırma eklemek için asistana bu fikir hakkındaki araştırma metinlerini paylaşın.
            </p>
          )}
        </div>
      </div>

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
