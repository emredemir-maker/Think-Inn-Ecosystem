import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash, Plus, MessageSquare, Pin, Lock, Star, ChevronLeft,
  Send, ThumbsUp, Heart, Lightbulb, Flame, CheckCircle2,
  LayoutGrid, ArrowLeft, Shield, Crown, User, ShieldAlert,
  Eye, Clock, Loader2, AlertCircle, X, ChevronDown, ChevronUp,
  Quote, BookOpen, FileText, ExternalLink
} from "lucide-react";
import { useAuth, authFetch } from "@/lib/auth-context";

// ── Types ────────────────────────────────────────────────────────────────────

interface Space {
  id: number; name: string; slug: string; description: string;
  icon?: string; color?: string; threadCount: number; createdAt: string;
}

interface Thread {
  id: number; spaceId: number; title: string; body: string;
  isPinned: boolean; isLocked: boolean; isFeatured: boolean;
  replyCount: number; viewCount: number;
  lastActivityAt: string; createdAt: string;
  linkedIdeaId?: number; linkedResearchId?: number;
  authorId: number; authorDisplayName: string;
  authorUsername: string; authorAvatarUrl?: string;
  authorRole: string;
}

interface Post {
  id: number; content: string; parentPostId?: number;
  isHidden: boolean; isSolution: boolean; reactionCount: number;
  createdAt: string; updatedAt: string;
  authorId: number; authorDisplayName: string;
  authorUsername: string; authorAvatarUrl?: string; authorRole: string;
}

type UserRole = "super_admin" | "moderator" | "master" | "user";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ReactNode> = {
  super_admin: <ShieldAlert size={10} className="text-red-400" />,
  moderator:   <Shield size={10} className="text-amber-400" />,
  master:      <Crown size={10} className="text-violet-400" />,
  user:        <User size={10} className="text-slate-500" />,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

const EMOJIS = [
  { key: "upvote", icon: <ThumbsUp size={13} />, label: "👍" },
  { key: "heart", icon: <Heart size={13} />, label: "❤️" },
  { key: "lightbulb", icon: <Lightbulb size={13} />, label: "💡" },
  { key: "fire", icon: <Flame size={13} />, label: "🔥" },
] as const;

const ACCENT = "#6366f1";

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user, isRole } = useAuth();
  const qc = useQueryClient();

  const [activeSpaceId, setActiveSpaceId] = useState<number | null>(null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyParent, setReplyParent] = useState<number | undefined>(undefined);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Spaces
  const { data: spacesData, isLoading: loadingSpaces } = useQuery({
    queryKey: ["community-spaces"],
    queryFn: () => authFetch<Space[]>("/community/spaces"),
    staleTime: 60_000,
  });
  const spaces = spacesData ?? [];
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

  // Threads
  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ["community-threads", activeSpaceId],
    queryFn: () => authFetch<Thread[]>(`/community/spaces/${activeSpaceId}/threads`),
    enabled: activeSpaceId !== null,
    staleTime: 30_000,
  });
  const threads = threadsData ?? [];

  // Posts
  const { data: postsData, isLoading: loadingPosts } = useQuery({
    queryKey: ["community-posts", activeThread?.id],
    queryFn: () => authFetch<Post[]>(`/community/threads/${activeThread!.id}/posts`),
    enabled: activeThread !== null,
    staleTime: 20_000,
  });
  const posts = postsData ?? [];

  // Mutations
  const mutPost = useMutation({
    mutationFn: ({ threadId, content, parentPostId }: { threadId: number; content: string; parentPostId?: number }) =>
      authFetch(`/community/threads/${threadId}/posts`, {
        method: "POST",
        body: JSON.stringify({ content, parentPostId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-posts", activeThread?.id] });
      qc.invalidateQueries({ queryKey: ["community-threads", activeSpaceId] });
      setReplyContent("");
      setReplyParent(undefined);
    },
  });

  const mutReaction = useMutation({
    mutationFn: ({ targetType, targetId, emoji }: { targetType: "thread" | "post"; targetId: number; emoji: string }) =>
      authFetch("/community/reactions", { method: "POST", body: JSON.stringify({ targetType, targetId, emoji }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-posts", activeThread?.id] }),
  });

  const mutPin = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      authFetch(`/community/threads/${id}/${pinned ? "unpin" : "pin"}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["community-threads", activeSpaceId] }),
  });

  const mutLock = useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) =>
      authFetch(`/community/threads/${id}/${locked ? "unlock" : "lock"}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-threads", activeSpaceId] });
      if (activeThread) setActiveThread((t) => t ? { ...t, isLocked: !t.isLocked } : t);
    },
  });

  function sendReply() {
    if (!replyContent.trim() || !activeThread) return;
    mutPost.mutate({ threadId: activeThread.id, content: replyContent, parentPostId: replyParent });
  }

  function insertQuote(text: string) {
    const quoted = text
      .split("\n")
      .filter(l => l.trim())
      .map(l => `> ${l}`)
      .join("\n");
    setReplyContent(prev => (prev ? prev + "\n\n" : "") + quoted + "\n\n");
    setTimeout(() => {
      replyRef.current?.focus();
      replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Spaces Sidebar ───────────────────────────────────────── */}
      <div
        className="w-56 shrink-0 flex flex-col overflow-hidden"
        style={{
          background: "rgba(6,9,20,0.8)",
          borderRight: "1px solid rgba(99,102,241,0.15)",
        }}
      >
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Topluluk Alanları</p>
          {loadingSpaces ? (
            <div className="flex items-center justify-center py-6"><Loader2 size={16} className="text-indigo-400 animate-spin" /></div>
          ) : spaces.length === 0 ? (
            <p className="text-xs text-slate-600 italic text-center py-4">Henüz alan yok</p>
          ) : (
            <div className="space-y-0.5">
              {spaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSpaceId(s.id); setActiveThread(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left"
                  style={
                    activeSpaceId === s.id
                      ? { background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderLeft: `2px solid ${s.color ?? ACCENT}` }
                      : { color: "#64748b", borderLeft: "2px solid transparent" }
                  }
                >
                  <Hash size={13} style={{ color: s.color ?? ACCENT, opacity: activeSpaceId === s.id ? 1 : 0.5 }} />
                  <span className="truncate font-medium">{s.name}</span>
                  {s.threadCount > 0 && (
                    <span className="ml-auto text-[10px] text-slate-600">{s.threadCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {isRole("master") && (
          <div className="px-4 pb-4 mt-auto">
            <button
              onClick={() => setShowCreateSpace(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-indigo-400 transition-all"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <Plus size={13} /> Yeni Alan
            </button>
          </div>
        )}
      </div>

      {/* ── Thread List ──────────────────────────────────────────── */}
      <div
        className="w-72 shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: "1px solid rgba(99,102,241,0.1)" }}
      >
        {!activeSpace ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <LayoutGrid size={32} className="text-indigo-400/30 mb-3" />
            <p className="text-slate-500 text-sm">Bir topluluk alanı seçin</p>
          </div>
        ) : (
          <>
            {/* Space header */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Hash size={16} style={{ color: activeSpace.color ?? ACCENT }} />
                <h2 className="font-bold text-slate-200">{activeSpace.name}</h2>
              </div>
              {activeSpace.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{activeSpace.description}</p>
              )}
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={16} className="text-indigo-400 animate-spin" /></div>
              ) : threads.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare size={24} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">İlk tartışmayı başlatın</p>
                </div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveThread(t)}
                    className="w-full text-left px-4 py-3.5 transition-all"
                    style={{
                      borderBottom: "1px solid rgba(99,102,241,0.07)",
                      background: activeThread?.id === t.id ? "rgba(99,102,241,0.1)" : "transparent",
                      borderLeft: activeThread?.id === t.id ? `2px solid ${ACCENT}` : "2px solid transparent",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {t.isPinned && <Pin size={10} className="text-amber-400 shrink-0" />}
                          {t.isLocked && <Lock size={10} className="text-red-400 shrink-0" />}
                          {t.isFeatured && <Star size={10} className="text-violet-400 shrink-0" />}
                          <p className="text-[13px] font-medium text-slate-200 line-clamp-2 leading-snug">{t.title}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{t.authorDisplayName}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5"><MessageSquare size={9} /> {t.replyCount}</span>
                          <span>·</span>
                          <span>{timeAgo(t.lastActivityAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Create thread button */}
            {user && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}>
                <button
                  onClick={() => setShowCreateThread(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg,rgba(99,102,241,0.7),rgba(139,92,246,0.6))",
                    border: "1px solid rgba(99,102,241,0.4)",
                  }}
                >
                  <Plus size={14} /> Tartışma Başlat
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Thread Detail + Posts ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare size={40} className="text-indigo-400/20 mb-4" />
            <p className="text-slate-500">Bir tartışma seçin veya yeni bir tane başlatın</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div
              className="px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(99,102,241,0.12)", background: "rgba(6,9,20,0.5)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {activeThread.isPinned && <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-semibold"><Pin size={9} /> Sabitlenmiş</span>}
                    {activeThread.isLocked && <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-semibold"><Lock size={9} /> Kilitli</span>}
                    {activeThread.isFeatured && <span className="flex items-center gap-0.5 text-[10px] text-violet-400 font-semibold"><Star size={9} /> Öne Çıkan</span>}
                  </div>
                  <h2 className="font-bold text-lg text-slate-200 leading-snug">{activeThread.title}</h2>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">{ROLE_ICON[activeThread.authorRole]} {activeThread.authorDisplayName}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(activeThread.createdAt)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Eye size={10} /> {activeThread.viewCount}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> {activeThread.replyCount}</span>
                  </div>
                </div>

                {/* Moderation buttons */}
                {isRole("moderator") && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ModButton
                      icon={<Pin size={12} />}
                      active={activeThread.isPinned}
                      title={activeThread.isPinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
                      color="#f59e0b"
                      onClick={() => mutPin.mutate({ id: activeThread.id, pinned: activeThread.isPinned })}
                    />
                    <ModButton
                      icon={<Lock size={12} />}
                      active={activeThread.isLocked}
                      title={activeThread.isLocked ? "Kilidi Aç" : "Kilitle"}
                      color="#f87171"
                      onClick={() => mutLock.mutate({ id: activeThread.id, locked: activeThread.isLocked })}
                    />
                  </div>
                )}
              </div>

              {/* Linked card (idea or research) with quote support */}
              {(activeThread.linkedIdeaId || activeThread.linkedResearchId) ? (
                <LinkedCard
                  linkedIdeaId={activeThread.linkedIdeaId}
                  linkedResearchId={activeThread.linkedResearchId}
                  onQuote={insertQuote}
                />
              ) : activeThread.body ? (
                <div
                  className="mt-3 px-4 py-3 rounded-xl text-sm text-slate-300 leading-relaxed"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}
                >
                  {activeThread.body}
                </div>
              ) : null}
            </div>

            {/* Posts */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-10"><Loader2 size={18} className="text-indigo-400 animate-spin" /></div>
              ) : posts.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Henüz yanıt yok. İlk yanıtı sen yaz!</p>
                </div>
              ) : (
                posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    isLocked={activeThread.isLocked}
                    onReply={(id) => { setReplyParent(id); }}
                    onReact={(emoji) => user && mutReaction.mutate({ targetType: "post", targetId: p.id, emoji })}
                  />
                ))
              )}
            </div>

            {/* Reply box */}
            {user ? (
              <div
                className="px-6 py-4 shrink-0"
                style={{ borderTop: "1px solid rgba(99,102,241,0.12)", background: "rgba(6,9,20,0.5)" }}
              >
                {replyParent && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-indigo-400">
                    <ChevronLeft size={12} />
                    <span>Yanıtlıyorsunuz</span>
                    <button onClick={() => setReplyParent(undefined)} className="ml-auto text-slate-500 hover:text-slate-300">
                      <X size={12} />
                    </button>
                  </div>
                )}
                {/* Quote preview */}
                {replyContent.startsWith(">") && (
                  <div
                    className="mb-2 px-3 py-2 rounded-lg text-xs text-slate-400 leading-relaxed"
                    style={{ background: "rgba(99,102,241,0.06)", borderLeft: "3px solid rgba(99,102,241,0.4)" }}
                  >
                    {replyContent.split("\n").filter(l => l.startsWith(">")).slice(0, 3).map((l, i) => (
                      <p key={i} className="truncate">{l.slice(2)}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)" }}
                  >
                    {user.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 flex items-end gap-2">
                    <textarea
                      ref={replyRef}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                      placeholder={activeThread.isLocked ? "Bu tartışma kilitlenmiş" : "Yanıtınızı yazın… (Ctrl+Enter gönderir)"}
                      disabled={activeThread.isLocked}
                      rows={replyContent.includes("\n") ? Math.min(replyContent.split("\n").length + 1, 8) : 2}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none font-mono"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(99,102,241,0.2)",
                        lineHeight: "1.6",
                      }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyContent.trim() || mutPost.isPending || activeThread.isLocked}
                      className="p-2.5 rounded-xl text-white transition-all disabled:opacity-30 shrink-0"
                      style={{ background: "rgba(99,102,241,0.7)", border: "1px solid rgba(99,102,241,0.4)" }}
                    >
                      {mutPost.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="px-6 py-3 text-center text-xs text-slate-500 shrink-0"
                style={{ borderTop: "1px solid rgba(99,102,241,0.12)" }}
              >
                Yanıt yazmak için giriş yapmanız gerekiyor
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Space Modal ─────────────────────────────────────── */}
      <CreateSpaceModal
        open={showCreateSpace}
        onClose={() => setShowCreateSpace(false)}
        onSuccess={() => { setShowCreateSpace(false); qc.invalidateQueries({ queryKey: ["community-spaces"] }); }}
      />

      {/* ── Create Thread Modal ────────────────────────────────────── */}
      <CreateThreadModal
        open={showCreateThread}
        spaceId={activeSpaceId!}
        onClose={() => setShowCreateThread(false)}
        onSuccess={(thread) => {
          setShowCreateThread(false);
          qc.invalidateQueries({ queryKey: ["community-threads", activeSpaceId] });
          setActiveThread(thread);
        }}
      />
    </div>
  );
}

// ── Linked Card (idea or research) ───────────────────────────────────────────

interface IdeaDetail {
  id: number; title: string; description: string;
  tags?: string[]; status?: string; voteCount?: number;
  roadmap?: string[]; neededResearchTopics?: string[];
  evaluationScores?: {
    commercialFeasibility: number; marketNeed: number;
    technicalDifficulty: number; trendAlignment: number;
    riskGovernance: number; summary: string;
  } | null;
}
interface ResearchDetail {
  id: number; title: string; summary: string; findings?: string;
  technicalAnalysis?: string; tags?: string[];
}

function LinkedCard({ linkedIdeaId, linkedResearchId, onQuote }: {
  linkedIdeaId?: number;
  linkedResearchId?: number;
  onQuote: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: idea } = useQuery<IdeaDetail>({
    queryKey: ["idea-detail", linkedIdeaId],
    queryFn: () => authFetch<IdeaDetail>(`/ideas/${linkedIdeaId}`),
    enabled: !!linkedIdeaId,
    staleTime: 5 * 60_000,
  });

  const { data: research } = useQuery<ResearchDetail>({
    queryKey: ["research-detail", linkedResearchId],
    queryFn: () => authFetch<ResearchDetail>(`/research/${linkedResearchId}`),
    enabled: !!linkedResearchId,
    staleTime: 5 * 60_000,
  });

  const isIdea = !!linkedIdeaId;
  const accent = isIdea ? "#6366f1" : "#34d399";
  const icon = isIdea ? <Lightbulb size={13} /> : <BookOpen size={13} />;
  const typeLabel = isIdea ? "Fikir" : "Araştırma";

  const title = idea?.title ?? research?.title ?? "Yükleniyor…";
  const isLoading = linkedIdeaId ? !idea : !research;

  return (
    <motion.div
      layout
      className="mt-3 rounded-xl overflow-hidden"
      style={{ background: `${accent}08`, border: `1px solid ${accent}22` }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? `1px solid ${accent}18` : "none" }}
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}20`, color: accent }}
        >
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{typeLabel}</span>
        <span className="text-sm font-medium text-slate-300 flex-1 truncate">{title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isLoading && (
            <button
              onClick={e => {
                e.stopPropagation();
                const text = isIdea
                  ? [idea?.description, idea?.evaluationScores?.summary].filter(Boolean).join("\n\n")
                  : [research?.summary, research?.findings].filter(Boolean).join("\n\n");
                onQuote(title + "\n\n" + text);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
              title="Tümünü alıntıla"
            >
              <Quote size={11} /> Alıntıla
            </button>
          )}
          <span style={{ color: `${accent}60` }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: accent }} />
              </div>
            ) : isIdea && idea ? (
              <IdeaCardContent idea={idea} accent={accent} onQuote={onQuote} />
            ) : research ? (
              <ResearchCardContent research={research} accent={accent} onQuote={onQuote} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function QuoteableSection({ label, content, accent, onQuote }: {
  label: string; content: string; accent: string; onQuote: (text: string) => void;
}) {
  if (!content?.trim()) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: `${accent}80` }}>{label}</span>
        <button
          onClick={() => onQuote(`**${label}**\n${content}`)}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: `${accent}60` }}
          title="Bu bölümü alıntıla"
        >
          <Quote size={9} /> Alıntıla
        </button>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function IdeaCardContent({ idea, accent, onQuote }: { idea: IdeaDetail; accent: string; onQuote: (t: string) => void }) {
  return (
    <div className="px-4 py-3 space-y-3">
      <QuoteableSection label="Açıklama" content={idea.description} accent={accent} onQuote={onQuote} />
      {idea.evaluationScores?.summary && (
        <QuoteableSection label="Değerlendirme" content={idea.evaluationScores.summary} accent={accent} onQuote={onQuote} />
      )}
      {idea.roadmap && idea.roadmap.length > 0 && (
        <QuoteableSection label="Yol Haritası" content={idea.roadmap.join("\n")} accent={accent} onQuote={onQuote} />
      )}
      {idea.neededResearchTopics && idea.neededResearchTopics.length > 0 && (
        <QuoteableSection label="Araştırma Konuları" content={idea.neededResearchTopics.join("\n")} accent={accent} onQuote={onQuote} />
      )}
      {/* Evaluation scores */}
      {idea.evaluationScores && (
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {([
            ["Ticari", idea.evaluationScores.commercialFeasibility],
            ["Pazar", idea.evaluationScores.marketNeed],
            ["Teknik", idea.evaluationScores.technicalDifficulty],
            ["Trend", idea.evaluationScores.trendAlignment],
            ["Risk", idea.evaluationScores.riskGovernance],
          ] as [string, number][]).map(([label, score]) => (
            <div key={label} className="text-center">
              <div className="text-base font-bold" style={{ color: score >= 7 ? "#34d399" : score >= 5 ? "#f59e0b" : "#f87171" }}>{score}</div>
              <div className="text-[9px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      )}
      {idea.tags && idea.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {idea.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${accent}15`, color: accent }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchCardContent({ research, accent, onQuote }: { research: ResearchDetail; accent: string; onQuote: (t: string) => void }) {
  return (
    <div className="px-4 py-3 space-y-3">
      <QuoteableSection label="Özet" content={research.summary} accent={accent} onQuote={onQuote} />
      {research.findings && <QuoteableSection label="Bulgular" content={research.findings} accent={accent} onQuote={onQuote} />}
      {research.technicalAnalysis && <QuoteableSection label="Teknik Analiz" content={research.technicalAnalysis} accent={accent} onQuote={onQuote} />}
      {research.tags && research.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {research.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${accent}15`, color: accent }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, isLocked, onReply, onReact }: {
  post: Post;
  isLocked: boolean;
  onReply: (id: number) => void;
  onReact: (emoji: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
      style={{ paddingLeft: post.parentPostId ? 32 : 0 }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
        style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.3)" }}
      >
        {post.authorDisplayName[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="px-4 py-3 rounded-2xl"
          style={{
            background: post.isSolution ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${post.isSolution ? "rgba(52,211,153,0.2)" : "rgba(99,102,241,0.1)"}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              {ROLE_ICON[post.authorRole]} {post.authorDisplayName}
            </span>
            {post.isSolution && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                <CheckCircle2 size={9} /> Çözüm
              </span>
            )}
            <span className="ml-auto text-[11px] text-slate-600">{timeAgo(post.createdAt)}</span>
          </div>
          <PostContent content={post.content} />
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-1">
          {EMOJIS.map((e) => (
            <button
              key={e.key}
              onClick={() => onReact(e.key)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-0.5"
            >
              {e.icon}
            </button>
          ))}
          {!isLocked && (
            <button
              onClick={() => onReply(post.id)}
              className="ml-1 text-[11px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
            >
              Yanıtla
            </button>
          )}
          {post.reactionCount > 0 && (
            <span className="ml-auto text-[11px] text-slate-600">{post.reactionCount} tepki</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Post content renderer (handles > quotes) ─────────────────────────────────

function PostContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: Array<{ type: "quote" | "text"; lines: string[] }> = [];
  let current: { type: "quote" | "text"; lines: string[] } | null = null;

  for (const line of lines) {
    const isQuote = line.startsWith("> ") || line === ">";
    const type = isQuote ? "quote" : "text";
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(isQuote ? line.slice(2) : line);
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) =>
        block.type === "quote" ? (
          <div
            key={i}
            className="px-3 py-2 rounded-lg text-slate-400 italic"
            style={{ background: "rgba(99,102,241,0.07)", borderLeft: "3px solid rgba(99,102,241,0.35)" }}
          >
            {block.lines.map((l, j) => <p key={j}>{l || "\u00A0"}</p>)}
          </div>
        ) : (
          <p key={i} className="text-slate-300 whitespace-pre-wrap">
            {block.lines.join("\n")}
          </p>
        )
      )}
    </div>
  );
}

// ── Mod Button ───────────────────────────────────────────────────────────────

function ModButton({ icon, active, title, color, onClick }: {
  icon: React.ReactNode; active: boolean; title: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg transition-all"
      style={{
        background: active ? `${color}22` : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? `${color}44` : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "#475569",
      }}
    >
      {icon}
    </button>
  );
}

// ── Create Space Modal ────────────────────────────────────────────────────────

function CreateSpaceModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", color: "#6366f1" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authFetch("/community/spaces", { method: "POST", body: JSON.stringify(form) });
      onSuccess();
      setForm({ name: "", slug: "", description: "", color: "#6366f1" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,8,0.75)" }} onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-sm p-6 rounded-2xl"
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            style={{ background: "rgba(7,11,26,0.98)", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            <p className="font-bold text-slate-200 mb-4 flex items-center gap-2"><Hash size={16} className="text-indigo-400" /> Yeni Alan Oluştur</p>
            <form onSubmit={submit} className="space-y-3">
              <FormInput label="Alan Adı" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v, slug: v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }))} placeholder="örn. Yapay Zeka" />
              <FormInput label="Slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} placeholder="yapay-zeka" />
              <FormInput label="Açıklama" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Bu alanın konusu…" />
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Renk</label>
                <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="w-full h-9 rounded-xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }} />
              </div>
              {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-400" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>İptal</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.8),rgba(139,92,246,0.7))", border: "1px solid rgba(99,102,241,0.4)" }}>
                  {loading ? "Oluşturuluyor…" : "Oluştur"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Create Thread Modal ───────────────────────────────────────────────────────

function CreateThreadModal({ open, spaceId, onClose, onSuccess }: {
  open: boolean; spaceId: number; onClose: () => void; onSuccess: (thread: Thread) => void;
}) {
  const [form, setForm] = useState({ title: "", body: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const thread = await authFetch<Thread>(`/community/spaces/${spaceId}/threads`, { method: "POST", body: JSON.stringify(form) });
      onSuccess(thread);
      setForm({ title: "", body: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,8,0.75)" }} onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-lg p-6 rounded-2xl"
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            style={{ background: "rgba(7,11,26,0.98)", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            <p className="font-bold text-slate-200 mb-4 flex items-center gap-2"><MessageSquare size={16} className="text-indigo-400" /> Yeni Tartışma</p>
            <form onSubmit={submit} className="space-y-3">
              <FormInput label="Başlık" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="Tartışma başlığı…" />
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Açıklama (isteğe bağlı)</label>
                <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} placeholder="Daha fazla detay…" rows={4} className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }} />
              </div>
              {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-400" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>İptal</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.8),rgba(139,92,246,0.7))", border: "1px solid rgba(99,102,241,0.4)" }}>
                  {loading ? "Gönderiliyor…" : "Tartışmayı Başlat"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required className="w-full px-3 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }} />
    </div>
  );
}
