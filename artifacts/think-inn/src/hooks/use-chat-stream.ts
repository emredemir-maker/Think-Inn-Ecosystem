import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function useChatStream(conversationId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !conversationId) return;

    // Abort previous stream if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Optimistically add user message
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content };
    const assistantMsgId = (Date.now() + 1).toString();
    
    setMessages(prev => [
      ...prev, 
      userMsg, 
      { id: assistantMsgId, role: "assistant", content: "", isStreaming: true }
    ]);
    
    setIsTyping(true);
    setError(null);

    try {
      const res = await fetch(`/api/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (!dataStr.trim()) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.done) {
                // Stream complete
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, isStreaming: false } : m
                ));
                // Invalidate ecosystem queries because the AI might have created research/ideas
                queryClient.invalidateQueries({ queryKey: ["/api/research"] });
                queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
                queryClient.invalidateQueries({ queryKey: ["/api/diagrams"] });
              } else if (data.content) {
                fullResponse += data.content;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, content: fullResponse } : m
                ));
              }
            } catch (e) {
              console.warn("Error parsing SSE chunk:", e, dataStr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error(err);
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId ? { ...m, content: "⚠️ İletişim koptu.", isStreaming: false } : m
      ));
    } finally {
      setIsTyping(false);
    }
  }, [conversationId, queryClient]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isTyping,
    error,
    clearMessages,
    setMessages
  };
}
