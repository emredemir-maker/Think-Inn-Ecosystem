import React, { useState, useEffect, useRef } from "react";
import { Send, Cpu, User, Loader2, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStream, ChatMessage } from "@/hooks/use-chat-stream";
import { useCreateGeminiConversation, useListGeminiConversations } from "@workspace/api-client-react";
import { CyberButton } from "../ui/CyberButton";

export function OrchestratorChat() {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  
  const { data: conversations, isLoading: isLoadingConvos } = useListGeminiConversations();
  const { mutateAsync: createConvo } = useCreateGeminiConversation();
  
  const { messages, sendMessage, isTyping, error } = useChatStream(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize conversation
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="w-[400px] lg:w-[450px] border-l border-primary/30 bg-card/95 backdrop-blur-md flex flex-col relative z-20 shadow-[-10px_0_30px_rgba(0,255,255,0.05)]">
      {/* Chat Header */}
      <div className="h-14 border-b border-primary/20 flex items-center justify-between px-4 bg-background/50">
        <div className="flex items-center gap-2">
          <Cpu className="text-primary animate-pulse" size={18} />
          <h2 className="text-sm font-bold text-primary tracking-widest">ORCHESTRATOR_AI</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="text-[10px] text-primary/70 font-mono">ONLINE</span>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <Cpu size={48} className="text-primary" />
            <p className="text-sm text-primary font-display tracking-widest">AWAITING INPUT_</p>
            <p className="text-xs text-muted-foreground font-mono max-w-[80%]">
              Girmek istediğiniz fikri veya araştırmayı yazın. 
              Benzerlik analizi ve formatlama otomatik yapılacaktır.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] font-mono">
              {msg.role === "user" ? (
                <><span>USER</span><User size={10} /></>
              ) : (
                <><Cpu size={10} className="text-primary" /><span className="text-primary">ORCHESTRATOR</span></>
              )}
            </div>
            <div 
              className={`p-3 text-sm relative max-w-[90%] ${
                msg.role === "user" 
                  ? "bg-secondary/50 border border-primary/30 text-foreground hud-clip-reverse" 
                  : "bg-primary/5 border border-primary/10 text-primary/90 hud-clip"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-p:leading-snug prose-sm max-w-none prose-headings:text-primary prose-a:text-accent prose-strong:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (msg.isStreaming ? "..." : "")}
                  </ReactMarkdown>
                  {msg.isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle" />}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-xs text-destructive border border-destructive/30 bg-destructive/10 p-2 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background/80 border-t border-primary/20 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="İletişim kurun..."
            className="w-full bg-secondary/30 border border-primary/30 text-foreground p-3 text-sm focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/50 resize-none h-24 placeholder:text-muted-foreground/50 font-sans hud-clip transition-all"
            disabled={isTyping || isLoadingConvos}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-mono opacity-50">Shift+Enter for new line</span>
            <CyberButton 
              type="submit" 
              size="sm" 
              disabled={!input.trim() || isTyping || !conversationId}
              className="px-6"
            >
              {isTyping ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span className="ml-1">{isTyping ? "PROCESSING" : "TRANSMIT"}</span>
            </CyberButton>
          </div>
        </form>
      </div>
    </div>
  );
}
