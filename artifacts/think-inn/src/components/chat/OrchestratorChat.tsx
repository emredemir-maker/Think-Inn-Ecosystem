import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2, FileText, Lightbulb, CheckCircle2, Sparkles, Zap, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useCreateGeminiConversation, useListGeminiConversations } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

export function OrchestratorChat() {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);

  const { data: conversations, isLoading: isLoadingConvos } = useListGeminiConversations();
  const { mutateAsync: createConvo } = useCreateGeminiConversation();

  const { messages, sendMessage, isTyping, error } = useChatStream(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversations && !conversationId) {
      if (conversations.length > 0) {
        setConversationId(conversations[0].id);
      } else {
        createConvo({ data: { title: "Session " + new Date().getTime() } })
          .then(res => setConversationId(res.id))
          .catch(console.error);
      }
    }
  }, [conversations, conversationId, createConvo]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail?.message;
      if (msg && conversationId && !isTyping) {
        sendMessage(msg);
      }
    };
    window.addEventListener('think-inn:send-message', handler);
    return () => window.removeEventListener('think-inn:send-message', handler);
  }, [conversationId, isTyping, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div
      className="w-full flex flex-col relative z-20 h-full lg:w-[440px] lg:shrink-0"
      style={{
        background: 'rgba(6,11,24,0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(99,102,241,0.2)',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.6)',
      }}
    >

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060b18] via-[#0d1535] to-[#12082a]" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl" />

        {/* Scan-line at bottom of chat header */}
        <div
          className="absolute inset-x-0 bottom-0 h-px pointer-events-none z-10"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6) 30%, rgba(34,211,238,0.5) 50%, rgba(99,102,241,0.6) 70%, transparent)',
          }}
        />

        <div
          className="relative flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-xl blur-sm opacity-30" />
            <div
              className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}
            >
              <Bot size={20} className="text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">İnovasyon Asistanı</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Çevrimiçi · Gemini 2.5</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-cyan-400/10 rounded-lg px-2 py-1 border border-cyan-400/20">
            <Zap size={10} className="text-cyan-400" />
            <span className="text-[10px] font-semibold text-cyan-400">AI</span>
          </div>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-8">
            {/* Animated bot icon */}
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <Bot size={36} className="text-indigo-400" />
              </motion.div>
              <motion.div
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center"
              >
                <Sparkles size={10} className="text-white" />
              </motion.div>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-200 mb-1">Nasıl yardımcı olabilirim?</h3>
              <p className="text-sm text-slate-500 max-w-[75%] mx-auto leading-relaxed">
                Araştırma veya fikir paylaşın — analiz edip sisteme ekleyeyim.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[90%]">
              {[
                { icon: <FileText size={13} />, label: "Araştırma metni yapıştırın", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
                { icon: <Lightbulb size={13} />, label: "Bir fikir anlatın", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
              ].map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className={`flex items-center gap-2.5 text-xs font-medium border rounded-xl px-4 py-3 shadow-sm ${hint.color}`}
                  style={{ background: i === 0 ? 'rgba(10,16,34,0.8)' : 'rgba(10,16,34,0.8)' }}
                >
                  {hint.icon}
                  <span className="text-slate-400">{hint.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Role label */}
              <div className={`flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold px-1 ${
                msg.role === "user" ? "text-slate-600 flex-row-reverse" : "text-indigo-400"
              }`}>
                {msg.role === "user" ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                      <User size={11} className="text-slate-400" />
                    </div>
                    <span>Siz</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Bot size={11} className="text-white" />
                    </div>
                    <span>Asistan</span>
                  </>
                )}
              </div>

              {/* Saved items badges */}
              {msg.role === "assistant" && msg.savedItems && msg.savedItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 max-w-[92%]">
                  {msg.savedItems.map((item) => (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold border shadow-sm"
                      style={
                        item.type === "research"
                          ? { background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }
                          : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }
                      }
                    >
                      <CheckCircle2 size={11} />
                      {item.type === "research" ? <FileText size={10} /> : <Lightbulb size={10} />}
                      <span className="truncate max-w-[130px]">{item.title}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`p-4 text-sm max-w-[92%] shadow-sm ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-md"
                    : "rounded-2xl rounded-tl-md"
                }`}
                style={
                  msg.role === "user"
                    ? { boxShadow: '0 0 20px rgba(99,102,241,0.3)' }
                    : { background: 'rgba(10,16,34,0.8)', border: '1px solid rgba(99,102,241,0.15)', color: '#e2e8f0' }
                }
              >
                {msg.role === "assistant" ? (
                  <div>
                    {/* Progress label — shown while tool is running, no content yet */}
                    {msg.isStreaming && msg.progressLabel && !msg.content && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium py-1">
                        <RefreshCw size={12} className="animate-spin shrink-0" />
                        <span>{msg.progressLabel}</span>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none
                      prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-slate-300
                      prose-headings:text-slate-100 prose-headings:font-bold
                      prose-strong:text-slate-100 prose-strong:font-semibold
                      prose-ul:my-2 prose-li:my-0.5
                      prose-a:text-cyan-400 prose-code:text-cyan-400 prose-code:bg-cyan-400/10 prose-code:rounded prose-code:px-1
                      prose-table:text-xs prose-th:bg-slate-800/50 prose-th:p-2 prose-td:p-2 prose-td:text-slate-300"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || (msg.isStreaming && !msg.progressLabel ? "..." : "")}
                      </ReactMarkdown>
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-1 align-middle rounded-sm" />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && messages.every(m => !m.isStreaming) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot size={11} className="text-white" />
            </div>
            <div
              className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm flex items-center gap-1"
              style={{ background: 'rgba(10,16,34,0.8)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                />
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
            {error}
          </div>
        )}
      </div>

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div
        className="p-4 shrink-0"
        style={{
          background: 'rgba(6,11,24,0.95)',
          borderTop: '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div
            className={`relative flex items-end gap-0 transition-all`}
            style={{
              background: 'rgba(10,16,34,0.6)',
              border: input ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(99,102,241,0.2)',
              borderRadius: '16px',
              boxShadow: input ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Mesajınızı yazın..."
              className="flex-1 bg-transparent rounded-2xl p-3.5 text-sm focus:outline-none resize-none h-20 transition-shadow text-slate-200 placeholder:text-slate-600"
              disabled={isTyping || isLoadingConvos}
            />
          </div>
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[11px] text-slate-600">Shift+Enter yeni satır</span>
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="submit"
              disabled={!input.trim() || isTyping || !conversationId}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                input.trim() && !isTyping && conversationId
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                  : 'cursor-not-allowed'
              }`}
              style={
                input.trim() && !isTyping && conversationId
                  ? { boxShadow: '0 0 16px rgba(99,102,241,0.4)' }
                  : { background: 'rgba(99,102,241,0.05)', color: 'rgba(99,102,241,0.3)' }
              }
            >
              {isTyping ? (
                <><Loader2 size={15} className="animate-spin" /><span>İşleniyor</span></>
              ) : (
                <><Send size={15} /><span>Gönder</span></>
              )}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}
