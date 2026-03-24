import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useCreateGeminiConversation, useListGeminiConversations } from "@workspace/api-client-react";
import { CyberButton } from "../ui/CyberButton";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="w-full lg:w-[450px] border-l border-border bg-white flex flex-col relative z-20 shadow-sm h-full">
      {/* Chat Header */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a2e]">Innovation Assistant</h2>
            <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 space-y-4">
            <div className="bg-primary/5 p-4 rounded-full">
              <Bot size={40} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium text-[#1a1a2e]">How can I help?</h3>
            <p className="text-sm text-[#6b7280] max-w-[80%]">
              Enter an idea or research topic. I can help analyze, structure, and format it for the ecosystem.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-xs text-[#6b7280] font-medium px-1">
              {msg.role === "user" ? (
                <><span>You</span><User size={12} /></>
              ) : (
                <><Bot size={12} className="text-primary" /><span className="text-primary">Assistant</span></>
              )}
            </div>
            <div 
              className={`p-4 text-sm rounded-2xl max-w-[90%] shadow-sm ${
                msg.role === "user" 
                  ? "bg-primary text-white rounded-tr-sm" 
                  : "bg-white border border-border text-[#1a1a2e] rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-[#1a1a2e] prose-a:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (msg.isStreaming ? "..." : "")}
                  </ReactMarkdown>
                  {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle" />}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-border shrink-0">
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type your message..."
            className="w-full bg-gray-50 border border-border text-[#1a1a2e] rounded-xl p-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none h-24 placeholder:text-gray-400 transition-shadow"
            disabled={isTyping || isLoadingConvos}
          />
          <div className="flex justify-between items-center px-1">
            <span className="text-xs text-gray-400">Shift + Enter for new line</span>
            <CyberButton 
              type="submit" 
              size="sm" 
              disabled={!input.trim() || isTyping || !conversationId}
              className="px-5 rounded-full"
            >
              {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="ml-1.5">{isTyping ? "Sending..." : "Send"}</span>
            </CyberButton>
          </div>
        </form>
      </div>
    </div>
  );
}
