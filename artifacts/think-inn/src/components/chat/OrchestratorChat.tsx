import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2, FileText, Lightbulb, CheckCircle2, Sparkles, Zap } from "lucide-react";
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
    <div className="w-full lg:w-[440px] flex flex-col relative z-20 h-full bg-white border-l border-gray-100 shadow-xl shadow-gray-200/40">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl" />

        <div className="relative flex items-center gap-3 px-5 py-4">
          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-xl blur-sm opacity-30" />
            <div className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
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
              <span className="text-[11px] text-indigo-200 font-medium">Çevrimiçi · Gemini 2.5</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 border border-white/20">
            <Zap size={10} className="text-amber-300" />
            <span className="text-[10px] font-semibold text-white/80">AI</span>
          </div>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/40">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-8">
            {/* Animated bot icon */}
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-lg shadow-indigo-200/50"
              >
                <Bot size={36} className="text-indigo-600" />
              </motion.div>
              <motion.div
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center"
              >
                <Sparkles size={10} className="text-white" />
              </motion.div>
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Nasıl yardımcı olabilirim?</h3>
              <p className="text-sm text-gray-500 max-w-[75%] mx-auto leading-relaxed">
                Araştırma veya fikir paylaşın — analiz edip sisteme ekleyeyim.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[90%]">
              {[
                { icon: <FileText size={13} />, label: "Araştırma metni yapıştırın", color: "text-violet-500 bg-violet-50 border-violet-100" },
                { icon: <Lightbulb size={13} />, label: "Bir fikir anlatın", color: "text-amber-500 bg-amber-50 border-amber-100" },
              ].map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className={`flex items-center gap-2.5 text-xs font-medium bg-white border rounded-xl px-4 py-3 shadow-sm ${hint.color}`}
                >
                  {hint.icon}
                  <span className="text-gray-600">{hint.label}</span>
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
                msg.role === "user" ? "text-gray-400 flex-row-reverse" : "text-indigo-500"
              }`}>
                {msg.role === "user" ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                      <User size={11} className="text-gray-500" />
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
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-semibold border shadow-sm ${
                        item.type === "research"
                          ? "bg-violet-50 text-violet-700 border-violet-100"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}
                    >
                      <CheckCircle2 size={11} />
                      {item.type === "research" ? <FileText size={10} /> : <Lightbulb size={10} />}
                      <span className="truncate max-w-[130px]">{item.title}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Message bubble */}
              <div className={`p-4 text-sm max-w-[92%] shadow-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-md shadow-indigo-200"
                  : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-md shadow-gray-100"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none
                    prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-gray-700
                    prose-headings:text-gray-900 prose-headings:font-bold
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-ul:my-2 prose-li:my-0.5
                    prose-a:text-indigo-600 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:rounded prose-code:px-1
                    prose-table:text-xs prose-th:bg-gray-50 prose-th:p-2 prose-td:p-2"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || (msg.isStreaming ? "..." : "")}
                    </ReactMarkdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-1 align-middle rounded-sm" />
                    )}
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
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                />
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            {error}
          </div>
        )}
      </div>

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className={`relative flex items-end gap-0 bg-gray-50 rounded-2xl border transition-all ${
            input ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'
          }`}>
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
              className="flex-1 bg-transparent text-gray-800 rounded-2xl p-3.5 text-sm focus:outline-none resize-none h-20 placeholder:text-gray-400 transition-shadow"
              disabled={isTyping || isLoadingConvos}
            />
          </div>
          <div className="flex justify-between items-center px-0.5">
            <span className="text-[11px] text-gray-400">Shift+Enter yeni satır</span>
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="submit"
              disabled={!input.trim() || isTyping || !conversationId}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                input.trim() && !isTyping && conversationId
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-300 hover:shadow-lg hover:shadow-indigo-200'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
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
